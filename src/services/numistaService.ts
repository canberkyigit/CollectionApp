import { getIntegrationKey } from '@/lib/integrationKeys';
import { CatalogLookupError, type CatalogCandidate } from '@/services/catalogEnrichmentService';

/**
 * Numista catalogue lookups for coins (API v3). Requires an API key from
 * Settings → Integrations, sent in the `Numista-API-Key` header.
 */
const BASE = 'https://api.numista.com/v3';

export interface NumistaSearchResult {
  id: number;
  title: string;
  issuer?: string;
  minYear?: number;
  maxYear?: number;
  thumbnail?: string;
}

interface NumistaSearchResponse {
  count?: number;
  types?: Array<{
    id: number;
    title?: string;
    category?: string;
    issuer?: { code?: string; name?: string };
    min_year?: number;
    max_year?: number;
    obverse_thumbnail?: string;
    reverse_thumbnail?: string;
  }>;
}

interface NumistaType {
  id: number;
  url?: string;
  title?: string;
  issuer?: { name?: string };
  min_year?: number;
  max_year?: number;
  value?: { text?: string; numeric_value?: number; currency?: { name?: string } };
  composition?: { text?: string };
  weight?: number;
  size?: number;
  thickness?: number;
  shape?: string;
  rarity_index?: number;
  tags?: string[];
  obverse?: { picture?: string; thumbnail?: string; description?: string };
  reverse?: { picture?: string; thumbnail?: string; description?: string };
  comments?: string;
}

// Numista localises to en/fr/es only — English is the closest fit for Turkish too.
const NUMISTA_LANG = 'en';

async function numistaFetch<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const key = getIntegrationKey('numista');
  if (!key) throw new CatalogLookupError('no-key', 'numista');
  const query = new URLSearchParams({ ...params, lang: NUMISTA_LANG });
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}?${query}`, {
      headers: { 'Numista-API-Key': key },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    // Browsers report CORS rejections as a bare network error.
    throw new CatalogLookupError('network', 'numista');
  }
  if (response.status === 401 || response.status === 403) throw new CatalogLookupError('auth', 'numista');
  if (response.status === 429) throw new CatalogLookupError('rate-limit', 'numista');
  if (response.status === 404) throw new CatalogLookupError('not-found', 'numista');
  if (!response.ok) throw new CatalogLookupError('api', 'numista', `HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function yearRange(min?: number, max?: number): string | undefined {
  if (!min && !max) return undefined;
  if (min && max && min !== max) return `${min}–${max}`;
  return String(min ?? max);
}

export function typeToCandidate(type: NumistaType): CatalogCandidate {
  const denomination = type.value?.text
    ?? (type.value?.numeric_value !== undefined
      ? `${type.value.numeric_value} ${type.value.currency?.name ?? ''}`.trim()
      : undefined);
  const years = yearRange(type.min_year, type.max_year);
  const images = [type.obverse?.picture, type.reverse?.picture].filter((url): url is string => !!url);
  const descriptionParts = [
    type.issuer?.name,
    denomination,
    years,
    type.composition?.text,
  ].filter(Boolean);

  return {
    provider: 'numista',
    title: type.title,
    description: descriptionParts.join(' · '),
    tags: (type.tags ?? []).slice(0, 6),
    fields: [
      ...(type.issuer?.name ? [{ keys: ['country', 'issuer', 'ülke', 'ulke', 'ihraççı'], value: type.issuer.name }] : []),
      ...(type.min_year ? [{ keys: ['year', 'mintYear', 'yıl', 'yil'], value: type.min_year }] : []),
      ...(denomination ? [{ keys: ['denomination', 'value', 'nominal', 'değer', 'deger'], value: denomination }] : []),
      ...(type.composition?.text
        ? [{ keys: ['metal', 'composition', 'material', 'alaşım', 'alasim', 'maden'], value: type.composition.text }]
        : []),
      ...(type.weight ? [{ keys: ['weight', 'weightG', 'ağırlık', 'agirlik'], value: type.weight }] : []),
      ...(type.size ? [{ keys: ['diameter', 'size', 'diameterMm', 'çap', 'cap'], value: type.size }] : []),
      ...(type.thickness ? [{ keys: ['thickness', 'kalınlık', 'kalinlik'], value: type.thickness }] : []),
      ...(type.shape ? [{ keys: ['shape', 'şekil', 'sekil'], value: type.shape }] : []),
    ],
    images,
    externalId: String(type.id),
    externalUrl: type.url ?? `https://en.numista.com/catalogue/pieces${type.id}.html`,
    confidence: 0.8,
  };
}

export const numistaService = {
  isConfigured(): boolean {
    return !!getIntegrationKey('numista');
  },

  async search(query: string, signal?: AbortSignal): Promise<NumistaSearchResult[]> {
    if (!query.trim()) return [];
    const data = await numistaFetch<NumistaSearchResponse>(
      '/types',
      { q: query.trim(), category: 'coin', count: '15' },
      signal,
    );
    return (data.types ?? []).map((type) => ({
      id: type.id,
      title: type.title ?? '',
      issuer: type.issuer?.name,
      minYear: type.min_year,
      maxYear: type.max_year,
      thumbnail: type.obverse_thumbnail || type.reverse_thumbnail || undefined,
    }));
  },

  async getType(id: number, signal?: AbortSignal): Promise<CatalogCandidate> {
    const type = await numistaFetch<NumistaType>(`/types/${id}`, {}, signal);
    return typeToCandidate(type);
  },
};
