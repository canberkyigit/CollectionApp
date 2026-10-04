import type { CategoryField, ItemSourceMetadata } from '@/types';
import { bookSearchService, type BookSearchResult } from '@/services/bookSearchService';
import { ITEM_FORM_HIDDEN_CUSTOM_KEYS } from '@/lib/itemForm';
import { formatCurrency } from '@/lib/utils';
import { t } from '@/i18n';

/* ------------------------------------------------------------------ */
/* Open Library (books) — applied directly on selection                */
/* ------------------------------------------------------------------ */

export interface CatalogSuggestion {
  provider: 'openlibrary';
  kind: 'books';
  title: string;
  description: string;
  customFields: Record<string, unknown>;
  images: string[];
  confidence: number;
  sourceMetadata: ItemSourceMetadata;
}

function buildOpenLibraryUrl(key: string): string {
  return key.startsWith('/works/')
    ? `https://openlibrary.org${key}`
    : `https://openlibrary.org/search?q=${encodeURIComponent(key)}`;
}

function getFilledFields(book: BookSearchResult): string[] {
  return [
    'title',
    'description',
    'author',
    book.publishYear ? 'publishYear' : '',
    book.publisher ? 'publisher' : '',
    book.isbn ? 'isbn' : '',
    book.languages.length > 0 ? 'language' : '',
    book.pageCount ? 'pageCount' : '',
    book.coverUrlLarge ? 'images' : '',
  ].filter(Boolean);
}

function fromBookSearchResult(book: BookSearchResult): CatalogSuggestion {
  const fields = getFilledFields(book);
  const description = book.publishYear
    ? t('itemForm.lookup.bookDescriptionYear', { title: book.title, author: book.author, year: book.publishYear })
    : t('itemForm.lookup.bookDescription', { title: book.title, author: book.author });

  return {
    provider: 'openlibrary',
    kind: 'books',
    title: book.title,
    description,
    customFields: {
      title: book.title,
      author: book.author,
      ...(book.publishYear ? { publishYear: book.publishYear } : {}),
      ...(book.publisher ? { publisher: book.publisher } : {}),
      ...(book.isbn ? { isbn: book.isbn } : {}),
      ...(book.languages.length > 0 ? { language: book.languages[0] } : {}),
      ...(book.pageCount ? { pageCount: book.pageCount } : {}),
    },
    images: book.coverUrlLarge ? [book.coverUrlLarge] : [],
    confidence: book.isbn ? 0.95 : 0.78,
    sourceMetadata: {
      provider: 'openlibrary',
      externalId: book.key,
      externalUrl: buildOpenLibraryUrl(book.key),
      importedAt: new Date().toISOString(),
      confidence: book.isbn ? 0.95 : 0.78,
      fields,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Reviewable candidates (Claude, Discogs, Numista)                    */
/* ------------------------------------------------------------------ */

export type CatalogProvider = 'claude' | 'discogs' | 'numista';

export type CatalogLookupErrorCode =
  | 'no-key'
  | 'auth'
  | 'rate-limit'
  | 'network'
  | 'not-found'
  | 'refusal'
  | 'invalid-response'
  | 'no-image'
  | 'api';

/** Typed failure from any lookup provider — the UI maps `code` to a translated message. */
export class CatalogLookupError extends Error {
  readonly code: CatalogLookupErrorCode;
  readonly provider: CatalogProvider;

  constructor(code: CatalogLookupErrorCode, provider: CatalogProvider, detail?: string) {
    super(detail ? `${provider}: ${code} (${detail})` : `${provider}: ${code}`);
    this.name = 'CatalogLookupError';
    this.code = code;
    this.provider = provider;
  }
}

/** A value for a category field, matched by any of `keys` against field key or label. */
export interface CandidateField {
  keys: string[];
  value: string | number | boolean;
}

export interface CandidateValue {
  /** Point value to store as current value. Derived from low/high when absent. */
  amount?: number;
  low?: number;
  high?: number;
  currency: string;
  basis: 'estimate' | 'lowest-listing';
}

/** Provider-neutral lookup result, turned into per-field review rows. */
export interface CatalogCandidate {
  provider: CatalogProvider;
  title?: string;
  description?: string;
  tags?: string[];
  condition?: string;
  fields: CandidateField[];
  images?: string[];
  estimatedValue?: CandidateValue;
  externalId?: string;
  externalUrl?: string;
  confidence?: number;
}

export type ReviewTarget =
  | { kind: 'title' }
  | { kind: 'description' }
  | { kind: 'tags' }
  | { kind: 'condition' }
  | { kind: 'customField'; key: string }
  | { kind: 'image'; url: string }
  | { kind: 'currentValue'; currency: string; source: string };

export interface ReviewField {
  id: string;
  target: ReviewTarget;
  label: string;
  /** Value written to the form when applied. */
  value: unknown;
  display: string;
  /** Display of what the form holds now ('' when empty). */
  current: string;
  /** True when applying would replace something the user already entered. */
  conflict: boolean;
}

export interface ReviewContext {
  fields: CategoryField[];
  conditionOptions: string[];
  current: {
    title?: string;
    description?: string;
    tags?: string;
    condition?: string;
    customFields: Record<string, unknown>;
    currentValue?: number | string;
    currentValueCurrency?: string;
    images: string[];
  };
}

const TURKISH_FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };

export function normalizeFieldName(value: string): string {
  return value
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, (char) => TURKISH_FOLD[char] ?? char)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || value === false
    || (typeof value === 'string' && !value.trim())
    || (Array.isArray(value) && value.length === 0);
}

function displayValue(value: unknown): string {
  if (value === true) return t('common.yes');
  if (value === false) return t('common.no');
  if (Array.isArray(value)) return value.join(', ');
  if (value === undefined || value === null) return '';
  return String(value);
}

function matchOption(options: string[], raw: string): string | undefined {
  const value = raw.trim().toLowerCase();
  if (!value) return undefined;
  const exact = options.find((option) => option.toLowerCase() === value);
  if (exact) return exact;
  const contained = options.find((option) => option.length > 1 && value.includes(option.toLowerCase()));
  if (contained) return contained;
  return options.find((option) => value.length > 1 && option.toLowerCase().includes(value));
}

/** Coerce a raw suggestion into the shape the form stores for this field type, or undefined to skip. */
export function coerceFieldValue(field: CategoryField, raw: string | number | boolean): unknown {
  const text = String(raw).trim();
  switch (field.type) {
    case 'number':
    case 'currency': {
      if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
      // First number in the text: "1969–1972" → 1969, "7,5 g" → 7.5.
      const match = /-?\d+(?:[.,]\d+)?/.exec(text);
      const parsed = match ? Number.parseFloat(match[0].replace(',', '.')) : Number.NaN;
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return raw;
      if (/^(true|yes|evet|1)$/i.test(text)) return true;
      if (/^(false|no|hayır|hayir|0)$/i.test(text)) return false;
      return undefined;
    }
    case 'select':
      if (!field.options?.length) return text || undefined;
      return matchOption(field.options, text);
    case 'multi-select': {
      const options = field.options ?? [];
      const picked = text.split(/[,;]/).map((part) => matchOption(options, part)).filter(Boolean);
      return picked.length ? [...new Set(picked)].join(', ') : undefined;
    }
    case 'date': {
      if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
      return undefined;
    }
    case 'image':
      return undefined;
    default:
      return text || undefined;
  }
}

function findCandidateValue(field: CategoryField, candidates: CandidateField[]): CandidateField | undefined {
  const names = new Set([normalizeFieldName(field.key), normalizeFieldName(field.label)]);
  return candidates.find((candidate) => candidate.keys.some((key) => names.has(normalizeFieldName(key))));
}

function sameValue(a: unknown, b: unknown): boolean {
  return normalizeFieldName(displayValue(a)) === normalizeFieldName(displayValue(b));
}

function pushRow(rows: ReviewField[], row: Omit<ReviewField, 'conflict' | 'current'>, current: unknown) {
  if (isEmptyValue(row.value)) return;
  if (!isEmptyValue(current) && sameValue(current, row.value)) return;
  rows.push({ ...row, current: displayValue(current), conflict: !isEmptyValue(current) });
}

/**
 * Turn a lookup candidate into review rows: only fields the category has,
 * values coerced to the field type, unchanged values dropped, and rows that
 * would overwrite user input flagged as conflicts (unticked by default).
 */
export function buildReviewFields(candidate: CatalogCandidate, context: ReviewContext): ReviewField[] {
  const rows: ReviewField[] = [];
  const { current } = context;

  if (candidate.title) {
    pushRow(rows, { id: 'title', target: { kind: 'title' }, label: t('itemForm.field.title'), value: candidate.title.trim(), display: candidate.title.trim() }, current.title);
  }

  for (const field of context.fields) {
    if (ITEM_FORM_HIDDEN_CUSTOM_KEYS.has(field.key)) continue;
    const match = findCandidateValue(field, candidate.fields);
    if (!match) continue;
    const value = coerceFieldValue(field, match.value);
    if (value === undefined) continue;
    pushRow(rows, {
      id: `cf:${field.key}`,
      target: { kind: 'customField', key: field.key },
      label: field.label,
      value,
      display: displayValue(value),
    }, current.customFields[field.key]);
  }

  if (candidate.description) {
    pushRow(rows, { id: 'description', target: { kind: 'description' }, label: t('itemForm.field.description'), value: candidate.description.trim(), display: candidate.description.trim() }, current.description);
  }

  if (candidate.condition) {
    const condition = matchOption(context.conditionOptions, candidate.condition);
    if (condition) {
      pushRow(rows, { id: 'condition', target: { kind: 'condition' }, label: t('itemForm.field.condition'), value: condition, display: condition }, current.condition);
    }
  }

  if (candidate.tags?.length) {
    const existing = (current.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
    const lower = new Set(existing.map((tag) => tag.toLowerCase()));
    const added = candidate.tags.map((tag) => tag.trim()).filter((tag) => tag && !lower.has(tag.toLowerCase()));
    if (added.length) {
      // Tags are merged, never replaced — so this row is never a conflict.
      rows.push({
        id: 'tags',
        target: { kind: 'tags' },
        label: t('itemForm.field.tags'),
        value: [...existing, ...added].join(', '),
        display: added.join(', '),
        current: existing.join(', '),
        conflict: false,
      });
    }
  }

  const estimate = candidate.estimatedValue;
  if (estimate) {
    const amount = estimate.amount ?? (
      estimate.low !== undefined && estimate.high !== undefined
        ? Math.round((estimate.low + estimate.high) / 2)
        : estimate.low ?? estimate.high
    );
    if (amount !== undefined && amount > 0) {
      const range = estimate.low !== undefined && estimate.high !== undefined && estimate.low !== estimate.high
        ? `${formatCurrency(estimate.low, estimate.currency)} – ${formatCurrency(estimate.high, estimate.currency)}`
        : formatCurrency(amount, estimate.currency);
      const source = estimate.basis === 'lowest-listing'
        ? t('itemForm.review.valueSourceListing', { provider: providerLabel(candidate.provider) })
        : t('itemForm.review.valueSourceEstimate', { provider: providerLabel(candidate.provider), range });
      const currentAmount = Number(current.currentValue) || 0;
      rows.push({
        id: 'currentValue',
        target: { kind: 'currentValue', currency: estimate.currency, source },
        label: estimate.basis === 'lowest-listing' ? t('itemForm.review.lowestListing') : t('itemForm.review.estimatedValue'),
        value: amount,
        display: estimate.basis === 'lowest-listing' ? formatCurrency(amount, estimate.currency) : range,
        current: currentAmount > 0 ? formatCurrency(currentAmount, current.currentValueCurrency || estimate.currency) : '',
        conflict: currentAmount > 0,
      });
    }
  }

  for (const url of candidate.images ?? []) {
    if (current.images.includes(url)) continue;
    rows.push({
      id: `image:${url}`,
      target: { kind: 'image', url },
      label: t('itemForm.review.photo'),
      value: url,
      display: url,
      current: '',
      conflict: false,
    });
  }

  return rows;
}

export function providerLabel(provider: CatalogProvider | 'openlibrary'): string {
  switch (provider) {
    case 'claude': return 'Claude';
    case 'discogs': return 'Discogs';
    case 'numista': return 'Numista';
    default: return 'Open Library';
  }
}

export function buildCandidateSourceMetadata(candidate: CatalogCandidate, appliedFieldIds: string[]): ItemSourceMetadata {
  return {
    provider: candidate.provider,
    ...(candidate.externalId ? { externalId: candidate.externalId } : {}),
    ...(candidate.externalUrl ? { externalUrl: candidate.externalUrl } : {}),
    importedAt: new Date().toISOString(),
    ...(candidate.confidence !== undefined ? { confidence: candidate.confidence } : {}),
    fields: appliedFieldIds.map((id) => id.replace(/^cf:/, '').replace(/^image:.*/, 'images'))
      .filter((id, index, list) => list.indexOf(id) === index),
  };
}

export const catalogEnrichmentService = {
  fromBookSearchResult,
  buildReviewFields,
  buildCandidateSourceMetadata,

  async searchBooks(query: string, limit = 10): Promise<CatalogSuggestion[]> {
    const books = await bookSearchService.search(query, limit);
    return books.map(fromBookSearchResult);
  },

  async searchBookByISBN(isbn: string): Promise<CatalogSuggestion | null> {
    const book = await bookSearchService.searchByISBN(isbn);
    return book ? fromBookSearchResult(book) : null;
  },
};
