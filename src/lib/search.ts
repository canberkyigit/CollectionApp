import type { Category, CollectionItem, Library } from '@/types';

/**
 * Shared search helpers (Topbar search, command palette).
 *
 * Matching is case-, accent- and Turkish-insensitive: "ı/İ/i", "ş/s", "ç/c",
 * "ğ/g", "ö/o", "ü/u" and any combining diacritics fold to plain ASCII, so
 * "sefik" finds "Şefik" and "ISIK" finds "ışık". Multi-word queries are AND-ed:
 * every word must appear somewhere in the item (title, tags, notes, location,
 * custom fields such as author / ISBN / catalogue number…).
 */

const TURKISH_FOLD: Record<string, string> = {
  ı: 'i',
  İ: 'i',
  ş: 's',
  Ş: 's',
  ç: 'c',
  Ç: 'c',
  ğ: 'g',
  Ğ: 'g',
  ö: 'o',
  Ö: 'o',
  ü: 'u',
  Ü: 'u',
};

export function normalizeSearchText(value: string): string {
  return value
    .replace(/[ıİşŞçÇğĞöÖüÜ]/g, (char) => TURKISH_FOLD[char] ?? char)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalised, de-duplicated query words. */
export function tokenizeQuery(query: string): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  return [...new Set(normalized.split(' '))];
}

/** True when every word of `query` occurs in at least one of `texts`. */
export function matchesQuery(query: string, ...texts: (string | null | undefined)[]): boolean {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return false;
  const haystack = texts.filter(Boolean).map((text) => normalizeSearchText(text as string)).join(' \u0000 ');
  return tokens.every((token) => haystack.includes(token));
}

/** Built-in item fields; anything else in `ItemSearchMatch.field` is a customFields key. */
export type BuiltInSearchField = 'title' | 'description' | 'tags' | 'notes' | 'location' | 'purchaseLocation' | 'condition';

interface IndexedField {
  field: string;
  /** Original (display) value. */
  value: string;
  normalized: string;
}

const indexCache = new WeakMap<CollectionItem, IndexedField[]>();

function stripMarkup(text: string): string {
  return text.includes('<') ? text.replace(/<[^>]+>/g, ' ') : text;
}

function valueToText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() ? stripMarkup(value) : null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => (typeof entry === 'string' || typeof entry === 'number' ? String(entry) : null))
      .filter((entry): entry is string => Boolean(entry && entry.trim()));
    return parts.length > 0 ? parts.join(', ') : null;
  }
  return null;
}

function indexItem(item: CollectionItem): IndexedField[] {
  const cached = indexCache.get(item);
  if (cached) return cached;

  const fields: IndexedField[] = [];
  const push = (field: string, value: unknown) => {
    const text = valueToText(value);
    if (!text) return;
    const normalized = normalizeSearchText(text);
    if (!normalized) return;
    // Skip custom-field copies of built-ins (e.g. customFields.title / customFields.notes).
    if (fields.some((entry) => entry.normalized === normalized)) return;
    fields.push({ field, value: text, normalized });
  };

  push('title', item.title);
  push('tags', item.tags);
  for (const [key, value] of Object.entries(item.customFields ?? {})) {
    push(key, value);
  }
  push('description', item.description);
  push('notes', item.notes);
  push('location', item.location);
  push('purchaseLocation', item.purchaseInfo?.purchaseLocation);
  push('condition', item.condition);

  indexCache.set(item, fields);
  return fields;
}

export interface ItemSearchMatch {
  item: CollectionItem;
  score: number;
  /**
   * Best non-title field that matched, for a "Author: Frank Herbert" hint.
   * Undefined when the title alone explains the match.
   */
  match?: { field: string; value: string };
}

export interface SearchItemsOptions {
  limit?: number;
  includeArchived?: boolean;
}

function scoreItem(item: CollectionItem, tokens: string[]): ItemSearchMatch | null {
  const fields = indexItem(item);
  let score = 0;
  let hint: ItemSearchMatch['match'];

  for (const token of tokens) {
    const hit = fields.find((entry) => entry.normalized.includes(token));
    if (!hit) return null;
    if (hit.field === 'title') {
      score += hit.normalized.startsWith(token) ? 6 : 4;
    } else {
      score += hit.field === 'tags' ? 3 : 2;
      if (!hint) hint = { field: hit.field, value: hit.value };
    }
  }

  const title = fields.find((entry) => entry.field === 'title')?.normalized ?? '';
  const fullQuery = tokens.join(' ');
  if (title === fullQuery) score += 10;
  else if (title.startsWith(fullQuery)) score += 5;

  return { item, score, match: hint };
}

/** Ranked item search over titles, tags, custom fields, notes, location… */
export function searchItems(
  items: CollectionItem[],
  query: string,
  { limit, includeArchived = false }: SearchItemsOptions = {},
): ItemSearchMatch[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  const matches: ItemSearchMatch[] = [];
  for (const item of items) {
    if (!includeArchived && item.isArchived) continue;
    const match = scoreItem(item, tokens);
    if (match) matches.push(match);
  }

  matches.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  return limit === undefined ? matches : matches.slice(0, limit);
}

export function searchCategories(categories: Category[], query: string, limit?: number): Category[] {
  const matches = categories.filter((category) => matchesQuery(query, category.name, category.description));
  return limit === undefined ? matches : matches.slice(0, limit);
}

export function searchLibraries(libraries: Library[], query: string, limit?: number): Library[] {
  const matches = libraries.filter((library) => matchesQuery(query, library.name));
  return limit === undefined ? matches : matches.slice(0, limit);
}

/**
 * Extracts an item id from a scanned Curio label. Labels encode
 * `<origin>/items/<id>`; any origin (localhost, desktop build, custom domain)
 * is accepted, as is a bare `/items/<id>` path.
 */
export function parseItemLink(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  let path = trimmed;
  try {
    path = new URL(trimmed).pathname;
  } catch {
    // Not an absolute URL — treat the text as a path.
  }

  const match = path.match(/(?:^|\/)items\/([^/?#\s]+)\/?(?:[?#].*)?$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  return id && id !== 'new' ? id : null;
}

const BUILT_IN_FIELD_KEYS: Record<BuiltInSearchField, string> = {
  title: 'nav.field.title',
  description: 'nav.field.description',
  tags: 'nav.field.tags',
  notes: 'nav.field.notes',
  location: 'nav.field.location',
  purchaseLocation: 'nav.field.purchaseLocation',
  condition: 'nav.field.condition',
};

/**
 * Human label for `ItemSearchMatch.match` — custom fields use the category's
 * field label, built-ins are translated via `translate`.
 */
export function describeSearchMatch(
  match: NonNullable<ItemSearchMatch['match']>,
  category: Pick<Category, 'fields'> | undefined,
  translate: (key: string) => string,
): string {
  const custom = category?.fields?.find((field) => field.key === match.field);
  const builtInKey = BUILT_IN_FIELD_KEYS[match.field as BuiltInSearchField];
  const label = custom?.label ?? (builtInKey ? translate(builtInKey) : match.field);
  const value = match.value.length > 60 ? `${match.value.slice(0, 57)}…` : match.value;
  return `${label}: ${value}`;
}
