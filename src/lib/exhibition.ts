import type { Category, CategoryField, CollectionItem } from '@/types';

/**
 * What the exhibition shows: every collection, the favourites, one collection,
 * or a saved (hand-ordered) exhibition.
 */
export type ExhibitionSource =
  | 'all'
  | 'favorites'
  | { categoryId: string }
  | { exhibitionId: string; itemIds: string[] };

export interface ExhibitionHighlight {
  key: string;
  label: string;
  value: string;
}

export interface ExhibitionSlide {
  item: CollectionItem;
  category: Category | undefined;
  /** Cover photo, or null when the item has none (only when photos aren't required). */
  image: string | null;
  /** Up to three short facts from the category's own fields (author, year, maker…). */
  highlights: ExhibitionHighlight[];
}

export interface ExhibitionOptions {
  source: ExhibitionSource;
  onlyWithPhotos: boolean;
  shuffle: boolean;
  /** Seed for a stable shuffle (same order while the options stay the same). */
  seed?: number;
  /** Formats booleans for highlights, e.g. Yes / No in the current language. */
  formatBoolean?: (value: boolean) => string;
}

const HIGHLIGHT_TYPES = new Set<CategoryField['type']>(['text', 'number', 'select', 'date', 'boolean']);
const SKIPPED_KEYS = new Set([
  'title', 'notes', 'condition', 'quantity', 'purchaseDate', 'purchasePrice', 'purchaseCurrency',
  'currentValue', 'estimatedValue', 'isbn', 'barcode', 'serialNumber',
]);
const MAX_HIGHLIGHTS = 3;

export function isSameSource(a: ExhibitionSource, b: ExhibitionSource): boolean {
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  if ('exhibitionId' in a || 'exhibitionId' in b) {
    return 'exhibitionId' in a && 'exhibitionId' in b && a.exhibitionId === b.exhibitionId;
  }
  return a.categoryId === b.categoryId;
}

function matchesSource(item: CollectionItem, source: ExhibitionSource): boolean {
  if (source === 'all') return true;
  if (source === 'favorites') return item.isFavorite;
  if ('exhibitionId' in source) return source.itemIds.includes(item.id);
  return item.categoryId === source.categoryId;
}

function coverImage(item: CollectionItem): string | null {
  return item.images?.find((image) => typeof image === 'string' && image.length > 0) ?? null;
}

export function getHighlights(
  item: CollectionItem,
  category: Category | undefined,
  formatBoolean: (value: boolean) => string = (value) => (value ? 'Yes' : 'No'),
): ExhibitionHighlight[] {
  if (!category) return [];
  const highlights: ExhibitionHighlight[] = [];
  for (const field of category.fields) {
    if (highlights.length >= MAX_HIGHLIGHTS) break;
    if (SKIPPED_KEYS.has(field.key) || !HIGHLIGHT_TYPES.has(field.type)) continue;
    const raw = item.customFields?.[field.key];
    if (raw === undefined || raw === null || raw === '') continue;
    // Booleans only earn a spot when true (e.g. "Signed: Yes"); "No" isn't worth a caption line.
    if (field.type === 'boolean' && raw !== true) continue;
    const value = typeof raw === 'boolean' ? formatBoolean(raw) : String(raw).trim();
    if (!value || value.length > 48) continue;
    highlights.push({ key: field.key, label: field.label, value });
  }
  return highlights;
}

/** Deterministic Fisher–Yates (mulberry32) so a shuffled show keeps its order. */
function shuffled<T>(list: T[], seed: number): T[] {
  const result = [...list];
  let state = seed >>> 0 || 1;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Slides for the exhibition, in collection order (by category order, then
 * newest first) unless shuffled. Archived items never appear.
 */
export function buildExhibitionSlides(
  items: CollectionItem[],
  categories: Category[],
  { source, onlyWithPhotos, shuffle, seed = 1, formatBoolean }: ExhibitionOptions,
): ExhibitionSlide[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const order = new Map(categories.map((category, index) => [category.id, category.order ?? index]));

  const selected = items
    .filter((item) => !item.isArchived && matchesSource(item, source))
    .filter((item) => !onlyWithPhotos || coverImage(item) !== null)
    .sort((a, b) => {
      // A saved exhibition plays in the order it was curated.
      if (typeof source === 'object' && 'exhibitionId' in source) {
        return source.itemIds.indexOf(a.id) - source.itemIds.indexOf(b.id);
      }
      const byCategory = (order.get(a.categoryId) ?? 999) - (order.get(b.categoryId) ?? 999);
      if (byCategory !== 0) return byCategory;
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });

  const ordered = shuffle ? shuffled(selected, seed) : selected;
  return ordered.map((item) => {
    const category = categoryById.get(item.categoryId);
    return { item, category, image: coverImage(item), highlights: getHighlights(item, category, formatBoolean) };
  });
}

/** Number of slides each source would produce — used for the source picker. */
export function countSlides(
  items: CollectionItem[],
  source: ExhibitionSource,
  onlyWithPhotos: boolean,
): number {
  return items.filter((item) => !item.isArchived && matchesSource(item, source) && (!onlyWithPhotos || coverImage(item) !== null)).length;
}

/* ───────────────────────── Smart (ready-made) exhibitions ───────────────────────── */

export type SmartPreset = 'topValue' | 'addedThisYear' | 'recentlyAcquired' | 'random' | 'chronological';

export const SMART_PRESETS: SmartPreset[] = ['topValue', 'addedThisYear', 'recentlyAcquired', 'random', 'chronological'];

const SMART_PREFIX = 'smart:';
const SMART_LIMITS: Partial<Record<SmartPreset, number>> = { topValue: 10, recentlyAcquired: 15, random: 15 };

export function smartExhibitionId(preset: SmartPreset): string {
  return `${SMART_PREFIX}${preset}`;
}

export function parseSmartExhibitionId(id: string): SmartPreset | null {
  if (!id.startsWith(SMART_PREFIX)) return null;
  const preset = id.slice(SMART_PREFIX.length) as SmartPreset;
  return SMART_PRESETS.includes(preset) ? preset : null;
}

/** The item's year from a numeric "year"-like custom field (publishYear, year…); negative = BC. */
export function getItemYear(item: CollectionItem): number | null {
  for (const [key, raw] of Object.entries(item.customFields ?? {})) {
    if (!/year/i.test(key)) continue;
    const year = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (Number.isFinite(year) && year !== 0 && Math.abs(year) < 10_000) return Math.trunc(year);
  }
  return null;
}

interface SmartPresetOptions {
  onlyWithPhotos: boolean;
  /** Current value of an item in the display currency (for "most valuable"). */
  valueOf: (item: CollectionItem) => number;
  /** Seed for the random selection. */
  seed?: number;
  now?: Date;
}

/**
 * Ordered item ids for a ready-made exhibition. Photo filtering happens
 * before the limit, so "Top 10" really shows ten slides when photos are required.
 */
export function getSmartPresetItemIds(
  preset: SmartPreset,
  items: CollectionItem[],
  { onlyWithPhotos, valueOf, seed = 1, now = new Date() }: SmartPresetOptions,
): string[] {
  const pool = items.filter((item) => !item.isArchived && (!onlyWithPhotos || coverImage(item) !== null));
  const limit = SMART_LIMITS[preset];
  let ordered: CollectionItem[];

  switch (preset) {
    case 'topValue':
      ordered = pool
        .map((item) => ({ item, value: valueOf(item) }))
        .filter((entry) => entry.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((entry) => entry.item);
      break;
    case 'addedThisYear': {
      const year = now.getFullYear();
      ordered = pool
        .filter((item) => new Date(item.createdAt).getFullYear() === year)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    }
    case 'recentlyAcquired':
      ordered = pool
        .filter((item) => Boolean(item.purchaseInfo?.purchasedAt))
        .sort((a, b) => b.purchaseInfo.purchasedAt.localeCompare(a.purchaseInfo.purchasedAt));
      break;
    case 'random':
      ordered = shuffled(pool, seed);
      break;
    case 'chronological':
      ordered = pool
        .map((item) => ({ item, year: getItemYear(item) }))
        .filter((entry): entry is { item: CollectionItem; year: number } => entry.year !== null)
        .sort((a, b) => a.year - b.year || a.item.title.localeCompare(b.item.title))
        .map((entry) => entry.item);
      break;
    default:
      ordered = [];
  }

  return (limit ? ordered.slice(0, limit) : ordered).map((item) => item.id);
}
