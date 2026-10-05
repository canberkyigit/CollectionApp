import { describe, expect, it } from 'vitest';

import { buildExhibitionSlides, countSlides, getHighlights, isSameSource } from '@/lib/exhibition';
import { buildSeedData } from '@/test/seed';
import type { CollectionItem } from '@/types';

describe('exhibition slides', () => {
  const seed = buildSeedData();

  it('shows only photographed, non-archived items by default and respects the source', () => {
    const items: CollectionItem[] = [
      ...seed.items,
      { ...seed.items[0], id: 'archived', isArchived: true },
    ];
    const all = buildExhibitionSlides(items, seed.categories, { source: 'all', onlyWithPhotos: true, shuffle: false });
    expect(all.every((slide) => slide.image)).toBe(true);
    expect(all.map((slide) => slide.item.id)).not.toContain('archived');

    const withoutPhotos = buildExhibitionSlides(items, seed.categories, { source: 'all', onlyWithPhotos: false, shuffle: false });
    expect(withoutPhotos.length).toBeGreaterThan(all.length);

    const vinyl = buildExhibitionSlides(items, seed.categories, { source: { categoryId: 'cat-vinyl' }, onlyWithPhotos: false, shuffle: false });
    expect(vinyl.every((slide) => slide.item.categoryId === 'cat-vinyl')).toBe(true);

    const favorites = buildExhibitionSlides(items, seed.categories, { source: 'favorites', onlyWithPhotos: false, shuffle: false });
    expect(favorites.every((slide) => slide.item.isFavorite)).toBe(true);
    expect(countSlides(items, 'favorites', false)).toBe(favorites.length);
  });

  it('shuffles deterministically for the same seed', () => {
    const many: CollectionItem[] = Array.from({ length: 12 }, (_, index) => ({
      ...seed.items[0], id: `item-${index}`, images: [`https://example.com/${index}.jpg`],
    }));
    const options = { source: 'all' as const, onlyWithPhotos: true, shuffle: true, seed: 42 };
    const first = buildExhibitionSlides(many, seed.categories, options).map((slide) => slide.item.id);
    const second = buildExhibitionSlides(many, seed.categories, options).map((slide) => slide.item.id);
    const other = buildExhibitionSlides(many, seed.categories, { ...options, seed: 7 }).map((slide) => slide.item.id);
    expect(first).toEqual(second);
    expect(first).not.toEqual(other);
    expect([...first].sort()).toEqual(many.map((item) => item.id).sort());
  });

  it('builds short highlights from the category fields, skipping ISBN and empty values', () => {
    const books = seed.categories.find((category) => category.id === 'cat-books')!;
    const dune = seed.items.find((item) => item.title === 'Dune')!;
    const highlights = getHighlights({ ...dune, customFields: { ...dune.customFields, author: 'Frank Herbert', isbn: '978', publisher: '' } }, books);
    expect(highlights.map((entry) => entry.key)).toContain('author');
    expect(highlights.map((entry) => entry.key)).not.toContain('isbn');
    expect(highlights.map((entry) => entry.key)).not.toContain('publisher');
  });

  it('compares sources', () => {
    expect(isSameSource('all', 'all')).toBe(true);
    expect(isSameSource({ categoryId: 'a' }, { categoryId: 'a' })).toBe(true);
    expect(isSameSource({ categoryId: 'a' }, 'all')).toBe(false);
  });
});
