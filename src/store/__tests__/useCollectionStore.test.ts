import { describe, it, expect, beforeEach, vi } from 'vitest';
import { migrateCollectionStoreState, useCollectionStore } from '../useCollectionStore';
import { createMockItem, createMockCategory } from '@/test/helpers';

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return {
    ...actual,
    toast: {
      success: mocks.toastSuccess,
      info: mocks.toastInfo,
    },
  };
});

function resetStore() {
  useCollectionStore.setState({
    items: [],
    categories: [],
    libraries: [],
    wishlist: [],
    activityLog: [],
    contributors: [],
  });
}

describe('useCollectionStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('migrates legacy built-in custom field keys into canonical item data', () => {
    const migrated = migrateCollectionStoreState({
      categories: [],
      contributors: [],
      items: [
        {
          ...createMockItem({
            title: 'Canonical Title',
            condition: 'Good',
            customFields: {
              title: 'Legacy Title',
              condition: 'Mint',
              purchasePrice: 999,
              author: 'Ursula K. Le Guin',
            },
          }),
          id: 'item-legacy',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
    });

    expect(migrated.items?.[0]).toMatchObject({
      title: 'Canonical Title',
      condition: 'Good',
      customFields: { author: 'Ursula K. Le Guin' },
      documents: [],
    });
  });

  // ── Items ──────────────────────────────────────────

  describe('addItem', () => {
    it('adds an item and assigns id + timestamps', () => {
      const store = useCollectionStore.getState();
      const item = store.addItem(createMockItem({ title: 'Osman\'s Dream' }));

      expect(item.id).toBeDefined();
      expect(item.title).toBe('Osman\'s Dream');
      expect(item.createdAt).toBeDefined();
      expect(item.updatedAt).toBeDefined();

      const items = useCollectionStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(item.id);
    });

    it('logs an activity entry', () => {
      const store = useCollectionStore.getState();
      store.addItem(createMockItem({ title: 'Activity Test' }));

      const log = useCollectionStore.getState().activityLog;
      expect(log.length).toBeGreaterThanOrEqual(1);
      expect(log[log.length - 1].action).toBe('item_created');
    });

    it('seeds value history when a current valuation exists but history is empty', () => {
      const store = useCollectionStore.getState();
      const item = store.addItem(createMockItem({
        valuationInfo: {
          currentEstimatedValue: 95,
          currentValueCurrency: 'USD',
          currentExchangeRate: 1,
          valueHistory: [],
        },
      }));

      expect(item.valuationInfo.valueHistory).toEqual([
        expect.objectContaining({
          value: 95,
          currency: 'USD',
        }),
      ]);
    });
  });

  describe('updateItem', () => {
    it('updates existing item fields', () => {
      const store = useCollectionStore.getState();
      const item = store.addItem(createMockItem({ title: 'Original' }));

      store.updateItem(item.id, { title: 'Updated Title' });
      const updated = useCollectionStore.getState().items.find((i) => i.id === item.id);

      expect(updated?.title).toBe('Updated Title');
      expect(updated?.updatedAt).toBeDefined();
    });

    it('appends valuation history and emits alerts for large value changes', () => {
      const store = useCollectionStore.getState();
      const item = store.addItem(createMockItem({
        title: 'Valuation Test',
        valuationInfo: {
          currentEstimatedValue: 100,
          currentValueCurrency: 'USD',
          currentExchangeRate: 1,
          valueHistory: [{ date: '2024-01-01', value: 100, currency: 'USD' }],
        },
      }));

      store.updateItem(item.id, {
        valuationInfo: {
          currentEstimatedValue: 125,
          currentValueCurrency: 'USD',
          currentExchangeRate: 1,
          valueHistory: [{ date: '2024-01-01', value: 100, currency: 'USD' }],
        },
      });

      const updated = useCollectionStore.getState().items.find((entry) => entry.id === item.id);
      expect(updated?.valuationInfo.valueHistory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ value: 125, currency: 'USD' }),
        ]),
      );
      expect(mocks.toastInfo).toHaveBeenCalled();
    });

    it('does not add a second point when the caller already recorded the new value', () => {
      const store = useCollectionStore.getState();
      const item = store.addItem(createMockItem({
        title: 'Backdated Valuation',
        valuationInfo: {
          currentEstimatedValue: 100,
          currentValueCurrency: 'USD',
          currentExchangeRate: 1,
          valueHistory: [{ date: '2024-01-01', value: 100, currency: 'USD' }],
        },
      }));

      store.updateItem(item.id, {
        valuationInfo: {
          currentEstimatedValue: 150,
          currentValueCurrency: 'USD',
          currentExchangeRate: 1,
          valueHistory: [
            { date: '2024-01-01', value: 100, currency: 'USD' },
            { date: '2024-06-01', value: 150, currency: 'USD' },
          ],
        },
      });

      const updated = useCollectionStore.getState().items.find((entry) => entry.id === item.id);
      expect(updated?.valuationInfo.valueHistory).toEqual([
        { date: '2024-01-01', value: 100, currency: 'USD' },
        { date: '2024-06-01', value: 150, currency: 'USD' },
      ]);
    });
  });

  describe('deleteItem (soft delete)', () => {
    it('archives the item instead of removing', () => {
      const store = useCollectionStore.getState();
      const item = store.addItem(createMockItem());

      store.deleteItem(item.id);
      const deleted = useCollectionStore.getState().items.find((i) => i.id === item.id);

      expect(deleted).toBeDefined();
      expect(deleted?.isArchived).toBe(true);
      expect(deleted?.archivedAt).toBeDefined();
    });
  });

  describe('toggleFavorite', () => {
    it('toggles favorite status', () => {
      const store = useCollectionStore.getState();
      const item = store.addItem(createMockItem({ isFavorite: false }));

      store.toggleFavorite(item.id);
      expect(useCollectionStore.getState().items[0].isFavorite).toBe(true);

      store.toggleFavorite(item.id);
      expect(useCollectionStore.getState().items[0].isFavorite).toBe(false);
    });
  });

  describe('toggleRead', () => {
    it('toggles read status', () => {
      const store = useCollectionStore.getState();
      const item = store.addItem(createMockItem());

      store.toggleRead(item.id);
      expect(useCollectionStore.getState().items[0].isRead).toBe(true);

      store.toggleRead(item.id);
      expect(useCollectionStore.getState().items[0].isRead).toBe(false);
    });
  });

  describe('getFavoriteItems', () => {
    it('returns only favorited non-archived items', () => {
      const store = useCollectionStore.getState();
      store.addItem(createMockItem({ title: 'Fav', isFavorite: true }));
      store.addItem(createMockItem({ title: 'Not Fav', isFavorite: false }));
      const archivedFav = store.addItem(createMockItem({ title: 'Archived Fav', isFavorite: true }));
      store.deleteItem(archivedFav.id);

      const favs = useCollectionStore.getState().getFavoriteItems();
      expect(favs).toHaveLength(1);
      expect(favs[0].title).toBe('Fav');
    });
  });

  describe('bulkAddItems', () => {
    it('adds multiple items at once', () => {
      const store = useCollectionStore.getState();
      const count = store.bulkAddItems([
        createMockItem({ title: 'Bulk 1' }),
        createMockItem({ title: 'Bulk 2' }),
        createMockItem({ title: 'Bulk 3' }),
      ]);

      expect(count).toBe(3);
      expect(useCollectionStore.getState().items).toHaveLength(3);
    });
  });

  describe('bulkMoveItems', () => {
    it('changes categoryId for selected items', () => {
      const store = useCollectionStore.getState();
      const cat = store.addCategory(createMockCategory({ name: 'Target' }));
      const item1 = store.addItem(createMockItem({ title: 'Move Me' }));
      const item2 = store.addItem(createMockItem({ title: 'Move Me Too' }));

      store.bulkMoveItems([item1.id, item2.id], cat.id);

      const items = useCollectionStore.getState().items;
      expect(items.every((i) => i.categoryId === cat.id)).toBe(true);
    });

    it('clears incompatible libraries during bulk moves', () => {
      const store = useCollectionStore.getState();
      const bookCat = store.addCategory(createMockCategory({ name: 'Books', slug: 'books' }));
      const vinylCat = store.addCategory(createMockCategory({ name: 'Vinyl', slug: 'vinyl' }));
      store.addLibrary({ name: 'Shelf', categoryIds: [bookCat.id] } as any);
      const libraryId = useCollectionStore.getState().libraries[0].id;
      const item = store.addItem(createMockItem({ categoryId: bookCat.id, libraryId }));

      store.bulkMoveItems([item.id], vinylCat.id);

      const moved = useCollectionStore.getState().items.find((entry) => entry.id === item.id);
      expect(moved?.categoryId).toBe(vinylCat.id);
      expect(moved?.libraryId).toBeUndefined();
    });
  });

  describe('bulkUpdateCondition', () => {
    it('updates condition for selected items', () => {
      const store = useCollectionStore.getState();
      const item1 = store.addItem(createMockItem({ condition: 'Good' }));
      const item2 = store.addItem(createMockItem({ condition: 'Fair' }));

      store.bulkUpdateCondition([item1.id, item2.id], 'Mint');

      const items = useCollectionStore.getState().items;
      expect(items.every((i) => i.condition === 'Mint')).toBe(true);
    });
  });

  describe('bulkAddTag', () => {
    it('adds a tag to selected items without duplicating', () => {
      const store = useCollectionStore.getState();
      const item = store.addItem(createMockItem({ tags: ['existing'] }));

      store.bulkAddTag([item.id], 'new-tag');
      expect(useCollectionStore.getState().items[0].tags).toEqual(['existing', 'new-tag']);

      store.bulkAddTag([item.id], 'new-tag');
      expect(useCollectionStore.getState().items[0].tags).toEqual(['existing', 'new-tag']);
    });
  });

  // ── Categories ─────────────────────────────────────

  describe('addCategory', () => {
    it('adds a category with generated id and slug', () => {
      const store = useCollectionStore.getState();
      const cat = store.addCategory(createMockCategory({ name: 'Vinyl Records', slug: '' }));

      expect(cat.id).toBeDefined();
      expect(cat.slug).toBe('vinyl-records');
      expect(cat.createdAt).toBeDefined();
      expect(useCollectionStore.getState().categories).toHaveLength(1);
    });

    it('respects the typed slug and de-duplicates collisions', () => {
      const store = useCollectionStore.getState();
      const first = store.addCategory(createMockCategory({ name: 'Plaklar', slug: 'Vinyl Shelf' }));
      const second = useCollectionStore.getState().addCategory(createMockCategory({ name: 'Other', slug: 'vinyl-shelf' }));
      const third = useCollectionStore.getState().addCategory(createMockCategory({ name: 'Third', slug: 'vinyl-shelf' }));

      expect(first.slug).toBe('vinyl-shelf');
      expect(second.slug).toBe('vinyl-shelf-2');
      expect(third.slug).toBe('vinyl-shelf-3');

      useCollectionStore.getState().updateCategory(third.id, { slug: 'vinyl-shelf' });
      expect(useCollectionStore.getState().categories.find((c) => c.id === third.id)?.slug).toBe('vinyl-shelf-3');

      useCollectionStore.getState().updateCategory(first.id, { slug: 'Vinyl Shelf' });
      expect(useCollectionStore.getState().categories.find((c) => c.id === first.id)?.slug).toBe('vinyl-shelf');
    });
  });

  describe('updateCategory', () => {
    it('updates category fields', () => {
      const store = useCollectionStore.getState();
      const cat = store.addCategory(createMockCategory({ name: 'Old Name' }));

      store.updateCategory(cat.id, { name: 'New Name' });
      const updated = useCollectionStore.getState().categories[0];

      expect(updated.name).toBe('New Name');
    });
  });

  describe('deleteCategory', () => {
    it('removes category and its items', () => {
      const store = useCollectionStore.getState();
      const cat = store.addCategory(createMockCategory({ name: 'ToDelete' }));
      store.addItem(createMockItem({ categoryId: cat.id }));
      store.addItem(createMockItem({ categoryId: cat.id }));
      store.addItem(createMockItem({ categoryId: 'other-cat' }));

      store.deleteCategory(cat.id);

      expect(useCollectionStore.getState().categories).toHaveLength(0);
      expect(useCollectionStore.getState().items).toHaveLength(1);
      expect(useCollectionStore.getState().items[0].categoryId).toBe('other-cat');
    });

    it('removes deleted category ids from shared libraries', () => {
      const store = useCollectionStore.getState();
      const cat = store.addCategory(createMockCategory({ name: 'Books', slug: 'books' }));
      const otherCat = store.addCategory(createMockCategory({ name: 'Vinyl', slug: 'vinyl' }));
      const library = store.addLibrary({ name: 'Shared Shelf', categoryIds: [cat.id, otherCat.id] } as any);

      store.deleteCategory(cat.id);

      const updatedLibrary = useCollectionStore.getState().libraries.find((entry) => entry.id === library.id);
      expect(updatedLibrary?.categoryIds).toEqual([otherCat.id]);
    });
  });

  describe('reorderCategories', () => {
    it('sets order based on provided id array', () => {
      const store = useCollectionStore.getState();
      const c1 = store.addCategory(createMockCategory({ name: 'A' }));
      const c2 = store.addCategory(createMockCategory({ name: 'B' }));
      const c3 = store.addCategory(createMockCategory({ name: 'C' }));

      store.reorderCategories([c3.id, c1.id, c2.id]);

      const cats = useCollectionStore.getState().categories;
      expect(cats.find((c) => c.id === c3.id)?.order).toBe(0);
      expect(cats.find((c) => c.id === c1.id)?.order).toBe(1);
      expect(cats.find((c) => c.id === c2.id)?.order).toBe(2);
    });
  });

  // ── Libraries ──────────────────────────────────────

  describe('addLibrary', () => {
    it('creates a library', () => {
      const store = useCollectionStore.getState();
      const lib = store.addLibrary({ name: 'Shelf A', categoryIds: ['cat-1'] } as any);

      expect(lib.id).toBeDefined();
      expect(lib.name).toBe('Shelf A');
      expect(lib.categoryIds).toEqual(['cat-1']);
      expect(useCollectionStore.getState().libraries).toHaveLength(1);
    });

    it('returns libraries for every assigned category', () => {
      const store = useCollectionStore.getState();
      const lib = store.addLibrary({ name: 'Shared Shelf', categoryIds: ['cat-1', 'cat-2'] } as any);

      expect(useCollectionStore.getState().getLibrariesByCategory('cat-1')).toEqual([lib]);
      expect(useCollectionStore.getState().getLibrariesByCategory('cat-2')).toEqual([lib]);
    });
  });

  describe('deleteLibrary', () => {
    it('removes library and unassigns items from it', () => {
      const store = useCollectionStore.getState();
      const lib = store.addLibrary({ name: 'ToRemove', categoryIds: ['cat-1'] } as any);
      const item = store.addItem(createMockItem({ libraryId: lib.id }));

      store.deleteLibrary(lib.id);

      expect(useCollectionStore.getState().libraries).toHaveLength(0);
      const updated = useCollectionStore.getState().items.find((i) => i.id === item.id);
      expect(updated?.libraryId).toBeUndefined();
    });

    it('unassigns items from categories removed from a library', () => {
      const store = useCollectionStore.getState();
      const lib = store.addLibrary({ name: 'Shared Shelf', categoryIds: ['cat-a', 'cat-b'] } as any);
      const itemA = store.addItem(createMockItem({ categoryId: 'cat-a', libraryId: lib.id }));
      const itemB = store.addItem(createMockItem({ categoryId: 'cat-b', libraryId: lib.id }));

      store.updateLibrary(lib.id, { categoryIds: ['cat-b'] });

      expect(useCollectionStore.getState().items.find((item) => item.id === itemA.id)?.libraryId).toBeUndefined();
      expect(useCollectionStore.getState().items.find((item) => item.id === itemB.id)?.libraryId).toBe(lib.id);
    });
  });

  // ── Wishlist ───────────────────────────────────────

  describe('addWishlistItem', () => {
    it('adds a wishlist item', () => {
      const store = useCollectionStore.getState();
      const wl = store.addWishlistItem({
        title: 'Want This',
        description: 'Cool item',
        categoryId: 'cat-1',
        priority: 'high',
        tags: ['rare'],
        images: [],
        addedBy: 'contrib-1',
      } as any);

      expect(wl.id).toBeDefined();
      expect(wl.isAcquired).toBe(false);
      expect(useCollectionStore.getState().wishlist).toHaveLength(1);
    });

    it('updates, acquires, and deletes wishlist entries', () => {
      const store = useCollectionStore.getState();
      const wishlistItem = store.addWishlistItem({
        title: 'Want This',
        description: 'Cool item',
        categoryId: 'cat-1',
        priority: 'high',
        tags: ['rare'],
        images: [],
        addedBy: 'contrib-1',
      } as any);

      store.updateWishlistItem(wishlistItem.id, { notes: 'Watch prices' });
      expect(useCollectionStore.getState().wishlist[0].notes).toBe('Watch prices');

      store.acquireWishlistItem(wishlistItem.id, 'item-42');
      expect(useCollectionStore.getState().wishlist[0]).toEqual(
        expect.objectContaining({
          isAcquired: true,
          acquiredItemId: 'item-42',
        }),
      );

      store.deleteWishlistItem(wishlistItem.id);
      expect(useCollectionStore.getState().wishlist).toHaveLength(0);
    });
  });

  // ── Selectors ──────────────────────────────────────

  describe('getItemsByCategory', () => {
    it('returns only items in the given category', () => {
      const store = useCollectionStore.getState();
      store.addItem(createMockItem({ categoryId: 'cat-a', title: 'A1' }));
      store.addItem(createMockItem({ categoryId: 'cat-a', title: 'A2' }));
      store.addItem(createMockItem({ categoryId: 'cat-b', title: 'B1' }));

      const items = useCollectionStore.getState().getItemsByCategory('cat-a');
      expect(items).toHaveLength(2);
      expect(items.every((i) => i.categoryId === 'cat-a')).toBe(true);
    });

    it('excludes archived items', () => {
      const store = useCollectionStore.getState();
      const item = store.addItem(createMockItem({ categoryId: 'cat-a' }));
      store.addItem(createMockItem({ categoryId: 'cat-a' }));
      store.deleteItem(item.id);

      const items = useCollectionStore.getState().getItemsByCategory('cat-a');
      expect(items).toHaveLength(1);
    });
  });

  describe('getArchivedItems', () => {
    it('returns only archived items', () => {
      const store = useCollectionStore.getState();
      const item = store.addItem(createMockItem({ title: 'To Archive' }));
      store.addItem(createMockItem({ title: 'Keep' }));
      store.deleteItem(item.id);

      const archived = useCollectionStore.getState().getArchivedItems();
      expect(archived).toHaveLength(1);
      expect(archived[0].title).toBe('To Archive');
    });
  });

  // ── Item Dialog State ──────────────────────────────

  describe('itemDialog state', () => {
    it('opens dialog with category id', () => {
      const store = useCollectionStore.getState();
      store.openItemDialog('cat-books');

      const state = useCollectionStore.getState();
      expect(state.itemDialogOpen).toBe(true);
      expect(state.itemDialogCategoryId).toBe('cat-books');
      expect(state.itemDialogItem).toBeNull();
    });

    it('opens dialog with item for edit mode', () => {
      const store = useCollectionStore.getState();
      const item = store.addItem(createMockItem({ title: 'Edit Me' }));
      store.openItemDialog('cat-books', item);

      const state = useCollectionStore.getState();
      expect(state.itemDialogOpen).toBe(true);
      expect(state.itemDialogItem?.title).toBe('Edit Me');
    });

    it('closes dialog and resets state', () => {
      const store = useCollectionStore.getState();
      store.openItemDialog('cat-books');
      store.closeItemDialog();

      const state = useCollectionStore.getState();
      expect(state.itemDialogOpen).toBe(false);
      expect(state.itemDialogCategoryId).toBeNull();
      expect(state.itemDialogItem).toBeNull();
    });
  });

  // ── Archive / Recover ──────────────────────────────

  describe('archive and recover', () => {
    it('recovers an archived item', () => {
      const store = useCollectionStore.getState();
      const item = store.addItem(createMockItem());
      store.archiveItem(item.id);

      expect(useCollectionStore.getState().items[0].isArchived).toBe(true);

      store.recoverItem(item.id);
      const recovered = useCollectionStore.getState().items[0];
      expect(recovered.isArchived).toBeFalsy();
      expect(recovered.archivedAt).toBeUndefined();
    });

    it('archives, recovers, and permanently deletes multiple items', () => {
      const store = useCollectionStore.getState();
      const itemA = store.addItem(createMockItem({ title: 'Archive A' }));
      const itemB = store.addItem(createMockItem({ title: 'Archive B' }));

      store.archiveItems([itemA.id, itemB.id]);
      expect(useCollectionStore.getState().items.every((item) => item.isArchived)).toBe(true);

      store.recoverItems([itemA.id, itemB.id]);
      expect(useCollectionStore.getState().items.every((item) => !item.isArchived)).toBe(true);

      store.permanentDeleteItems([itemA.id]);
      expect(useCollectionStore.getState().items.map((item) => item.id)).toEqual([itemB.id]);

      store.permanentDeleteItem(itemB.id);
      expect(useCollectionStore.getState().items).toHaveLength(0);
    });
  });

  describe('maintenance and lending', () => {
    it('adds and removes maintenance records while preserving activity', () => {
      const store = useCollectionStore.getState();
      const item = store.addItem(createMockItem({ title: 'Repair Me' }));

      store.addMaintenanceEntry(item.id, {
        date: '2024-05-01',
        type: 'repair',
        description: 'Dust jacket repair',
      });

      const maintained = useCollectionStore.getState().items.find((entry) => entry.id === item.id);
      expect(maintained?.maintenanceLog).toHaveLength(1);
      expect(useCollectionStore.getState().activityLog[0]).toEqual(
        expect.objectContaining({
          action: 'maintenance_added',
          entityId: item.id,
        }),
      );

      const entryId = maintained?.maintenanceLog[0].id;
      expect(entryId).toBeDefined();
      store.removeMaintenanceEntry(item.id, entryId!);
      expect(useCollectionStore.getState().items.find((entry) => entry.id === item.id)?.maintenanceLog).toHaveLength(0);
    });

    it('adds lending records and marks them as returned', () => {
      const store = useCollectionStore.getState();
      const item = store.addItem(createMockItem({ title: 'Loaner' }));

      store.addLendingRecord(item.id, {
        borrowerName: 'Jane Reader',
        lentDate: '2024-06-01',
        expectedReturnDate: '2024-06-10',
        notes: 'Handle carefully',
        condition: 'pending',
      });

      const activeRecord = useCollectionStore.getState().items.find((entry) => entry.id === item.id)?.lendingHistory[0];
      expect(activeRecord).toMatchObject({
        borrowerName: 'Jane Reader',
        condition: 'pending',
      });

      store.returnLendingRecord(item.id, activeRecord!.id, 'same');
      const returnedRecord = useCollectionStore.getState().items.find((entry) => entry.id === item.id)?.lendingHistory[0];
      expect(returnedRecord).toEqual(
        expect.objectContaining({
          condition: 'same',
        }),
      );
      expect(returnedRecord?.actualReturnDate).toBeDefined();
    });
  });

  describe('activity log controls', () => {
    it('adds and clears activity entries', () => {
      const store = useCollectionStore.getState();
      store.logActivity({
        action: 'item_created',
        entityType: 'item',
        entityId: 'item-1',
        entityTitle: 'Dune',
      });

      expect(useCollectionStore.getState().activityLog).toHaveLength(1);
      store.clearActivityLog();
      expect(useCollectionStore.getState().activityLog).toHaveLength(0);
    });
  });

  // ── UI State ───────────────────────────────────────

  describe('UI state', () => {
    it('sets search query', () => {
      useCollectionStore.getState().setSearchQuery('ottoman');
      expect(useCollectionStore.getState().searchQuery).toBe('ottoman');
    });

    it('toggles sidebar', () => {
      const initial = useCollectionStore.getState().sidebarOpen;
      useCollectionStore.getState().toggleSidebar();
      expect(useCollectionStore.getState().sidebarOpen).toBe(!initial);
    });

    it('sets view mode', () => {
      useCollectionStore.getState().setViewMode('covers');
      expect(useCollectionStore.getState().viewMode).toBe('covers');
    });

    it('sets sort field and order', () => {
      const store = useCollectionStore.getState();
      store.setSortField('title');
      store.setSortOrder('asc');

      const state = useCollectionStore.getState();
      expect(state.sortField).toBe('title');
      expect(state.sortOrder).toBe('asc');
    });

    it('updates notifications and read markers', () => {
      useCollectionStore.setState({
        activityLog: [
          {
            id: 'act-1',
            action: 'item_created',
            entityType: 'item',
            entityId: 'item-1',
            entityTitle: 'Dune',
            details: 'Added',
            userId: 'contrib-1',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'act-2',
            action: 'item_updated',
            entityType: 'item',
            entityId: 'item-2',
            entityTitle: 'Foundation',
            details: 'Updated',
            userId: 'contrib-1',
            timestamp: '2024-01-02T00:00:00.000Z',
          },
        ],
      });

      const store = useCollectionStore.getState();
      store.markNotificationRead('act-1');
      store.markNotificationRead('act-1');
      store.markAllNotificationsRead();
      store.setNotifications({ valueChangeAlerts: false });

      const state = useCollectionStore.getState();
      expect(state.readNotificationIds).toEqual(['act-1', 'act-2']);
      expect(state.notifications.valueChangeAlerts).toBe(false);
    });

    it('updates and resets dashboard widgets', () => {
      const store = useCollectionStore.getState();
      const firstWidgetId = store.dashboardWidgets[0].id;
      const secondWidgetId = store.dashboardWidgets[1].id;
      const firstOrder = store.dashboardWidgets[0].order;
      const secondOrder = store.dashboardWidgets[1].order;

      store.toggleWidgetVisibility(firstWidgetId);
      expect(useCollectionStore.getState().dashboardWidgets[0].visible).toBe(false);

      store.setWidgetSize(firstWidgetId, 'half');
      expect(useCollectionStore.getState().dashboardWidgets[0].size).toBe('half');

      store.moveWidget(firstWidgetId, 'down');
      const moved = useCollectionStore.getState().dashboardWidgets;
      expect(moved.find((widget) => widget.id === firstWidgetId)?.order).toBe(secondOrder);
      expect(moved.find((widget) => widget.id === secondWidgetId)?.order).toBe(firstOrder);

      store.resetDashboardLayout();
      expect(useCollectionStore.getState().dashboardWidgets[0].visible).toBe(true);
      expect(useCollectionStore.getState().dashboardWidgets[0].size).toBe('full');
    });
  });
});
