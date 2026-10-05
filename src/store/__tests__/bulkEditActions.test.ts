import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCollectionStore } from '@/store/useCollectionStore';
import { createMockItem } from '@/test/helpers';

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return { ...actual, toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } };
});

function reset() {
  useCollectionStore.setState({
    items: [],
    categories: [],
    libraries: [],
    wishlist: [],
    activityLog: [],
    contributors: [],
  });
}

describe('bulk edit + tag store actions', () => {
  beforeEach(reset);

  it('renames a tag across items and merges into an existing tag', () => {
    const store = useCollectionStore.getState();
    const a = store.addItem(createMockItem({ title: 'A', tags: ['scifi', 'classic'] }));
    const b = store.addItem(createMockItem({ title: 'B', tags: ['scifi', 'sci-fi'] }));
    store.addItem(createMockItem({ title: 'C', tags: ['poetry'] }));

    const changed = useCollectionStore.getState().renameTag('scifi', 'sci-fi');

    expect(changed).toBe(2);
    const items = useCollectionStore.getState().items;
    expect(items.find((item) => item.id === a.id)?.tags).toEqual(['sci-fi', 'classic']);
    expect(items.find((item) => item.id === b.id)?.tags).toEqual(['sci-fi']);
    expect(useCollectionStore.getState().activityLog[0]?.details).toMatch(/merged into "sci-fi"/);
  });

  it('merges selected tags and removes a tag everywhere', () => {
    const store = useCollectionStore.getState();
    store.addItem(createMockItem({ title: 'A', tags: ['vinyl', 'lp'] }));
    store.addItem(createMockItem({ title: 'B', tags: ['record'] }));

    expect(useCollectionStore.getState().mergeTags(['lp', 'record'], 'vinyl')).toBe(2);
    expect(useCollectionStore.getState().items.map((item) => item.tags)).toEqual([['vinyl'], ['vinyl']]);

    expect(useCollectionStore.getState().removeTag('vinyl')).toBe(2);
    expect(useCollectionStore.getState().items.every((item) => item.tags.length === 0)).toBe(true);
    expect(useCollectionStore.getState().renameTag('missing', '')).toBe(0);
  });

  it('bulk sets location, custom fields, removes tags and sets current value with history', () => {
    const store = useCollectionStore.getState();
    const a = store.addItem(createMockItem({ title: 'A', tags: ['x', 'y'] }));
    const b = store.addItem(createMockItem({ title: 'B', tags: ['y'] }));
    const ids = [a.id, b.id];

    useCollectionStore.getState().bulkUpdateItems(ids, { location: 'Shelf 3' }, 'Bulk location set to Shelf 3');
    useCollectionStore.getState().bulkSetCustomField(ids, 'publisher', 'Ace');
    useCollectionStore.getState().bulkRemoveTag(ids, 'y');
    useCollectionStore.getState().bulkSetCurrentValue(ids, 250, 'EUR');

    const items = useCollectionStore.getState().items;
    for (const item of items) {
      expect(item.location).toBe('Shelf 3');
      expect(item.customFields.publisher).toBe('Ace');
      expect(item.tags).not.toContain('y');
      expect(item.valuationInfo.currentEstimatedValue).toBe(250);
      expect(item.valuationInfo.currentValueCurrency).toBe('EUR');
      expect(item.valuationInfo.valueHistory.at(-1)).toMatchObject({ value: 250, currency: 'EUR' });
    }

    useCollectionStore.getState().bulkSetCustomField([a.id], 'publisher', undefined);
    expect(useCollectionStore.getState().items.find((item) => item.id === a.id)?.customFields).not.toHaveProperty('publisher');
  });
});
