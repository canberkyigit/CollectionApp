import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';

import type {
  ActivityLogEntry,
  Category,
  CollectionItem,
  Contributor,
  Library,
  WishlistItem,
} from '@/types';
import type { UserSettings } from '@/services/firestoreService';
import {
  cloneDefaultNotifications,
  cloneDefaultWidgets,
  createStarterCollectionData,
  DEFAULT_NOTIFICATIONS,
  STORE_VERSION,
} from '@/store/collectionStore.defaults';
import type {
  CollectionActor,
  CollectionStore,
  CollectionStoreDependencies,
} from '@/store/collectionStore.types';
import { createCollectionDataSlice } from '@/store/slices/collectionDataSlice';
import { createDashboardLayoutSlice } from '@/store/slices/dashboardLayoutSlice';
import { createNotificationSlice } from '@/store/slices/notificationSlice';
import { createUiPreferencesSlice } from '@/store/slices/uiPreferencesSlice';
import { mockCategories } from '@/data/categories';
import { getPermissionDeniedMessage, hasPermission, type CollectionPermission } from '@/lib/permissions';
import { normalizeLibrary } from '@/lib/libraries';
import { firestoreService } from '@/services/firestoreService';
import { collectionSyncService } from '@/services/collectionSyncService';
import { normalizeItemCustomFields } from '@/lib/itemForm';

let currentUserId: string | null = null;
let currentActor: CollectionActor = {
  id: 'offline',
  name: 'Local User',
  avatar: '',
  role: 'admin',
};

export function setFirebaseUserId(uid: string | null) {
  currentUserId = uid;
}

export function setCurrentCollectionActor(actor: CollectionActor | null) {
  currentActor = actor ?? {
    id: 'offline',
    name: 'Local User',
    avatar: '',
    role: 'admin',
  };
}

function getCurrentActorId(): string {
  return currentActor.id;
}

function applyThemeToDocument(theme: 'dark' | 'light') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.classList.toggle('light', theme === 'light');
}

function syncCategory(category: Category) {
  if (!currentUserId || !firestoreService.isAvailable()) return;
  collectionSyncService.scheduleFirestoreMutation('Save category', {
    action: 'saveCategory',
    userId: currentUserId,
    payload: category,
    scope: 'categories',
  });
}

function syncItem(item: CollectionItem) {
  if (!currentUserId || !firestoreService.isAvailable()) return;
  collectionSyncService.scheduleFirestoreMutation('Save item', {
    action: 'saveItem',
    userId: currentUserId,
    payload: item,
    scope: 'items',
  });
}

function syncWishlist(item: WishlistItem) {
  if (!currentUserId || !firestoreService.isAvailable()) return;
  collectionSyncService.scheduleFirestoreMutation('Save wishlist item', {
    action: 'saveWishlistItem',
    userId: currentUserId,
    payload: item,
    scope: 'wishlist',
  });
}

function syncActivity(entry: ActivityLogEntry) {
  if (!currentUserId || !firestoreService.isAvailable()) return;
  collectionSyncService.scheduleFirestoreMutation('Save activity entry', {
    action: 'addActivityEntry',
    userId: currentUserId,
    payload: entry,
    scope: 'activity',
  });
}

function syncLibrary(library: Library) {
  if (!currentUserId || !firestoreService.isAvailable()) return;
  collectionSyncService.scheduleFirestoreMutation('Save library', {
    action: 'saveLibrary',
    userId: currentUserId,
    payload: library,
    scope: 'libraries',
  });
}

function syncContributor(contributor: Contributor) {
  if (!currentUserId || !firestoreService.isAvailable()) return;
  collectionSyncService.scheduleFirestoreMutation('Save contributor', {
    action: 'saveContributor',
    userId: currentUserId,
    payload: contributor,
    scope: 'contributors',
  });
}

function deleteLibraryFromFirestore(libraryId: string) {
  if (!currentUserId || !firestoreService.isAvailable()) return;
  collectionSyncService.scheduleFirestoreMutation('Delete library', {
    action: 'deleteLibrary',
    userId: currentUserId,
    payload: { id: libraryId },
    scope: 'libraries',
  });
}

function syncSettings(partial: Partial<UserSettings>) {
  if (!currentUserId || !firestoreService.isAvailable()) return;
  collectionSyncService.scheduleFirestoreMutation('Save settings', {
    action: 'saveUserSettings',
    userId: currentUserId,
    payload: partial,
    scope: 'settings',
  });
}

function ensurePermission(permission: CollectionPermission): boolean {
  if (hasPermission(currentActor.role, permission)) return true;
  toast.error(getPermissionDeniedMessage(permission));
  return false;
}

const dependencies: CollectionStoreDependencies = {
  ensurePermission,
  getCurrentActorId,
  applyThemeToDocument,
  syncCategory,
  syncItem,
  syncWishlist,
  syncActivity,
  syncLibrary,
  syncContributor,
  deleteLibraryFromFirestore,
  syncSettings,
};

export function migrateCollectionStoreState(persistedState: unknown): Partial<CollectionStore> {
  const state = (persistedState ?? {}) as Partial<CollectionStore>;
  const mockFieldsById = new Map(mockCategories.map((category) => [category.id, category.fields]));
  const starterData = createStarterCollectionData();

  return {
    ...state,
    ownerUserId: state.ownerUserId ?? null,
    isRemoteDataLoading: false,
    categories: (state.categories ?? starterData.categories).map((category) => {
      if (category.fields && category.fields.length > 0) return category;
      const fields = mockFieldsById.get(category.id);
      return fields ? { ...category, fields } : category;
    }),
    contributors: (state.contributors ?? starterData.contributors).map((contributor) => ({
      ...contributor,
      role: contributor.role ?? 'viewer',
    })),
    libraries: (state.libraries ?? []).map((library) => normalizeLibrary(library)),
    items: (state.items ?? starterData.items).map((item) => ({
      ...item,
      customFields: normalizeItemCustomFields(item.customFields),
      purchaseInfo: {
        ...item.purchaseInfo,
        currencyEquivalents: item.purchaseInfo.currencyEquivalents ?? [],
      },
      documents: item.documents ?? [],
    })),
    dashboardWidgets: state.dashboardWidgets?.length
      ? state.dashboardWidgets
      : cloneDefaultWidgets(),
    notifications: state.notifications ?? cloneDefaultNotifications(),
    readNotificationIds: state.readNotificationIds ?? [],
    sidebarOpen: state.sidebarOpen ?? true,
    menuCollectionStyle: state.menuCollectionStyle ?? 'style1',
    viewMode: state.viewMode ?? 'grid',
    searchQuery: state.searchQuery ?? '',
    sortField: state.sortField ?? 'createdAt',
    sortOrder: state.sortOrder ?? 'desc',
    selectedTags: state.selectedTags ?? [],
    theme: state.theme ?? 'light',
    displayCurrency: state.displayCurrency ?? 'USD',
    itemDialogOpen: false,
    itemDialogCategoryId: null,
    itemDialogItem: null,
  } satisfies Partial<CollectionStore>;
}

export const useCollectionStore = create<CollectionStore>()(
  persist(
    (...args) => ({
      ...createCollectionDataSlice(dependencies)(...args),
      ...createUiPreferencesSlice(dependencies)(...args),
      ...createDashboardLayoutSlice(dependencies)(...args),
      ...createNotificationSlice(dependencies)(...args),
    }),
    {
      name: 'collectvault-store',
      version: STORE_VERSION,
      partialize: (state): Partial<CollectionStore> => ({
        ownerUserId: state.ownerUserId,
        isRemoteDataLoading: false as const,
        categories: state.categories,
        items: state.items,
        libraries: state.libraries,
        contributors: state.contributors,
        wishlist: state.wishlist,
        activityLog: state.activityLog,
        theme: state.theme,
        displayCurrency: state.displayCurrency,
        dashboardWidgets: state.dashboardWidgets,
        sidebarOpen: state.sidebarOpen,
        menuCollectionStyle: state.menuCollectionStyle,
        readNotificationIds: state.readNotificationIds,
        notifications: state.notifications,
      }),
      migrate: migrateCollectionStoreState,
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        applyThemeToDocument(state.theme);

        const mockFieldsById = new Map(mockCategories.map((category) => [category.id, category.fields]));
        state.categories = state.categories.map((category) => {
          if (category.fields && category.fields.length > 0) return category;
          const fields = mockFieldsById.get(category.id);
          return fields ? { ...category, fields } : category;
        });

        if (!state.notifications) {
          state.notifications = DEFAULT_NOTIFICATIONS;
        }

        state.libraries = state.libraries.map((library) => normalizeLibrary(library));

        state.items = state.items.map((item) => {
          const customFields = normalizeItemCustomFields(item.customFields);
          return { ...item, customFields, documents: item.documents ?? [] };
        });
      },
    },
  ),
);

export type { CollectionStore } from '@/store/collectionStore.types';
