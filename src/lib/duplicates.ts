import type { CollectionItem } from '@/types';

export function normalizeTitleForDuplicate(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeISBNForDuplicate(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[^0-9Xx]/g, '').toUpperCase();
}

function uniqueByValue<T>(values: T[], getKey: (value: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const value of values) {
    const key = getKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result;
}

function newestItem(items: CollectionItem[]): CollectionItem {
  return [...items].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  )[0];
}

export function mergeDuplicateItems(primary: CollectionItem, duplicates: CollectionItem[]): Partial<CollectionItem> {
  const sources = [primary, ...duplicates];
  const newest = newestItem(sources);
  const tags = Array.from(new Set(sources.flatMap((item) => item.tags)));
  const images = Array.from(new Set(sources.flatMap((item) => item.images)));
  const valueHistory = uniqueByValue(
    sources.flatMap((item) => item.valuationInfo.valueHistory ?? []),
    (entry) => `${entry.date}:${entry.currency}:${entry.value}`,
  ).sort((left, right) => left.date.localeCompare(right.date));
  const maintenanceLog = uniqueByValue(
    sources.flatMap((item) => item.maintenanceLog ?? []),
    (entry) => entry.id,
  );
  const lendingHistory = uniqueByValue(
    sources.flatMap((item) => item.lendingHistory ?? []),
    (entry) => entry.id,
  );
  const documents = uniqueByValue(
    sources.flatMap((item) => item.documents ?? []),
    (entry) => entry.id,
  );

  return {
    title: newest.title || primary.title,
    description: newest.description || primary.description,
    customFields: {
      ...primary.customFields,
      ...duplicates.reduce<Record<string, unknown>>(
        (fields, item) => ({ ...fields, ...item.customFields }),
        {},
      ),
      ...newest.customFields,
    },
    notes: [primary.notes, ...duplicates.map((item) => item.notes)]
      .map((entry) => entry?.trim())
      .filter(Boolean)
      .join('\n\n'),
    tags,
    images,
    purchaseInfo: newest.purchaseInfo,
    valuationInfo: {
      ...newest.valuationInfo,
      valueHistory,
    },
    condition: newest.condition || primary.condition,
    location: newest.location ?? primary.location,
    quantity: sources.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0),
    isRead: sources.some((item) => item.isRead),
    isFavorite: sources.some((item) => item.isFavorite),
    maintenanceLog,
    lendingHistory,
    documents,
    sourceMetadata: newest.sourceMetadata ?? primary.sourceMetadata,
  };
}
