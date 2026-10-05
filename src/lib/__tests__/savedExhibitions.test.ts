import { beforeEach, describe, expect, it } from 'vitest';

import { buildExhibitionSlides } from '@/lib/exhibition';
import { filterExhibitions, useSavedExhibitionsStore } from '@/lib/savedExhibitions';
import { buildSeedData } from '@/test/seed';
import type { CollectionItem } from '@/types';

describe('saved exhibitions', () => {
  beforeEach(() => {
    useSavedExhibitionsStore.setState({ exhibitions: [] });
  });

  it('adds, renames, reorders and removes exhibitions, de-duplicating items', () => {
    const store = useSavedExhibitionsStore.getState();
    const created = store.addExhibition({ name: '  Istanbul selection ', itemIds: ['a', 'b', 'a'], ownerUserId: 'u1' });
    expect(created.name).toBe('Istanbul selection');
    expect(created.itemIds).toEqual(['a', 'b']);

    useSavedExhibitionsStore.getState().updateExhibition(created.id, { name: ' ', itemIds: ['b', 'a', 'c'] });
    const updated = useSavedExhibitionsStore.getState().exhibitions[0];
    expect(updated.name).toBe('Istanbul selection');
    expect(updated.itemIds).toEqual(['b', 'a', 'c']);

    useSavedExhibitionsStore.getState().removeExhibition(created.id);
    expect(useSavedExhibitionsStore.getState().exhibitions).toHaveLength(0);
  });

  it('keeps each owner\'s exhibitions separate', () => {
    const store = useSavedExhibitionsStore.getState();
    store.addExhibition({ name: 'Mine', itemIds: ['a'], ownerUserId: 'u1' });
    store.addExhibition({ name: 'Theirs', itemIds: ['a'], ownerUserId: 'u2' });
    const mine = filterExhibitions(useSavedExhibitionsStore.getState().exhibitions, 'u1');
    expect(mine.map((exhibition) => exhibition.name)).toEqual(['Mine']);
  });

  it('plays a saved exhibition in its curated order and skips archived pieces', () => {
    const seed = buildSeedData();
    const items: CollectionItem[] = seed.items.map((item, index) => ({ ...item, images: [`https://example.com/${index}.jpg`] }));
    const [first, second] = items;
    const archived = { ...items[0], id: 'gone', isArchived: true };
    const slides = buildExhibitionSlides([...items, archived], seed.categories, {
      source: { exhibitionId: 'x', itemIds: [second.id, 'gone', first.id] },
      onlyWithPhotos: true,
      shuffle: false,
    });
    expect(slides.map((slide) => slide.item.id)).toEqual([second.id, first.id]);
  });
});
