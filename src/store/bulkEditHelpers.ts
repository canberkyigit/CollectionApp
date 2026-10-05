/**
 * Pure helpers behind the bulk-edit and tag-manager store actions.
 * Kept separate from the slice so they can be unit-tested in isolation.
 */
import type { CollectionItem } from '@/types';

export interface TagUsage {
  tag: string;
  count: number;
}

/** Every tag in use (case-sensitive, trimmed) with how many items carry it, most used first. */
export function collectTagUsage(items: CollectionItem[]): TagUsage[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of new Set(item.tags.map((entry) => entry.trim()).filter(Boolean))) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}

/**
 * Replaces every tag in `sources` with `target` on one item, keeping the
 * original position of the first replaced tag and removing duplicates.
 * Returns null when the item carries none of the source tags.
 */
export function replaceTagsOnItem(tags: string[], sources: string[], target: string): string[] | null {
  const sourceSet = new Set(sources);
  if (!tags.some((tag) => sourceSet.has(tag))) return null;
  const next: string[] = [];
  for (const tag of tags) {
    const value = sourceSet.has(tag) ? target : tag;
    if (value && !next.includes(value)) next.push(value);
  }
  return next;
}

export interface TagRewriteResult {
  items: CollectionItem[];
  changedIds: string[];
}

/**
 * Renames / merges tags across items. With an empty `target` the source tags
 * are removed instead. Archived items are included so tags stay consistent.
 */
export function rewriteTags(
  items: CollectionItem[],
  sources: string[],
  target: string,
  now: string,
): TagRewriteResult {
  const cleanSources = sources.map((tag) => tag.trim()).filter(Boolean);
  const cleanTarget = target.trim();
  const changedIds: string[] = [];
  if (cleanSources.length === 0) return { items, changedIds };

  const nextItems = items.map((item) => {
    const nextTags = cleanTarget
      ? replaceTagsOnItem(item.tags, cleanSources, cleanTarget)
      : item.tags.some((tag) => cleanSources.includes(tag))
        ? item.tags.filter((tag) => !cleanSources.includes(tag))
        : null;
    if (!nextTags) return item;
    changedIds.push(item.id);
    return { ...item, tags: nextTags, updatedAt: now };
  });

  return { items: nextItems, changedIds };
}

/** Appends a value-history entry for `date` unless one already exists for that day. */
export function withCurrentValue(
  item: CollectionItem,
  value: number,
  currency: string,
  date: string,
  now: string,
): CollectionItem {
  const history = item.valuationInfo.valueHistory ?? [];
  const valueHistory = value > 0
    ? [...history.filter((entry) => entry.date !== date), { date, value, currency }]
    : history;
  return {
    ...item,
    valuationInfo: {
      ...item.valuationInfo,
      currentEstimatedValue: value,
      currentValueCurrency: currency,
      valueHistory,
    },
    updatedAt: now,
  };
}
