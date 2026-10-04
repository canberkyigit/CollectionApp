import { DEFAULT_FILTERS, type FilterState } from '@/components/shared/advancedFilters.types';
import type { SortOrder } from '@/types';

/**
 * URL codec for collection browsing state (search, sort and AdvancedFilters).
 *
 * Keeps filters in the query string so back/forward, reloads and shared links
 * restore exactly what the user was looking at. Only non-default values are
 * written, so a plain `/collections/books` stays clean.
 *
 *   q=dune&sort=title&order=asc&cond=Mint&cond=Good&tag=signed&price=10-200
 *   &value=0-500&from=2024-01-01&to=2024-12-31&fav=1&img=1&read=unread
 *   &cur=EUR&f.binding=Hardcover&b.signed=1
 *
 * Ranges are stored "normalised": `[0, 0]` means unbounded, and an upper bound
 * of 0 means "up to the current maximum". Use `withRangeBounds` before handing
 * filters to the slider / filter helpers.
 */

export interface RangeBounds {
  maxPrice: number;
  maxValue: number;
}

export interface ViewSort {
  field: string;
  order: SortOrder;
}

export const VIEW_PARAM = {
  search: 'q',
  sort: 'sort',
  order: 'order',
  condition: 'cond',
  tag: 'tag',
  currency: 'cur',
  price: 'price',
  value: 'value',
  from: 'from',
  to: 'to',
  favorites: 'fav',
  images: 'img',
  read: 'read',
  library: 'library',
  view: 'view',
} as const;

const SELECT_PREFIX = 'f.';
const BOOLEAN_PREFIX = 'b.';

/** Keys that make up the filter + search "draft" (not sort, library or detail). */
const DRAFT_KEYS = new Set<string>([
  VIEW_PARAM.search,
  VIEW_PARAM.condition,
  VIEW_PARAM.tag,
  VIEW_PARAM.currency,
  VIEW_PARAM.price,
  VIEW_PARAM.value,
  VIEW_PARAM.from,
  VIEW_PARAM.to,
  VIEW_PARAM.favorites,
  VIEW_PARAM.images,
  VIEW_PARAM.read,
]);

function isDraftKey(key: string): boolean {
  return DRAFT_KEYS.has(key) || key.startsWith(SELECT_PREFIX) || key.startsWith(BOOLEAN_PREFIX);
}

function parseRange(raw: string | null): [number, number] {
  if (!raw) return [0, 0];
  const [rawMin, rawMax] = raw.split('-');
  const min = Number(rawMin);
  const max = Number(rawMax);
  const safeMin = Number.isFinite(min) && min > 0 ? min : 0;
  const safeMax = Number.isFinite(max) && max > 0 ? Math.max(max, safeMin) : 0;
  return [safeMin, safeMax];
}

function formatRange(range: [number, number]): string | null {
  const [min, max] = range;
  if (min <= 0 && max <= 0) return null;
  return `${Math.max(0, Math.round(min))}-${Math.max(0, Math.round(max))}`;
}

/** Collapses a slider range back to its normalised form (`[0, 0]` = unbounded). */
function normaliseRange(range: [number, number], max: number): [number, number] {
  const [lo, hi] = range;
  const safeLo = lo > 0 ? lo : 0;
  const safeHi = hi > 0 && (max <= 0 || hi < max) ? hi : 0;
  return [safeLo, safeHi];
}

function expandRange(range: [number, number], max: number): [number, number] {
  const [lo, hi] = range;
  return [lo, hi > 0 ? hi : Math.max(max, lo)];
}

/** Normalises ranges so the same filters produce the same URL whatever the current maxima are. */
export function normaliseFilters(filters: FilterState, bounds: RangeBounds): FilterState {
  return {
    ...filters,
    priceRange: normaliseRange(filters.priceRange, bounds.maxPrice),
    valueRange: normaliseRange(filters.valueRange, bounds.maxValue),
  };
}

/** Fills unbounded ranges with the current maxima (what sliders and filter helpers expect). */
export function withRangeBounds(filters: FilterState, bounds: RangeBounds): FilterState {
  return {
    ...filters,
    priceRange: expandRange(filters.priceRange, bounds.maxPrice),
    valueRange: expandRange(filters.valueRange, bounds.maxValue),
  };
}

export interface ViewDraft {
  search: string;
  /** Normalised filters (see `normaliseFilters`). */
  filters: FilterState;
}

export const EMPTY_DRAFT: ViewDraft = { search: '', filters: DEFAULT_FILTERS };

export function parseDraft(params: URLSearchParams): ViewDraft {
  const customSelects: Record<string, string[]> = {};
  const customBooleans: Record<string, boolean | null> = {};

  for (const key of new Set(params.keys())) {
    if (key.startsWith(SELECT_PREFIX)) {
      const values = params.getAll(key).filter(Boolean);
      if (values.length > 0) customSelects[key.slice(SELECT_PREFIX.length)] = values;
    } else if (key.startsWith(BOOLEAN_PREFIX)) {
      const value = params.get(key);
      if (value === '1' || value === '0') customBooleans[key.slice(BOOLEAN_PREFIX.length)] = value === '1';
    }
  }

  const images = params.get(VIEW_PARAM.images);
  const read = params.get(VIEW_PARAM.read);

  return {
    search: params.get(VIEW_PARAM.search) ?? '',
    filters: {
      ...DEFAULT_FILTERS,
      conditions: params.getAll(VIEW_PARAM.condition).filter(Boolean),
      tags: params.getAll(VIEW_PARAM.tag).filter(Boolean),
      currencies: params.getAll(VIEW_PARAM.currency).filter(Boolean),
      priceRange: parseRange(params.get(VIEW_PARAM.price)),
      valueRange: parseRange(params.get(VIEW_PARAM.value)),
      dateFrom: params.get(VIEW_PARAM.from) ?? '',
      dateTo: params.get(VIEW_PARAM.to) ?? '',
      favoritesOnly: params.get(VIEW_PARAM.favorites) === '1',
      hasImages: images === '1' ? true : images === '0' ? false : null,
      readStatus: read === 'read' || read === 'unread' ? read : 'all',
      customSelects,
      customBooleans,
    },
  };
}

/** Removes every search/filter key, leaving library, detail, sort and unrelated params alone. */
export function clearDraftParams(params: URLSearchParams): void {
  for (const key of [...new Set(params.keys())]) {
    if (isDraftKey(key)) params.delete(key);
  }
}

/** Writes a draft (normalised filters) into `params`, replacing any previous search/filter keys. */
export function writeDraftParams(params: URLSearchParams, draft: ViewDraft): void {
  clearDraftParams(params);
  const { search, filters } = draft;

  if (search.trim()) params.set(VIEW_PARAM.search, search);
  filters.conditions.forEach((value) => params.append(VIEW_PARAM.condition, value));
  filters.tags.forEach((value) => params.append(VIEW_PARAM.tag, value));
  filters.currencies.forEach((value) => params.append(VIEW_PARAM.currency, value));

  const price = formatRange(filters.priceRange);
  if (price) params.set(VIEW_PARAM.price, price);
  const value = formatRange(filters.valueRange);
  if (value) params.set(VIEW_PARAM.value, value);

  if (filters.dateFrom) params.set(VIEW_PARAM.from, filters.dateFrom);
  if (filters.dateTo) params.set(VIEW_PARAM.to, filters.dateTo);
  if (filters.favoritesOnly) params.set(VIEW_PARAM.favorites, '1');
  if (filters.hasImages !== null) params.set(VIEW_PARAM.images, filters.hasImages ? '1' : '0');
  if (filters.readStatus !== 'all') params.set(VIEW_PARAM.read, filters.readStatus);

  for (const [key, values] of Object.entries(filters.customSelects)) {
    values.forEach((option) => params.append(`${SELECT_PREFIX}${key}`, option));
  }
  for (const [key, flag] of Object.entries(filters.customBooleans)) {
    if (flag !== null) params.set(`${BOOLEAN_PREFIX}${key}`, flag ? '1' : '0');
  }
}

/** Stable string for the search/filter part of `params` — equal strings mean equal drafts. */
export function draftSignature(params: URLSearchParams): string {
  const entries = [...params.entries()].filter(([key]) => isDraftKey(key));
  entries.sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  return new URLSearchParams(entries).toString();
}

export function signatureOfDraft(draft: ViewDraft): string {
  const params = new URLSearchParams();
  writeDraftParams(params, draft);
  return draftSignature(params);
}

export function parseSortParams(params: URLSearchParams): ViewSort | null {
  const field = params.get(VIEW_PARAM.sort);
  if (!field) return null;
  return { field, order: params.get(VIEW_PARAM.order) === 'asc' ? 'asc' : 'desc' };
}

export function writeSortParams(params: URLSearchParams, sort: ViewSort | null): void {
  if (!sort) {
    params.delete(VIEW_PARAM.sort);
    params.delete(VIEW_PARAM.order);
    return;
  }
  params.set(VIEW_PARAM.sort, sort.field);
  params.set(VIEW_PARAM.order, sort.order);
}

/** True when the draft narrows the list in any way. */
export function isDraftActive(draft: ViewDraft): boolean {
  return signatureOfDraft(draft) !== '';
}
