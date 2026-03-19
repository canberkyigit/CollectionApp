import { describe, it, expect, beforeEach } from 'vitest';
import { useCollectionStore } from '../useCollectionStore';
import { createMockItem, createMockCategory } from '@/test/helpers';

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
      const cat = store.addCategory(createMockCategory({ name: 'Vinyl Records' }));

      expect(cat.id).toBeDefined();
      expect(cat.slug).toBe('vinyl-records');
      expect(cat.createdAt).toBeDefined();
      expect(useCollectionStore.getState().categories).toHaveLength(1);
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
      const lib = store.addLibrary({ name: 'Shelf A', categoryId: 'cat-1' } as any);

      expect(lib.id).toBeDefined();
      expect(lib.name).toBe('Shelf A');
      expect(useCollectionStore.getState().libraries).toHaveLength(1);
    });
  });

  describe('deleteLibrary', () => {
    it('removes library and unassigns items from it', () => {
      const store = useCollectionStore.getState();
      const lib = store.addLibrary({ name: 'ToRemove', categoryId: 'cat-1' } as any);
      const item = store.addItem(createMockItem({ libraryId: lib.id }));

      store.deleteLibrary(lib.id);

      expect(useCollectionStore.getState().libraries).toHaveLength(0);
      const updated = useCollectionStore.getState().items.find((i) => i.id === item.id);
      expect(updated?.libraryId).toBeUndefined();
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
  });
});
