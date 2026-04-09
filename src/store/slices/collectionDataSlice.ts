import { toast } from 'sonner';

import { buildResetState } from '@/store/collectionStore.defaults';
import {
  hasRemoteSnapshotData,
  selectArchivedItems,
  selectCategoryById,
  selectCategoryBySlug,
  selectCategoryStats,
  selectContributorById,
  selectFavoriteItems,
  selectItemById,
  selectItemsByCategory,
  selectLentItems,
  selectMonthlyAcquisitions,
  selectMostValuableItems,
  selectRecentItems,
  selectTotalValue,
  selectValueOverTime,
} from '@/store/collectionStore.selectors';
import type {
  CollectionDataSlice,
  CollectionStore,
  CollectionStoreCreator,
  CollectionStoreDependencies,
} from '@/store/collectionStore.types';
import type {
  ActivityLogEntry,
  Category,
  CollectionItem,
  LendingRecord,
  Library,
  MaintenanceEntry,
  WishlistItem,
} from '@/types';
import { collectionSyncService } from '@/services/collectionSyncService';
import { firestoreService, type FirestoreSnapshot, type UserSettings } from '@/services/firestoreService';
import { logger } from '@/services/logger';
import { generateId, slugify } from '@/lib/utils';
import { getLibraryCategoryIds, libraryMatchesCategory, normalizeLibrary } from '@/lib/libraries';

let firestoreUnsubscribe: (() => void) | null = null;

function buildUserSettings(state: CollectionStore): UserSettings {
  return {
    displayCurrency: state.displayCurrency,
    theme: state.theme,
    sidebarOpen: state.sidebarOpen,
    menuCollectionStyle: state.menuCollectionStyle,
    dashboardWidgets: state.dashboardWidgets,
    readNotificationIds: state.readNotificationIds,
    notifications: state.notifications,
  };
}

export function createCollectionDataSlice(
  dependencies: CollectionStoreDependencies,
): CollectionStoreCreator<CollectionDataSlice> {
  const initialState = buildResetState({ userId: null, mode: 'starter' });

  return (set, get) => ({
    ownerUserId: null,
    isRemoteDataLoading: false,
    categories: initialState.categories ?? [],
    items: initialState.items ?? [],
    libraries: initialState.libraries ?? [],
    contributors: initialState.contributors ?? [],
    wishlist: initialState.wishlist ?? [],
    activityLog: initialState.activityLog ?? [],

    upsertContributorProfile: (contributor) => {
      set((state) => {
        const existing = state.contributors.find((entry) => entry.id === contributor.id);
        if (!existing) {
          return { contributors: [...state.contributors, contributor] };
        }

        const incomingHasMetrics = contributor.itemCount > 0 || contributor.totalContributionValue > 0;

        return {
          contributors: state.contributors.map((entry) => (
            entry.id === contributor.id
              ? {
                  ...entry,
                  ...contributor,
                  joinedAt: entry.joinedAt,
                  itemCount: incomingHasMetrics ? contributor.itemCount : entry.itemCount,
                  totalContributionValue: incomingHasMetrics
                    ? contributor.totalContributionValue
                    : entry.totalContributionValue,
                  lastContributionAt: incomingHasMetrics
                    ? contributor.lastContributionAt
                    : entry.lastContributionAt,
                }
              : entry
          )),
        };
      });

      dependencies.syncContributor(contributor);
    },

    resetForUser: (userId, mode = 'starter') => {
      if (get().ownerUserId === userId) return;
      set(buildResetState({ userId, mode }));
    },

    wipeAllData: async () => {
      set(buildResetState({ userId: get().ownerUserId, mode: 'empty' }));

      if (get().ownerUserId && firestoreService.isAvailable()) {
        await collectionSyncService.perform('Wipe user data', () =>
          firestoreService.wipeAllUserData(get().ownerUserId!),
        );
      }
    },

    addCategory: (data) => {
      if (!dependencies.ensurePermission('catalog:manage')) {
        return {
          ...data,
          id: '',
          slug: '',
          order: 0,
          createdAt: '',
          updatedAt: '',
        };
      }

      const now = new Date().toISOString();
      const maxOrder = get().categories.reduce((max, category) => Math.max(max, category.order ?? 0), -1);
      const category: Category = {
        ...data,
        id: generateId(),
        slug: slugify(data.name),
        order: maxOrder + 1,
        createdAt: now,
        updatedAt: now,
      };

      set((state) => ({ categories: [...state.categories, category] }));
      dependencies.syncCategory(category);
      get().logActivity({
        action: 'category_created',
        entityType: 'category',
        entityId: category.id,
        entityTitle: category.name,
      });

      return category;
    },

    updateCategory: (id, updates) => {
      if (!dependencies.ensurePermission('catalog:manage')) return;

      set((state) => ({
        categories: state.categories.map((category) => (
          category.id === id
            ? { ...category, ...updates, updatedAt: new Date().toISOString() }
            : category
        )),
      }));

      const category = get().categories.find((entry) => entry.id === id);
      if (!category) return;

      dependencies.syncCategory(category);
      get().logActivity({
        action: 'category_updated',
        entityType: 'category',
        entityId: id,
        entityTitle: category.name,
      });
    },

    deleteCategory: (id) => {
      if (!dependencies.ensurePermission('catalog:manage')) return;

      const category = get().categories.find((entry) => entry.id === id);
      const orphanedItemIds = get().items.filter((item) => item.categoryId === id).map((item) => item.id);
      const now = new Date().toISOString();
      const touchedLibraries = get().libraries
        .filter((library) => libraryMatchesCategory(library, id))
        .map((library) => normalizeLibrary({
          ...library,
          categoryIds: getLibraryCategoryIds(library).filter((categoryId) => categoryId !== id),
          updatedAt: now,
        }));

      set((state) => ({
        categories: state.categories.filter((entry) => entry.id !== id),
        items: state.items.filter((item) => item.categoryId !== id),
        libraries: state.libraries.map((library) => {
          const touchedLibrary = touchedLibraries.find((entry) => entry.id === library.id);
          return touchedLibrary ?? library;
        }),
      }));

      if (get().ownerUserId && firestoreService.isAvailable()) {
        collectionSyncService.schedule(
          'Delete category',
          () => firestoreService.deleteCategory(get().ownerUserId!, id),
          { scope: 'categories' },
        );

        if (orphanedItemIds.length > 0) {
          collectionSyncService.schedule(
            'Delete orphaned items',
            () => firestoreService.deleteItems(get().ownerUserId!, orphanedItemIds),
            { scope: 'items' },
          );
        }

        touchedLibraries.forEach((library) => dependencies.syncLibrary(library));
      }

      if (category) {
        get().logActivity({
          action: 'category_deleted',
          entityType: 'category',
          entityId: id,
          entityTitle: category.name,
        });
      }
    },

    reorderCategories: (orderedIds) => {
      if (!dependencies.ensurePermission('catalog:manage')) return;

      set((state) => ({
        categories: state.categories.map((category) => {
          const nextOrder = orderedIds.indexOf(category.id);
          return nextOrder === -1 ? category : { ...category, order: nextOrder };
        }),
      }));

      if (get().ownerUserId && firestoreService.isAvailable()) {
        get().categories.forEach((category) => dependencies.syncCategory(category));
      }
    },

    addLibrary: (data) => {
      if (!dependencies.ensurePermission('catalog:manage')) {
        return {
          ...data,
          id: '',
          order: 0,
          createdAt: '',
          updatedAt: '',
        };
      }

      const now = new Date().toISOString();
      const maxOrder = get().libraries.reduce((max, library) => Math.max(max, library.order ?? 0), -1);
      const library: Library = normalizeLibrary({
        ...data,
        id: generateId(),
        order: maxOrder + 1,
        createdAt: now,
        updatedAt: now,
      });

      set((state) => ({ libraries: [...state.libraries, library] }));
      dependencies.syncLibrary(library);
      return library;
    },

    updateLibrary: (id, updates) => {
      if (!dependencies.ensurePermission('catalog:manage')) return;

      const now = new Date().toISOString();
      const existingLibrary = get().libraries.find((library) => library.id === id);
      if (!existingLibrary) return;

      const normalizedLibrary = normalizeLibrary({ ...existingLibrary, ...updates, updatedAt: now });
      const touchedItemIds = get().items
        .filter((item) => item.libraryId === id)
        .map((item) => item.id);

      set((state) => ({
        libraries: state.libraries.map((library) => library.id === id ? normalizedLibrary : library),
        items: state.items.map((item) => (
          item.libraryId === id && !libraryMatchesCategory(normalizedLibrary, item.categoryId)
            ? { ...item, libraryId: undefined, updatedAt: now }
            : item
        )),
      }));

      const updatedLibrary = get().libraries.find((library) => library.id === id);
      if (updatedLibrary) dependencies.syncLibrary(updatedLibrary);

      touchedItemIds.forEach((itemId) => {
        const item = get().items.find((entry) => entry.id === itemId);
        if (item) dependencies.syncItem(item);
      });
    },

    deleteLibrary: (id) => {
      if (!dependencies.ensurePermission('catalog:manage')) return;

      const affectedItems = get().items.filter((item) => item.libraryId === id);
      const now = new Date().toISOString();

      set((state) => ({
        libraries: state.libraries.filter((library) => library.id !== id),
        items: state.items.map((item) => (
          item.libraryId === id
            ? { ...item, libraryId: undefined, updatedAt: now }
            : item
        )),
      }));

      dependencies.deleteLibraryFromFirestore(id);
      affectedItems.forEach((item) => {
        const updatedItem = get().items.find((entry) => entry.id === item.id);
        if (updatedItem) dependencies.syncItem(updatedItem);
      });
    },

    getLibrariesByCategory: (categoryId) => get().libraries
      .filter((library) => libraryMatchesCategory(library, categoryId))
      .sort((left, right) => left.order - right.order),

    bulkTransferToLibrary: (itemIds, libraryId) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      const now = new Date().toISOString();
      set((state) => ({
        items: state.items.map((item) => (
          itemIds.includes(item.id) ? { ...item, libraryId, updatedAt: now } : item
        )),
      }));

      itemIds.forEach((itemId) => {
        const updatedItem = get().items.find((item) => item.id === itemId);
        if (updatedItem) dependencies.syncItem(updatedItem);
      });

      const library = get().libraries.find((entry) => entry.id === libraryId);
      get().logActivity({
        action: 'item_updated',
        entityType: 'item',
        entityId: itemIds[0],
        entityTitle: `${itemIds.length} items`,
        details: `Transferred to library "${library?.name ?? libraryId}"`,
      });
    },

    toggleRead: (id) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      const item = get().items.find((entry) => entry.id === id);
      if (!item) return;

      const nextRead = !item.isRead;
      set((state) => ({
        items: state.items.map((entry) => (
          entry.id === id
            ? { ...entry, isRead: nextRead, updatedAt: new Date().toISOString() }
            : entry
        )),
      }));

      const updatedItem = get().items.find((entry) => entry.id === id);
      if (updatedItem) dependencies.syncItem(updatedItem);
    },

    addItem: (data) => {
      if (!dependencies.ensurePermission('content:edit')) {
        return {
          ...data,
          id: '',
          createdAt: '',
          updatedAt: '',
        };
      }

      const now = new Date().toISOString();
      const today = now.slice(0, 10);
      const valuationInfo = data.valuationInfo;
      const initialHistory = valuationInfo.currentEstimatedValue > 0 && valuationInfo.valueHistory.length === 0
        ? [{ date: today, value: valuationInfo.currentEstimatedValue, currency: valuationInfo.currentValueCurrency }]
        : valuationInfo.valueHistory;

      const item: CollectionItem = {
        ...data,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        valuationInfo: { ...valuationInfo, valueHistory: initialHistory },
      };

      set((state) => ({ items: [...state.items, item] }));
      dependencies.syncItem(item);

      const activeCount = get().items.filter((entry) => !entry.isArchived).length;
      if (get().notifications.collectionMilestones && [10, 25, 50, 100, 250, 500].includes(activeCount)) {
        toast.success(`Collection milestone: ${activeCount} items!`);
      }

      get().logActivity({
        action: 'item_created',
        entityType: 'item',
        entityId: item.id,
        entityTitle: item.title,
      });

      return item;
    },

    bulkAddItems: (data) => {
      if (!dependencies.ensurePermission('content:edit')) return 0;

      const now = new Date().toISOString();
      const newItems = data.map((item) => ({
        ...item,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      } as CollectionItem));

      set((state) => ({ items: [...state.items, ...newItems] }));

      if (get().ownerUserId && firestoreService.isAvailable()) {
        collectionSyncService.schedule(
          'Save imported items',
          () => firestoreService.saveItems(get().ownerUserId!, newItems),
          { scope: 'items' },
        );
      }

      get().logActivity({
        action: 'item_created',
        entityType: 'system',
        entityId: 'bulk-import',
        entityTitle: `Bulk Import (${newItems.length} items)`,
      });

      return newItems.length;
    },

    updateItem: (id, updates) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      const existing = get().items.find((item) => item.id === id);
      const now = new Date().toISOString();

      set((state) => ({
        items: state.items.map((item) => (
          item.id === id ? { ...item, ...updates, updatedAt: now } : item
        )),
      }));

      if (existing && updates.valuationInfo?.currentEstimatedValue !== undefined) {
        const previousValue = existing.valuationInfo.currentEstimatedValue;
        const nextValue = updates.valuationInfo.currentEstimatedValue;

        if (nextValue !== previousValue && nextValue > 0) {
          const today = now.slice(0, 10);
          const valueHistory = updates.valuationInfo.valueHistory ?? existing.valuationInfo.valueHistory;

          if (!valueHistory.some((entry) => entry.date === today)) {
            const nextEntry = {
              date: today,
              value: nextValue,
              currency: updates.valuationInfo.currentValueCurrency ?? existing.valuationInfo.currentValueCurrency,
            };

            set((state) => ({
              items: state.items.map((item) => (
                item.id === id
                  ? {
                      ...item,
                      valuationInfo: {
                        ...item.valuationInfo,
                        valueHistory: [...item.valuationInfo.valueHistory, nextEntry],
                      },
                    }
                  : item
              )),
            }));
          }

          if (get().notifications.valueChangeAlerts && previousValue > 0) {
            const changePct = ((nextValue - previousValue) / previousValue) * 100;
            if (Math.abs(changePct) >= 10) {
              const direction = changePct > 0 ? 'increased' : 'decreased';
              toast.info(`Value ${direction} by ${Math.abs(changePct).toFixed(1)}% for "${existing.title}"`);
            }
          }
        }
      }

      const item = get().items.find((entry) => entry.id === id);
      if (!item) return;

      dependencies.syncItem(item);
      get().logActivity({
        action: 'item_updated',
        entityType: 'item',
        entityId: id,
        entityTitle: item.title,
      });
    },

    deleteItem: (id) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      const item = get().items.find((entry) => entry.id === id);
      const now = new Date().toISOString();

      set((state) => ({
        items: state.items.map((entry) => (
          entry.id === id
            ? { ...entry, isArchived: true, archivedAt: now, updatedAt: now }
            : entry
        )),
      }));

      const updatedItem = get().items.find((entry) => entry.id === id);
      if (updatedItem) dependencies.syncItem(updatedItem);

      if (item) {
        get().logActivity({
          action: 'item_deleted',
          entityType: 'item',
          entityId: id,
          entityTitle: item.title,
        });
      }
    },

    deleteItems: (ids) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      const now = new Date().toISOString();
      set((state) => ({
        items: state.items.map((item) => (
          ids.includes(item.id)
            ? { ...item, isArchived: true, archivedAt: now, updatedAt: now }
            : item
        )),
      }));

      if (get().ownerUserId && firestoreService.isAvailable()) {
        const updatedItems = get().items.filter((item) => ids.includes(item.id));
        collectionSyncService.schedule(
          'Archive items',
          () => firestoreService.saveItems(get().ownerUserId!, updatedItems),
          { scope: 'items' },
        );
      }
    },

    bulkMoveItems: (ids, targetCategoryId) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      const now = new Date().toISOString();
      const librariesById = new Map(get().libraries.map((library) => [library.id, library]));

      set((state) => ({
        items: state.items.map((item) => {
          if (!ids.includes(item.id)) return item;
          const currentLibrary = item.libraryId ? librariesById.get(item.libraryId) : undefined;
          const nextLibraryId = currentLibrary && libraryMatchesCategory(currentLibrary, targetCategoryId)
            ? item.libraryId
            : undefined;
          return { ...item, categoryId: targetCategoryId, libraryId: nextLibraryId, updatedAt: now };
        }),
      }));

      if (get().ownerUserId && firestoreService.isAvailable()) {
        const updatedItems = get().items.filter((item) => ids.includes(item.id));
        collectionSyncService.schedule(
          'Bulk move items',
          () => firestoreService.saveItems(get().ownerUserId!, updatedItems),
          { scope: 'items' },
        );
      }

      const category = get().getCategoryById(targetCategoryId);
      get().logActivity({
        action: 'item_updated',
        entityType: 'item',
        entityId: ids[0],
        entityTitle: `${ids.length} items`,
        details: `Bulk moved to ${category?.name ?? targetCategoryId}`,
      });
    },

    bulkUpdateCondition: (ids, condition) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      const now = new Date().toISOString();
      set((state) => ({
        items: state.items.map((item) => (
          ids.includes(item.id) ? { ...item, condition, updatedAt: now } : item
        )),
      }));

      if (get().ownerUserId && firestoreService.isAvailable()) {
        const updatedItems = get().items.filter((item) => ids.includes(item.id));
        collectionSyncService.schedule(
          'Bulk update condition',
          () => firestoreService.saveItems(get().ownerUserId!, updatedItems),
          { scope: 'items' },
        );
      }

      get().logActivity({
        action: 'item_updated',
        entityType: 'item',
        entityId: ids[0],
        entityTitle: `${ids.length} items`,
        details: `Bulk condition set to ${condition}`,
      });
    },

    bulkAddTag: (ids, tag) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      const now = new Date().toISOString();
      set((state) => ({
        items: state.items.map((item) => (
          ids.includes(item.id)
            ? {
                ...item,
                tags: item.tags.includes(tag) ? item.tags : [...item.tags, tag],
                updatedAt: now,
              }
            : item
        )),
      }));

      if (get().ownerUserId && firestoreService.isAvailable()) {
        const updatedItems = get().items.filter((item) => ids.includes(item.id));
        collectionSyncService.schedule(
          'Bulk add tag',
          () => firestoreService.saveItems(get().ownerUserId!, updatedItems),
          { scope: 'items' },
        );
      }

      get().logActivity({
        action: 'item_updated',
        entityType: 'item',
        entityId: ids[0],
        entityTitle: `${ids.length} items`,
        details: `Bulk added tag "${tag}"`,
      });
    },

    bulkToggleFavorite: (ids, favorite) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      const now = new Date().toISOString();
      set((state) => ({
        items: state.items.map((item) => (
          ids.includes(item.id) ? { ...item, isFavorite: favorite, updatedAt: now } : item
        )),
      }));

      if (get().ownerUserId && firestoreService.isAvailable()) {
        const updatedItems = get().items.filter((item) => ids.includes(item.id));
        collectionSyncService.schedule(
          'Bulk toggle favorite',
          () => firestoreService.saveItems(get().ownerUserId!, updatedItems),
          { scope: 'items' },
        );
      }

      get().logActivity({
        action: favorite ? 'item_favorited' : 'item_unfavorited',
        entityType: 'item',
        entityId: ids[0],
        entityTitle: `${ids.length} items`,
        details: `Bulk ${favorite ? 'favorited' : 'unfavorited'}`,
      });
    },

    toggleFavorite: (id) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      const item = get().items.find((entry) => entry.id === id);
      if (!item) return;

      const nextFavorite = !item.isFavorite;
      set((state) => ({
        items: state.items.map((entry) => (
          entry.id === id
            ? { ...entry, isFavorite: nextFavorite, updatedAt: new Date().toISOString() }
            : entry
        )),
      }));

      const updatedItem = get().items.find((entry) => entry.id === id);
      if (updatedItem) dependencies.syncItem(updatedItem);

      get().logActivity({
        action: nextFavorite ? 'item_favorited' : 'item_unfavorited',
        entityType: 'item',
        entityId: id,
        entityTitle: item.title,
      });
    },

    addMaintenanceEntry: (itemId, entry) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      const nextEntry: MaintenanceEntry = { ...entry, id: generateId() };
      set((state) => ({
        items: state.items.map((item) => (
          item.id === itemId
            ? {
                ...item,
                maintenanceLog: [...item.maintenanceLog, nextEntry],
                updatedAt: new Date().toISOString(),
              }
            : item
        )),
      }));

      const item = get().items.find((entryItem) => entryItem.id === itemId);
      if (item) {
        dependencies.syncItem(item);
        get().logActivity({
          action: 'maintenance_added',
          entityType: 'item',
          entityId: itemId,
          entityTitle: item.title,
          details: entry.description,
        });
      }
    },

    removeMaintenanceEntry: (itemId, entryId) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      set((state) => ({
        items: state.items.map((item) => (
          item.id === itemId
            ? {
                ...item,
                maintenanceLog: item.maintenanceLog.filter((entry) => entry.id !== entryId),
                updatedAt: new Date().toISOString(),
              }
            : item
        )),
      }));

      const item = get().items.find((entry) => entry.id === itemId);
      if (item) dependencies.syncItem(item);
    },

    addLendingRecord: (itemId, record) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      const nextRecord: LendingRecord = { ...record, id: generateId() };
      set((state) => ({
        items: state.items.map((item) => (
          item.id === itemId
            ? {
                ...item,
                lendingHistory: [...item.lendingHistory, nextRecord],
                updatedAt: new Date().toISOString(),
              }
            : item
        )),
      }));

      const item = get().items.find((entry) => entry.id === itemId);
      if (item) {
        dependencies.syncItem(item);
        get().logActivity({
          action: 'item_lent',
          entityType: 'item',
          entityId: itemId,
          entityTitle: item.title,
          details: `Lent to ${record.borrowerName}`,
        });
      }
    },

    returnLendingRecord: (itemId, recordId, condition) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      set((state) => ({
        items: state.items.map((item) => (
          item.id === itemId
            ? {
                ...item,
                lendingHistory: item.lendingHistory.map((record) => (
                  record.id === recordId
                    ? {
                        ...record,
                        actualReturnDate: new Date().toISOString().slice(0, 10),
                        condition,
                      }
                    : record
                )),
                updatedAt: new Date().toISOString(),
              }
            : item
        )),
      }));

      const item = get().items.find((entry) => entry.id === itemId);
      if (item) {
        dependencies.syncItem(item);
        get().logActivity({
          action: 'item_returned',
          entityType: 'item',
          entityId: itemId,
          entityTitle: item.title,
        });
      }
    },

    addWishlistItem: (data) => {
      if (!dependencies.ensurePermission('content:edit')) {
        return {
          ...data,
          id: '',
          isAcquired: false,
          createdAt: '',
          updatedAt: '',
        };
      }

      const now = new Date().toISOString();
      const wishlistItem: WishlistItem = {
        ...data,
        id: generateId(),
        isAcquired: false,
        createdAt: now,
        updatedAt: now,
      };

      set((state) => ({ wishlist: [...state.wishlist, wishlistItem] }));
      dependencies.syncWishlist(wishlistItem);
      get().logActivity({
        action: 'wishlist_added',
        entityType: 'wishlist',
        entityId: wishlistItem.id,
        entityTitle: wishlistItem.title,
      });
      return wishlistItem;
    },

    updateWishlistItem: (id, updates) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      set((state) => ({
        wishlist: state.wishlist.map((item) => (
          item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
        )),
      }));

      const wishlistItem = get().wishlist.find((item) => item.id === id);
      if (wishlistItem) dependencies.syncWishlist(wishlistItem);
    },

    deleteWishlistItem: (id) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      set((state) => ({ wishlist: state.wishlist.filter((item) => item.id !== id) }));
      if (get().ownerUserId && firestoreService.isAvailable()) {
        collectionSyncService.schedule(
          'Delete wishlist item',
          () => firestoreService.deleteWishlistItem(get().ownerUserId!, id),
          { scope: 'wishlist' },
        );
      }
    },

    acquireWishlistItem: (wishlistId, itemId) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      set((state) => ({
        wishlist: state.wishlist.map((item) => (
          item.id === wishlistId
            ? { ...item, isAcquired: true, acquiredItemId: itemId, updatedAt: new Date().toISOString() }
            : item
        )),
      }));

      const wishlistItem = get().wishlist.find((item) => item.id === wishlistId);
      if (wishlistItem) {
        dependencies.syncWishlist(wishlistItem);
        get().logActivity({
          action: 'wishlist_acquired',
          entityType: 'wishlist',
          entityId: wishlistId,
          entityTitle: wishlistItem.title,
        });
      }
    },

    archiveItem: (id) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      const item = get().items.find((entry) => entry.id === id);
      const now = new Date().toISOString();
      set((state) => ({
        items: state.items.map((entry) => (
          entry.id === id
            ? { ...entry, isArchived: true, archivedAt: now, updatedAt: now }
            : entry
        )),
      }));

      const updatedItem = get().items.find((entry) => entry.id === id);
      if (updatedItem) dependencies.syncItem(updatedItem);

      if (item) {
        get().logActivity({
          action: 'item_deleted',
          entityType: 'item',
          entityId: id,
          entityTitle: item.title,
          details: 'Archived',
        });
      }
    },

    archiveItems: (ids) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      const now = new Date().toISOString();
      set((state) => ({
        items: state.items.map((item) => (
          ids.includes(item.id)
            ? { ...item, isArchived: true, archivedAt: now, updatedAt: now }
            : item
        )),
      }));

      if (get().ownerUserId && firestoreService.isAvailable()) {
        const archivedItems = get().items.filter((item) => ids.includes(item.id));
        collectionSyncService.schedule(
          'Archive items',
          () => firestoreService.saveItems(get().ownerUserId!, archivedItems),
          { scope: 'items' },
        );
      }
    },

    recoverItem: (id) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      const item = get().items.find((entry) => entry.id === id);
      const now = new Date().toISOString();
      set((state) => ({
        items: state.items.map((entry) => (
          entry.id === id
            ? { ...entry, isArchived: false, archivedAt: undefined, updatedAt: now }
            : entry
        )),
      }));

      const updatedItem = get().items.find((entry) => entry.id === id);
      if (updatedItem) dependencies.syncItem(updatedItem);

      if (item) {
        get().logActivity({
          action: 'item_created',
          entityType: 'item',
          entityId: id,
          entityTitle: item.title,
          details: 'Recovered from archive',
        });
      }
    },

    recoverItems: (ids) => {
      if (!dependencies.ensurePermission('content:edit')) return;

      const now = new Date().toISOString();
      set((state) => ({
        items: state.items.map((item) => (
          ids.includes(item.id)
            ? { ...item, isArchived: false, archivedAt: undefined, updatedAt: now }
            : item
        )),
      }));

      if (get().ownerUserId && firestoreService.isAvailable()) {
        const recoveredItems = get().items.filter((item) => ids.includes(item.id));
        collectionSyncService.schedule(
          'Recover items',
          () => firestoreService.saveItems(get().ownerUserId!, recoveredItems),
          { scope: 'items' },
        );
      }
    },

    permanentDeleteItem: (id) => {
      if (!dependencies.ensurePermission('item:delete-permanently')) return;

      set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
      if (get().ownerUserId && firestoreService.isAvailable()) {
        collectionSyncService.schedule(
          'Delete item permanently',
          () => firestoreService.deleteItem(get().ownerUserId!, id),
          { scope: 'items' },
        );
      }
    },

    permanentDeleteItems: (ids) => {
      if (!dependencies.ensurePermission('item:delete-permanently')) return;

      set((state) => ({ items: state.items.filter((item) => !ids.includes(item.id)) }));
      if (get().ownerUserId && firestoreService.isAvailable()) {
        collectionSyncService.schedule(
          'Delete items permanently',
          () => firestoreService.deleteItems(get().ownerUserId!, ids),
          { scope: 'items' },
        );
      }
    },

    getArchivedItems: () => selectArchivedItems(get()),

    logActivity: (entry) => {
      const activityEntry: ActivityLogEntry = {
        ...entry,
        userId: dependencies.getCurrentActorId(),
        id: generateId(),
        timestamp: new Date().toISOString(),
      };

      set((state) => ({ activityLog: [activityEntry, ...state.activityLog] }));
      dependencies.syncActivity(activityEntry);
    },

    clearActivityLog: () => {
      if (!dependencies.ensurePermission('activity:clear')) return;

      set({ activityLog: [] });
      if (get().ownerUserId && firestoreService.isAvailable()) {
        collectionSyncService.schedule(
          'Clear activity log',
          () => firestoreService.clearActivityLog(get().ownerUserId!),
          { scope: 'activity' },
        );
      }
    },

    getCategoryById: (id) => selectCategoryById(get(), id),
    getCategoryBySlug: (slug) => selectCategoryBySlug(get(), slug),
    getItemsByCategory: (categoryId) => selectItemsByCategory(get(), categoryId),
    getItemById: (id) => selectItemById(get(), id),
    getContributorById: (id) => selectContributorById(get(), id),
    getFavoriteItems: () => selectFavoriteItems(get()),
    getLentItems: () => selectLentItems(get()),
    getTotalValue: () => selectTotalValue(get()),
    getCategoryStats: () => selectCategoryStats(get()),
    getRecentItems: (limit = 5) => selectRecentItems(get(), limit),
    getMostValuableItems: (limit = 5) => selectMostValuableItems(get(), limit),
    getMonthlyAcquisitions: () => selectMonthlyAcquisitions(get()),
    getValueOverTime: () => selectValueOverTime(get()),

    applyRemoteState: (userId, snapshot) => {
      const currentState = get();
      const nextTheme = snapshot.settings?.theme ?? currentState.theme;

      set({
        ownerUserId: userId,
        isRemoteDataLoading: false,
        categories: snapshot.categories,
        items: snapshot.items,
        libraries: snapshot.libraries,
        wishlist: snapshot.wishlist,
        activityLog: snapshot.activityLog,
        contributors: snapshot.contributors,
        displayCurrency: snapshot.settings?.displayCurrency ?? currentState.displayCurrency,
        theme: nextTheme,
        sidebarOpen: snapshot.settings?.sidebarOpen ?? currentState.sidebarOpen,
        menuCollectionStyle: snapshot.settings?.menuCollectionStyle ?? currentState.menuCollectionStyle,
        dashboardWidgets: snapshot.settings?.dashboardWidgets?.length
          ? snapshot.settings.dashboardWidgets
          : currentState.dashboardWidgets,
        readNotificationIds: snapshot.settings?.readNotificationIds ?? currentState.readNotificationIds,
        notifications: snapshot.settings?.notifications ?? currentState.notifications,
      });

      dependencies.applyThemeToDocument(nextTheme);
    },

    loadFromFirestore: async (userId) => {
      if (!firestoreService.isAvailable()) return;

      set({ isRemoteDataLoading: true });
      try {
        const data = await collectionSyncService.perform(
          'Load Firestore data',
          () => firestoreService.loadAll(userId),
          { kind: 'read', scope: 'bootstrap' },
        );

        if (hasRemoteSnapshotData(data)) {
          get().applyRemoteState(userId, data);
        } else {
          await get().syncAllToFirestore(userId);
          set({ isRemoteDataLoading: false });
        }
      } catch (error) {
        set({ isRemoteDataLoading: false });
        logger.error('firestore.load', error, { userId });
      }
    },

    subscribeToFirestore: (userId) => {
      firestoreUnsubscribe?.();
      if (!firestoreService.isAvailable()) return () => {};

      firestoreUnsubscribe = firestoreService.subscribeAll(
        userId,
        (snapshot: FirestoreSnapshot) => {
          if (get().ownerUserId !== userId) return;
          get().applyRemoteState(userId, snapshot);
        },
        (error) => {
          logger.error('firestore.subscribe', error, { userId });
        },
      );

      return () => {
        firestoreUnsubscribe?.();
        firestoreUnsubscribe = null;
      };
    },

    syncAllToFirestore: async (userId) => {
      if (!firestoreService.isAvailable()) return;

      const state = get();
      try {
        await collectionSyncService.perform(
          'Sync local data to Firestore',
          () => firestoreService.syncAll(userId, {
            categories: state.categories,
            items: state.items,
            libraries: state.libraries,
            wishlist: state.wishlist,
            activityLog: state.activityLog,
            contributors: state.contributors,
            settings: buildUserSettings(state),
          }),
          { kind: 'read', scope: 'bootstrap' },
        );
      } catch (error) {
        logger.error('firestore.syncAll', error, { userId });
      }
    },
  });
}
