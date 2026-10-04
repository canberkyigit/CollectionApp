import type { CollectionItem } from '@/types';
import { normalizeISBNForDuplicate, normalizeTitleForDuplicate } from '@/lib/duplicates';
import { normalizeSearchText } from '@/lib/search';

export interface DuplicateGroup {
  key: string;
  reason: 'title' | 'isbn';
  items: CollectionItem[];
  categoryName: string;
}

/**
 * Title key for duplicate matching: case-, punctuation-, accent- and
 * Turkish-insensitive, so "Şeker Portakalı" and "Seker portakali" collide.
 */
export function duplicateTitleKey(title: string): string {
  return normalizeTitleForDuplicate(normalizeSearchText(title));
}

export function findDuplicateGroups(
  items: CollectionItem[],
  categoryNameById: Map<string, string>,
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const byCategory = new Map<string, CollectionItem[]>();
  for (const item of items) {
    if (item.isArchived) continue;
    const bucket = byCategory.get(item.categoryId) ?? [];
    bucket.push(item);
    byCategory.set(item.categoryId, bucket);
  }

  for (const [categoryId, categoryItems] of byCategory) {
    const categoryName = categoryNameById.get(categoryId) ?? categoryId;

    const byTitle = new Map<string, CollectionItem[]>();
    for (const item of categoryItems) {
      const key = duplicateTitleKey(item.title);
      if (!key) continue;
      const bucket = byTitle.get(key) ?? [];
      bucket.push(item);
      byTitle.set(key, bucket);
    }
    for (const [titleKey, dupes] of byTitle) {
      if (dupes.length > 1) {
        groups.push({ key: `title-${categoryId}-${titleKey}`, reason: 'title', items: dupes, categoryName });
      }
    }

    const byIsbn = new Map<string, CollectionItem[]>();
    for (const item of categoryItems) {
      const isbn = normalizeISBNForDuplicate(item.customFields?.isbn);
      if (!isbn) continue;
      const bucket = byIsbn.get(isbn) ?? [];
      bucket.push(item);
      byIsbn.set(isbn, bucket);
    }
    for (const [isbnKey, dupes] of byIsbn) {
      if (dupes.length < 2) continue;
      const alreadyCovered = groups.some(
        (group) => group.reason === 'title' && dupes.every((dupe) => group.items.some((item) => item.id === dupe.id)),
      );
      if (!alreadyCovered) {
        groups.push({ key: `isbn-${categoryId}-${isbnKey}`, reason: 'isbn', items: dupes, categoryName });
      }
    }
  }

  return groups;
}
