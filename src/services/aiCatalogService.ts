import { z } from 'zod/v4';

import type { Category, CategoryField } from '@/types';
import { getIntegrationKey } from '@/lib/integrationKeys';
import { ITEM_FORM_HIDDEN_CUSTOM_KEYS } from '@/lib/itemForm';
import { getLanguage } from '@/i18n';
import { CatalogLookupError, type CatalogCandidate } from '@/services/catalogEnrichmentService';

/**
 * Photo → catalogue metadata with Claude (vision + structured outputs).
 *
 * Runs straight from the browser with the user's own key (Settings →
 * Integrations); the SDK is loaded lazily so it never weighs on first paint.
 * Results are only ever *suggestions* — the editor shows a per-field review.
 */
export const AI_CATALOG_MODEL = 'claude-opus-5-5';

const IMAGE_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

export const aiCatalogOutputSchema = z.object({
  identified: z.boolean(),
  title: z.string(),
  description: z.string(),
  fields: z.array(z.object({ key: z.string(), value: z.string() })),
  tags: z.array(z.string()),
  condition: z.string().nullable(),
  estimatedValue: z
    .object({ low: z.number(), high: z.number(), currency: z.string() })
    .nullable(),
  confidence: z.number(),
  notes: z.string(),
});

export type AiCatalogOutput = z.infer<typeof aiCatalogOutputSchema>;

export interface AiIdentifyInput {
  image: string;
  category: Pick<Category, 'name'>;
  fields: CategoryField[];
  conditionOptions: string[];
  /** Preferred currency for the value estimate. */
  currency: string;
  /** Anything the user already typed (title, notes) to steer identification. */
  hint?: string;
  signal?: AbortSignal;
}

export interface AiIdentifyResult {
  candidate: CatalogCandidate;
  /** Short model rationale / caveats shown above the review. */
  notes: string;
  identified: boolean;
}

type ImageBlockSource =
  | { type: 'base64'; media_type: ImageMediaType; data: string }
  | { type: 'url'; url: string };

export function toImageSource(image: string): ImageBlockSource {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(image);
  if (match) {
    const mediaType = match[1].toLowerCase() as ImageMediaType;
    if (!IMAGE_MEDIA_TYPES.includes(mediaType)) throw new CatalogLookupError('no-image', 'claude', mediaType);
    return { type: 'base64', media_type: mediaType, data: match[2] };
  }
  if (/^https:\/\//i.test(image)) return { type: 'url', url: image };
  throw new CatalogLookupError('no-image', 'claude');
}

const SYSTEM_PROMPT = `You are a registrar cataloguing items for a private collection (books, coins, stamps, records, watches, toys, art and similar).
You are shown one photo of an item and the fields its collection uses. Identify the item as precisely as the photo allows and fill in catalogue metadata.

Rules:
- Only report what the photo supports or what is well-established for an item you can identify with reasonable certainty. Never invent serial numbers, catalogue numbers, ISBNs or signatures you cannot read.
- "fields": include only keys from the provided field list, with string values. For select fields, use one of the listed options verbatim. Leave out anything you are unsure of rather than guessing.
- "condition": one of the provided condition options when the photo shows enough to judge it, otherwise null.
- "estimatedValue": a realistic secondary-market range in the requested currency, only when you have identified the item confidently; otherwise null.
- "confidence": 0 to 1 for the identification as a whole. Set "identified" to false (and keep other fields minimal) when you cannot tell what the item is.
- "tags": up to 6 short, lowercase topical tags.
- Write "title", "description", "tags" and "notes" in the requested language. "notes" is one or two sentences on what you based the identification on and any caveats.`;

function describeField(field: CategoryField): string {
  const parts = [`- ${field.key} ("${field.label}", ${field.type})`];
  if (field.options?.length) parts.push(`options: ${field.options.join(' | ')}`);
  if (field.helpText) parts.push(`hint: ${field.helpText}`);
  return parts.join('; ');
}

export function buildUserPrompt(input: Omit<AiIdentifyInput, 'image' | 'signal'>): string {
  const fields = input.fields.filter((field) => !ITEM_FORM_HIDDEN_CUSTOM_KEYS.has(field.key) && field.type !== 'image');
  const language = getLanguage() === 'tr' ? 'Turkish' : 'English';
  return [
    `Collection: ${input.category.name}`,
    `Fields:\n${fields.length ? fields.map(describeField).join('\n') : '(none)'}`,
    `Condition options: ${input.conditionOptions.join(' | ')}`,
    `Currency for estimates: ${input.currency}`,
    `Language: ${language}`,
    input.hint?.trim() ? `Notes from the owner: ${input.hint.trim()}` : '',
  ].filter(Boolean).join('\n\n');
}

/** Map a validated model output onto the shared candidate shape (only known field keys survive). */
export function outputToCandidate(output: AiCatalogOutput, fields: CategoryField[]): CatalogCandidate {
  const knownKeys = new Set(fields.map((field) => field.key));
  const confidence = Math.min(1, Math.max(0, output.confidence));
  const estimate = output.estimatedValue;
  const usableEstimate = estimate
    && output.identified
    && confidence >= 0.6
    && Number.isFinite(estimate.low)
    && Number.isFinite(estimate.high)
    && estimate.high > 0
    && /^[A-Z]{3}$/.test(estimate.currency.trim().toUpperCase());

  return {
    provider: 'claude',
    title: output.identified ? output.title.trim() || undefined : undefined,
    description: output.description.trim() || undefined,
    tags: output.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 6),
    condition: output.condition ?? undefined,
    fields: output.fields
      .filter((entry) => knownKeys.has(entry.key) && entry.value.trim())
      .map((entry) => ({ keys: [entry.key], value: entry.value.trim() })),
    images: [],
    estimatedValue: usableEstimate
      ? {
          low: Math.min(estimate.low, estimate.high),
          high: Math.max(estimate.low, estimate.high),
          currency: estimate.currency.trim().toUpperCase(),
          basis: 'estimate',
        }
      : undefined,
    confidence,
  };
}

export const aiCatalogService = {
  isConfigured(): boolean {
    return !!getIntegrationKey('anthropic');
  },

  async identify(input: AiIdentifyInput): Promise<AiIdentifyResult> {
    const apiKey = getIntegrationKey('anthropic');
    if (!apiKey) throw new CatalogLookupError('no-key', 'claude');
    const source = toImageSource(input.image);

    const [{ default: Anthropic }, { betaZodOutputFormat }] = await Promise.all([
      import('@anthropic-ai/sdk'),
      import('@anthropic-ai/sdk/helpers/beta/zod'),
    ]);

    // The key never leaves this device except to api.anthropic.com.
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 120_000 });

    let response;
    try {
      response = await client.beta.messages.parse(
        {
          model: AI_CATALOG_MODEL,
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'medium', format: betaZodOutputFormat(aiCatalogOutputSchema) },
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source },
                { type: 'text', text: buildUserPrompt(input) },
              ],
            },
          ],
        },
        { signal: input.signal },
      );
    } catch (error) {
      if (error instanceof Anthropic.APIUserAbortError) throw error;
      if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
        throw new CatalogLookupError('auth', 'claude');
      }
      if (error instanceof Anthropic.RateLimitError) throw new CatalogLookupError('rate-limit', 'claude');
      if (error instanceof Anthropic.APIConnectionError) throw new CatalogLookupError('network', 'claude');
      if (error instanceof Anthropic.BadRequestError) throw new CatalogLookupError('api', 'claude', error.message);
      if (error instanceof Anthropic.APIError) throw new CatalogLookupError('api', 'claude', `HTTP ${error.status}`);
      // JSON/schema parse failures surface as plain errors from .parse().
      throw new CatalogLookupError('invalid-response', 'claude', error instanceof Error ? error.message : undefined);
    }

    if (response.stop_reason === 'refusal') throw new CatalogLookupError('refusal', 'claude');
    const output = response.parsed_output;
    if (!output) throw new CatalogLookupError('invalid-response', 'claude', response.stop_reason ?? undefined);

    return {
      candidate: outputToCandidate(output, input.fields),
      notes: output.notes.trim(),
      identified: output.identified,
    };
  },
};
