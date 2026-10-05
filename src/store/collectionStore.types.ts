import type { StateCreator } from 'zustand';

import type {
  ActivityLogEntry,
  Category,
  CollectionItem,
  Contributor,
  ContributorRole,
  DashboardWidgetConfig,
  DashboardWidgetId,
  LendingRecord,
  Library,
  MaintenanceEntry,
  ProvenanceDocument,
  ValueHistoryEntry,
  SortField,
  SortOrder,
  ViewMode,
  WishlistItem,
} from '@/types';
import type { FirestoreSnapshot, UserSettings } from '@/services/firestoreService';
import type { BackupBundle, BackupRestoreMode } from '@/services/backupRestoreService';
import type { CollectionPermission } from '@/lib/permissions';

export interface CollectionStoreBaseState {
  ownerUserId: string | null;
  isRemoteDataLoading: boolean;
  categories: Category[];
  items: CollectionItem[];
  libraries: Library[];
  contributors: Contributor[];
  wishlist: WishlistItem[];
  activityLog: ActivityLogEntry[];
}

/** Seed values for a new item (e.g. converting a wishlist entry). */
export interface ItemDialogPrefill {
  title?: string;
  description?: string;
  images?: string[];
  tags?: string[];
  notes?: string;
  purchasePrice?: number;
  purchaseCurrency?: string;
  purchaseDate?: string;
  purchasePlace?: string;
}

export interface ItemDialogOptions {
  prefill?: ItemDialogPrefill;
  /** When set, saving the new item calls acquireWishlistItem(wishlistId, newItemId). */
  wishlistId?: string;
}

export interface UiPreferencesSlice {
  viewMode: ViewMode;
  searchQuery: string;
  sortField: SortField;
  sortOrder: SortOrder;
  selectedTags: string[];
  sidebarOpen: boolean;
  menuCollectionStyle: 'style1' | 'style2';
  theme: 'dark' | 'light';
  displayCurrency: string;
  itemDialogOpen: boolean;
  itemDialogCategoryId: string | null;
  itemDialogItem: CollectionItem | null;
  /** Optional seed values + wishlist link for a NEW item opened via openItemDialog. */
  itemDialogOptions: ItemDialogOptions | null;
  /** Denser UI (html.compact). Device-local preference. */
  compactMode: boolean;
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  setSortField: (field: SortField) => void;
  setSortOrder: (order: SortOrder) => void;
  toggleSidebar: () => void;
  setMenuCollectionStyle: (style: 'style1' | 'style2') => void;
  toggleTheme: () => void;
  setDisplayCurrency: (currency: string) => void;
  openItemDialog: (categoryId: string, item?: CollectionItem, options?: ItemDialogOptions) => void;
  closeItemDialog: () => void;
  setCompactMode: (compact: boolean) => void;
}

export interface DashboardLayoutSlice {
  dashboardWidgets: DashboardWidgetConfig[];
  toggleWidgetVisibility: (id: DashboardWidgetId) => void;
  moveWidget: (id: DashboardWidgetId, direction: 'up' | 'down') => void;
  setWidgetSize: (id: DashboardWidgetId, size: DashboardWidgetConfig['size']) => void;
  resetDashboardLayout: () => void;
  /** Replace the whole widget list (e.g. after drag reorder or merging new defaults). */
  setDashboardWidgets: (widgets: DashboardWidgetConfig[]) => void;
}

export interface NotificationPreferencesSlice {
  readNotificationIds: string[];
  notifications: {
    valueChangeAlerts: boolean;
    newItemReminders: boolean;
    collectionMilestones: boolean;
  };
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  setNotifications: (updates: Partial<{
    valueChangeAlerts: boolean;
    newItemReminders: boolean;
    collectionMilestones: boolean;
  }>) => void;
}

export interface CollectionDataSlice extends CollectionStoreBaseState {
  upsertContributorProfile: (contributor: Contributor) => void;
  resetForUser: (userId: string | null, mode?: 'starter' | 'empty') => void;
  wipeAllData: () => Promise<void>;

  addCategory: (category: Omit<Category, 'id' | 'order' | 'createdAt' | 'updatedAt'>) => Category;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (orderedIds: string[]) => void;

  addLibrary: (lib: Omit<Library, 'id' | 'order' | 'createdAt' | 'updatedAt'>) => Library;
  updateLibrary: (id: string, updates: Partial<Library>) => void;
  deleteLibrary: (id: string) => void;
  getLibrariesByCategory: (categoryId: string) => Library[];
  bulkTransferToLibrary: (itemIds: string[], libraryId: string) => void;
  toggleRead: (id: string) => void;

  addItem: (item: Omit<CollectionItem, 'id' | 'createdAt' | 'updatedAt'>) => CollectionItem;
  bulkAddItems: (items: Omit<CollectionItem, 'id' | 'createdAt' | 'updatedAt'>[]) => number;
  updateItem: (id: string, updates: Partial<CollectionItem>) => void;
  deleteItem: (id: string) => void;
  deleteItems: (ids: string[]) => void;
  toggleFavorite: (id: string) => void;

  bulkMoveItems: (ids: string[], targetCategoryId: string) => void;
  bulkUpdateCondition: (ids: string[], condition: string) => void;
  bulkAddTag: (ids: string[], tag: string) => void;
  bulkToggleFavorite: (ids: string[], favorite: boolean) => void;
  /** Shallow-merges the same updates into many items (e.g. location). One activity entry. */
  bulkUpdateItems: (ids: string[], updates: Partial<CollectionItem>, details?: string) => void;
  /** Sets one custom field on many items; `undefined` clears it. */
  bulkSetCustomField: (ids: string[], fieldKey: string, value: unknown) => void;
  bulkRemoveTag: (ids: string[], tag: string) => void;
  /** Sets the current estimated value and appends today's value-history entry. */
  bulkSetCurrentValue: (ids: string[], value: number, currency: string) => void;
  /** Renames a tag on every item; merges into `to` when it already exists. Returns items changed. */
  renameTag: (from: string, to: string) => number;
  /** Merges several tags into one. Returns items changed. */
  mergeTags: (sources: string[], target: string) => number;
  /** Removes a tag from every item. Returns items changed. */
  removeTag: (tag: string) => number;

  addMaintenanceEntry: (itemId: string, entry: Omit<MaintenanceEntry, 'id'>) => void;
  removeMaintenanceEntry: (itemId: string, entryId: string) => void;
  updateMaintenanceEntry: (itemId: string, entryId: string, patch: Partial<Omit<MaintenanceEntry, 'id'>>) => void;

  /** Appends a dated valuation; updates the current value when it is the newest entry. */
  addValuationEntry: (itemId: string, entry: ValueHistoryEntry) => void;

  addItemDocument: (itemId: string, document: Omit<ProvenanceDocument, 'id' | 'uploadedAt'>) => ProvenanceDocument | null;
  removeItemDocument: (itemId: string, documentId: string) => void;

  addLendingRecord: (itemId: string, record: Omit<LendingRecord, 'id'>) => void;
  returnLendingRecord: (itemId: string, recordId: string, condition: LendingRecord['condition']) => void;

  addWishlistItem: (item: Omit<WishlistItem, 'id' | 'createdAt' | 'updatedAt' | 'isAcquired'>) => WishlistItem;
  updateWishlistItem: (id: string, updates: Partial<WishlistItem>) => void;
  deleteWishlistItem: (id: string) => void;
  acquireWishlistItem: (wishlistId: string, itemId: string) => void;

  archiveItem: (id: string) => void;
  archiveItems: (ids: string[]) => void;
  recoverItem: (id: string) => void;
  recoverItems: (ids: string[]) => void;
  permanentDeleteItem: (id: string) => void;
  permanentDeleteItems: (ids: string[]) => void;
  getArchivedItems: () => CollectionItem[];

  logActivity: (entry: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'userId'>) => void;
  clearActivityLog: () => void;

  restoreBackupBundle: (
    backup: BackupBundle,
    mode: BackupRestoreMode,
    options?: { skipRemoteSync?: boolean },
  ) => Promise<void>;

  getCategoryById: (id: string) => Category | undefined;
  getCategoryBySlug: (slug: string) => Category | undefined;
  getItemsByCategory: (categoryId: string) => CollectionItem[];
  getItemById: (id: string) => CollectionItem | undefined;
  getContributorById: (id: string) => Contributor | undefined;
  getFavoriteItems: () => CollectionItem[];
  getLentItems: () => CollectionItem[];


  applyRemoteState: (userId: string, snapshot: FirestoreSnapshot) => void;
  loadFromFirestore: (userId: string) => Promise<boolean>;
  subscribeToFirestore: (userId: string) => () => void;
  syncAllToFirestore: (userId: string) => Promise<void>;
}

export type CollectionStore = CollectionDataSlice
  & UiPreferencesSlice
  & DashboardLayoutSlice
  & NotificationPreferencesSlice;

export type CollectionStoreCreator<TSlice> = StateCreator<CollectionStore, [], [], TSlice>;

export interface CollectionStoreDependencies {
  ensurePermission: (permission: CollectionPermission) => boolean;
  getCurrentActorId: () => string;
  applyThemeToDocument: (theme: 'dark' | 'light') => void;
  syncCategory: (category: Category) => void;
  syncItem: (item: CollectionItem) => void;
  syncWishlist: (item: WishlistItem) => void;
  syncActivity: (entry: ActivityLogEntry) => void;
  syncLibrary: (library: Library) => void;
  syncContributor: (contributor: Contributor) => void;
  deleteLibraryFromFirestore: (libraryId: string) => void;
  syncSettings: (partial: Partial<UserSettings>) => void;
}

export interface CollectionStoreResetOptions {
  userId: string | null;
  mode?: 'starter' | 'empty';
}

export interface CollectionActor {
  id: string;
  name: string;
  avatar: string;
  role: ContributorRole;
}
