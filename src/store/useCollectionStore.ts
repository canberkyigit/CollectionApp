import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Category, CollectionItem, Contributor, WishlistItem,
  ActivityLogEntry, MaintenanceEntry, LendingRecord, Library,
  ViewMode, SortField, SortOrder, DashboardWidgetConfig, DashboardWidgetId,
} from '@/types';
import { mockCategories } from '@/data/categories';
import { mockItems, mockWishlistItems, mockActivityLog } from '@/data/items';
import { mockContributors } from '@/data/contributors';
import { currencyService } from '@/services/currencyService';
import { firestoreService } from '@/services/firestoreService';
import type { UserSettings } from '@/services/firestoreService';
import { generateId, slugify } from '@/lib/utils';
import { toast } from 'sonner';

let _currentUserId: string | null = null;
export function setFirebaseUserId(uid: string | null) {
  _currentUserId = uid;
}

function syncItem(item: CollectionItem) {
  if (_currentUserId && firestoreService.isAvailable()) {
    firestoreService.saveItem(_currentUserId, item).catch(console.error);
  }
}
function syncCategory(cat: Category) {
  if (_currentUserId && firestoreService.isAvailable()) {
    firestoreService.saveCategory(_currentUserId, cat).catch(console.error);
  }
}
function syncWishlist(item: WishlistItem) {
  if (_currentUserId && firestoreService.isAvailable()) {
    firestoreService.saveWishlistItem(_currentUserId, item).catch(console.error);
  }
}
function syncActivity(entry: ActivityLogEntry) {
  if (_currentUserId && firestoreService.isAvailable()) {
    firestoreService.addActivityEntry(_currentUserId, entry).catch(console.error);
  }
}
function syncLibrary(lib: Library) {
  if (_currentUserId && firestoreService.isAvailable()) {
    firestoreService.saveLibrary(_currentUserId, lib).catch(console.error);
  }
}
function deleteLibraryFromFirestore(id: string) {
  if (_currentUserId && firestoreService.isAvailable()) {
    firestoreService.deleteLibrary(_currentUserId, id).catch(console.error);
  }
}
function syncSettings(partial: Partial<UserSettings>) {
  if (_currentUserId && firestoreService.isAvailable()) {
    firestoreService.saveUserSettings(_currentUserId, partial).catch(console.error);
  }
}

interface CollectionStore {
  categories: Category[];
  items: CollectionItem[];
  libraries: Library[];
  contributors: Contributor[];
  wishlist: WishlistItem[];
  activityLog: ActivityLogEntry[];

  viewMode: ViewMode;
  searchQuery: string;
  sortField: SortField;
  sortOrder: SortOrder;
  selectedTags: string[];
  sidebarOpen: boolean;
  menuCollectionStyle: 'style1' | 'style2';
  theme: 'dark' | 'light';
  displayCurrency: string;
  dashboardWidgets: DashboardWidgetConfig[];
  readNotificationIds: string[];
  notifications: { valueChangeAlerts: boolean; newItemReminders: boolean; collectionMilestones: boolean };

  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  setSortField: (field: SortField) => void;
  setSortOrder: (order: SortOrder) => void;
  setSelectedTags: (tags: string[]) => void;
  toggleSidebar: () => void;
  setMenuCollectionStyle: (style: 'style1' | 'style2') => void;
  toggleTheme: () => void;
  setDisplayCurrency: (currency: string) => void;
  toggleWidgetVisibility: (id: DashboardWidgetId) => void;
  moveWidget: (id: DashboardWidgetId, direction: 'up' | 'down') => void;
  setWidgetSize: (id: DashboardWidgetId, size: DashboardWidgetConfig['size']) => void;
  resetDashboardLayout: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  setNotifications: (updates: Partial<{ valueChangeAlerts: boolean; newItemReminders: boolean; collectionMilestones: boolean }>) => void;

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

  addMaintenanceEntry: (itemId: string, entry: Omit<MaintenanceEntry, 'id'>) => void;
  removeMaintenanceEntry: (itemId: string, entryId: string) => void;

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

  logActivity: (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => void;
  clearActivityLog: () => void;

  getCategoryById: (id: string) => Category | undefined;
  getCategoryBySlug: (slug: string) => Category | undefined;
  getItemsByCategory: (categoryId: string) => CollectionItem[];
  getItemById: (id: string) => CollectionItem | undefined;
  getContributorById: (id: string) => Contributor | undefined;
  getFavoriteItems: () => CollectionItem[];
  getLentItems: () => CollectionItem[];

  getTotalValue: () => number;
  getCategoryStats: () => { categoryId: string; name: string; count: number; totalValue: number }[];
  getRecentItems: (limit?: number) => CollectionItem[];
  getMostValuableItems: (limit?: number) => CollectionItem[];
  getMonthlyAcquisitions: () => { month: string; count: number; value: number }[];
  getValueOverTime: () => { date: string; value: number }[];

  itemDialogOpen: boolean;
  itemDialogCategoryId: string | null;
  itemDialogItem: CollectionItem | null;
  openItemDialog: (categoryId: string, item?: CollectionItem) => void;
  closeItemDialog: () => void;

  loadFromFirestore: (userId: string) => Promise<void>;
  syncAllToFirestore: (userId: string) => Promise<void>;
}

const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
  { id: 'stats', label: 'Statistics', description: 'Total value, items, categories, contributors', icon: 'BarChart3', visible: true, order: 0, size: 'full' },
  { id: 'value-over-time', label: 'Value Over Time', description: 'Portfolio valuation trend chart', icon: 'TrendingUp', visible: true, order: 1, size: 'half' },
  { id: 'category-distribution', label: 'Category Distribution', description: 'Items per category donut chart', icon: 'PieChart', visible: true, order: 2, size: 'half' },
  { id: 'value-by-category', label: 'Value by Category', description: 'Total value per category bar chart', icon: 'BarChart', visible: true, order: 3, size: 'half' },
  { id: 'acquisition-timeline', label: 'Acquisition Timeline', description: 'Monthly items acquired and spend', icon: 'Calendar', visible: true, order: 4, size: 'half' },
  { id: 'recent-items', label: 'Recently Added', description: 'Latest additions to your collection', icon: 'Clock', visible: true, order: 5, size: 'half' },
  { id: 'contributors', label: 'Top Contributors', description: 'Most active team members', icon: 'Users', visible: true, order: 6, size: 'third' },
  { id: 'starred-items', label: 'Starred Items', description: 'Your favorite collection pieces', icon: 'Star', visible: true, order: 7, size: 'third' },
  { id: 'wishlist', label: 'Wishlist', description: 'Items you want to acquire', icon: 'Heart', visible: true, order: 8, size: 'third' },
  { id: 'recent-activity', label: 'Recent Activity', description: 'Latest actions and changes', icon: 'Activity', visible: true, order: 9, size: 'third' },
  { id: 'quick-actions', label: 'Quick Actions', description: 'Shortcut buttons for common tasks', icon: 'Zap', visible: true, order: 10, size: 'full' },
];

export const useCollectionStore = create<CollectionStore>()(
  persist(
    (set, get) => ({
  categories: mockCategories,
  items: mockItems,
  libraries: [],
  contributors: mockContributors,
  wishlist: mockWishlistItems,
  activityLog: mockActivityLog,

  viewMode: 'grid',
  searchQuery: '',
  sortField: 'createdAt',
  sortOrder: 'desc',
  selectedTags: [],
  sidebarOpen: true,
  menuCollectionStyle: 'style1',
  theme: 'light',
  displayCurrency: 'USD',
  dashboardWidgets: DEFAULT_WIDGETS,
  readNotificationIds: [],
  notifications: { valueChangeAlerts: true, newItemReminders: true, collectionMilestones: true },

  itemDialogOpen: false,
  itemDialogCategoryId: null,
  itemDialogItem: null,
  openItemDialog: (categoryId, item) => set({ itemDialogOpen: true, itemDialogCategoryId: categoryId, itemDialogItem: item ?? null }),
  closeItemDialog: () => set({ itemDialogOpen: false, itemDialogCategoryId: null, itemDialogItem: null }),

  setViewMode: (mode) => set({ viewMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSortField: (field) => set({ sortField: field }),
  setSortOrder: (order) => set({ sortOrder: order }),
  setSelectedTags: (tags) => set({ selectedTags: tags }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setMenuCollectionStyle: (style) => {
    set({ menuCollectionStyle: style });
    syncSettings({ menuCollectionStyle: style });
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('light', next === 'light');
    document.documentElement.classList.toggle('dark', next === 'dark');
    set({ theme: next });
    syncSettings({ theme: next });
  },
  setDisplayCurrency: (currency) => {
    set({ displayCurrency: currency });
    syncSettings({ displayCurrency: currency });
  },
  toggleWidgetVisibility: (id) => {
    set((s) => ({
      dashboardWidgets: s.dashboardWidgets.map((w) =>
        w.id === id ? { ...w, visible: !w.visible } : w
      ),
    }));
    syncSettings({ dashboardWidgets: get().dashboardWidgets });
  },
  moveWidget: (id, direction) => {
    set((s) => {
      const widgets = [...s.dashboardWidgets].sort((a, b) => a.order - b.order);
      const idx = widgets.findIndex((w) => w.id === id);
      if (idx === -1) return s;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= widgets.length) return s;
      const tempOrder = widgets[idx].order;
      widgets[idx] = { ...widgets[idx], order: widgets[swapIdx].order };
      widgets[swapIdx] = { ...widgets[swapIdx], order: tempOrder };
      return { dashboardWidgets: widgets };
    });
    syncSettings({ dashboardWidgets: get().dashboardWidgets });
  },
  setWidgetSize: (id, size) => {
    set((s) => ({
      dashboardWidgets: s.dashboardWidgets.map((w) =>
        w.id === id ? { ...w, size } : w
      ),
    }));
    syncSettings({ dashboardWidgets: get().dashboardWidgets });
  },
  resetDashboardLayout: () => {
    set({ dashboardWidgets: DEFAULT_WIDGETS });
    syncSettings({ dashboardWidgets: DEFAULT_WIDGETS });
  },
  markNotificationRead: (id) => {
    const current = get().readNotificationIds;
    if (!current.includes(id)) {
      const updated = [...current, id];
      set({ readNotificationIds: updated });
      syncSettings({ readNotificationIds: updated });
    }
  },
  markAllNotificationsRead: () => {
    const allIds = get().activityLog.slice(0, 20).map((e) => e.id);
    const merged = [...new Set([...get().readNotificationIds, ...allIds])];
    set({ readNotificationIds: merged });
    syncSettings({ readNotificationIds: merged });
  },
  setNotifications: (updates) => {
    set((s) => ({ notifications: { ...s.notifications, ...updates } }));
    syncSettings({ notifications: get().notifications });
  },

  // ── Categories ──
  addCategory: (data) => {
    const now = new Date().toISOString();
    const maxOrder = get().categories.reduce((max, c) => Math.max(max, c.order ?? 0), -1);
    const category: Category = { ...data, id: generateId(), slug: slugify(data.name), order: maxOrder + 1, createdAt: now, updatedAt: now };
    set((s) => ({ categories: [...s.categories, category] }));
    syncCategory(category);
    get().logActivity({ action: 'category_created', entityType: 'category', entityId: category.id, entityTitle: category.name, userId: 'contrib-1' });
    return category;
  },
  updateCategory: (id, updates) => {
    set((s) => ({ categories: s.categories.map((c) => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c) }));
    const cat = get().categories.find((c) => c.id === id);
    if (cat) {
      syncCategory(cat);
      get().logActivity({ action: 'category_updated', entityType: 'category', entityId: id, entityTitle: cat.name, userId: 'contrib-1' });
    }
  },
  deleteCategory: (id) => {
    const cat = get().categories.find((c) => c.id === id);
    const orphanedItemIds = get().items.filter((i) => i.categoryId === id).map((i) => i.id);
    const orphanedLibIds = get().libraries.filter((l) => l.categoryId === id).map((l) => l.id);
    set((s) => ({
      categories: s.categories.filter((c) => c.id !== id),
      items: s.items.filter((i) => i.categoryId !== id),
      libraries: s.libraries.filter((l) => l.categoryId !== id),
    }));
    if (_currentUserId && firestoreService.isAvailable()) {
      firestoreService.deleteCategory(_currentUserId, id).catch(console.error);
      if (orphanedItemIds.length > 0) firestoreService.deleteItems(_currentUserId, orphanedItemIds).catch(console.error);
      orphanedLibIds.forEach((libId) => firestoreService.deleteLibrary(_currentUserId!, libId).catch(console.error));
    }
    if (cat) get().logActivity({ action: 'category_deleted', entityType: 'category', entityId: id, entityTitle: cat.name, userId: 'contrib-1' });
  },
  reorderCategories: (orderedIds) => {
    set((s) => ({
      categories: s.categories.map((c) => {
        const idx = orderedIds.indexOf(c.id);
        return idx !== -1 ? { ...c, order: idx } : c;
      }),
    }));
    if (_currentUserId && firestoreService.isAvailable()) {
      get().categories.forEach((c) => syncCategory(c));
    }
  },

  // ── Libraries ──
  addLibrary: (data) => {
    const now = new Date().toISOString();
    const maxOrder = get().libraries.filter((l) => l.categoryId === data.categoryId).reduce((max, l) => Math.max(max, l.order ?? 0), -1);
    const lib: Library = { ...data, id: generateId(), order: maxOrder + 1, createdAt: now, updatedAt: now };
    set((s) => ({ libraries: [...s.libraries, lib] }));
    syncLibrary(lib);
    return lib;
  },
  updateLibrary: (id, updates) => {
    set((s) => ({ libraries: s.libraries.map((l) => l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l) }));
    const updated = get().libraries.find((l) => l.id === id);
    if (updated) syncLibrary(updated);
  },
  deleteLibrary: (id) => {
    const affectedItems = get().items.filter((i) => i.libraryId === id);
    set((s) => ({
      libraries: s.libraries.filter((l) => l.id !== id),
      items: s.items.map((i) => i.libraryId === id ? { ...i, libraryId: undefined, updatedAt: new Date().toISOString() } : i),
    }));
    deleteLibraryFromFirestore(id);
    affectedItems.forEach((i) => {
      const updated = get().items.find((item) => item.id === i.id);
      if (updated) syncItem(updated);
    });
  },
  getLibrariesByCategory: (categoryId) => get().libraries.filter((l) => l.categoryId === categoryId).sort((a, b) => a.order - b.order),
  bulkTransferToLibrary: (itemIds, libraryId) => {
    const now = new Date().toISOString();
    set((s) => ({
      items: s.items.map((i) => itemIds.includes(i.id) ? { ...i, libraryId, updatedAt: now } : i),
    }));
    itemIds.forEach((id) => {
      const updated = get().items.find((i) => i.id === id);
      if (updated) syncItem(updated);
    });
    const lib = get().libraries.find((l) => l.id === libraryId);
    get().logActivity({ action: 'item_updated', entityType: 'item', entityId: itemIds[0], entityTitle: `${itemIds.length} items`, details: `Transferred to library "${lib?.name ?? libraryId}"`, userId: 'contrib-1' });
  },
  toggleRead: (id) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    const next = !item.isRead;
    set((s) => ({ items: s.items.map((i) => i.id === id ? { ...i, isRead: next, updatedAt: new Date().toISOString() } : i) }));
    const updated = get().items.find((i) => i.id === id);
    if (updated) syncItem(updated);
  },

  // ── Items ──
  addItem: (data) => {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const valInfo = data.valuationInfo;
    const initialHistory =
      valInfo.currentEstimatedValue > 0 && valInfo.valueHistory.length === 0
        ? [{ date: today, value: valInfo.currentEstimatedValue, currency: valInfo.currentValueCurrency }]
        : valInfo.valueHistory;
    const item: CollectionItem = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      valuationInfo: { ...valInfo, valueHistory: initialHistory },
    };
    set((s) => ({ items: [...s.items, item] }));
    syncItem(item);
    const activeCount = get().items.filter((i) => !i.isArchived).length;
    const milestones = [10, 25, 50, 100, 250, 500];
    if (get().notifications.collectionMilestones && milestones.includes(activeCount)) {
      toast.success(`Collection milestone: ${activeCount} items!`);
    }
    get().logActivity({ action: 'item_created', entityType: 'item', entityId: item.id, entityTitle: item.title, userId: 'contrib-1' });
    return item;
  },
  bulkAddItems: (data) => {
    const now = new Date().toISOString();
    const newItems = data.map((d) => ({ ...d, id: generateId(), createdAt: now, updatedAt: now } as CollectionItem));
    set((s) => ({ items: [...s.items, ...newItems] }));
    if (_currentUserId && firestoreService.isAvailable()) {
      firestoreService.saveItems(_currentUserId, newItems).catch(console.error);
    }
    get().logActivity({ action: 'item_created', entityType: 'system', entityId: 'bulk-import', entityTitle: `Bulk Import (${newItems.length} items)`, userId: 'contrib-1' });
    return newItems.length;
  },
  updateItem: (id, updates) => {
    const existing = get().items.find((i) => i.id === id);
    const now = new Date().toISOString();
    set((s) => ({ items: s.items.map((i) => i.id === id ? { ...i, ...updates, updatedAt: now } : i) }));
    if (existing && updates.valuationInfo?.currentEstimatedValue !== undefined) {
      const oldValue = existing.valuationInfo.currentEstimatedValue;
      const newValue = updates.valuationInfo.currentEstimatedValue;
      if (newValue !== oldValue && newValue > 0) {
        const today = now.slice(0, 10);
        const currentHistory = updates.valuationInfo.valueHistory ?? existing.valuationInfo.valueHistory;
        if (!currentHistory.some((e) => e.date === today)) {
          const newEntry = {
            date: today,
            value: newValue,
            currency: updates.valuationInfo.currentValueCurrency ?? existing.valuationInfo.currentValueCurrency,
          };
          set((s) => ({
            items: s.items.map((i) =>
              i.id === id
                ? { ...i, valuationInfo: { ...i.valuationInfo, valueHistory: [...i.valuationInfo.valueHistory, newEntry] } }
                : i,
            ),
          }));
        }
        if (get().notifications.valueChangeAlerts && oldValue > 0) {
          const changePct = ((newValue - oldValue) / oldValue) * 100;
          if (Math.abs(changePct) >= 10) {
            const dir = changePct > 0 ? 'increased' : 'decreased';
            toast.info(`Value ${dir} by ${Math.abs(changePct).toFixed(1)}% for "${existing.title}"`);
          }
        }
      }
    }
    const item = get().items.find((i) => i.id === id);
    if (item) {
      syncItem(item);
      get().logActivity({ action: 'item_updated', entityType: 'item', entityId: id, entityTitle: item.title, userId: 'contrib-1' });
    }
  },
  deleteItem: (id) => {
    const item = get().items.find((i) => i.id === id);
    const now = new Date().toISOString();
    set((s) => ({ items: s.items.map((i) => i.id === id ? { ...i, isArchived: true, archivedAt: now, updatedAt: now } : i) }));
    const updated = get().items.find((i) => i.id === id);
    if (updated) syncItem(updated);
    if (item) get().logActivity({ action: 'item_deleted', entityType: 'item', entityId: id, entityTitle: item.title, userId: 'contrib-1' });
  },
  deleteItems: (ids) => {
    const now = new Date().toISOString();
    set((s) => ({ items: s.items.map((i) => ids.includes(i.id) ? { ...i, isArchived: true, archivedAt: now, updatedAt: now } : i) }));
    if (_currentUserId && firestoreService.isAvailable()) {
      const updated = get().items.filter((i) => ids.includes(i.id));
      firestoreService.saveItems(_currentUserId, updated).catch(console.error);
    }
  },

  bulkMoveItems: (ids, targetCategoryId) => {
    const now = new Date().toISOString();
    set((s) => ({
      items: s.items.map((i) => ids.includes(i.id) ? { ...i, categoryId: targetCategoryId, updatedAt: now } : i),
    }));
    if (_currentUserId && firestoreService.isAvailable()) {
      const updated = get().items.filter((i) => ids.includes(i.id));
      firestoreService.saveItems(_currentUserId, updated).catch(console.error);
    }
    const cat = get().getCategoryById(targetCategoryId);
    get().logActivity({ action: 'item_updated', entityType: 'item', entityId: ids[0], entityTitle: `${ids.length} items`, details: `Bulk moved to ${cat?.name ?? targetCategoryId}`, userId: 'contrib-1' });
  },

  bulkUpdateCondition: (ids, condition) => {
    const now = new Date().toISOString();
    set((s) => ({
      items: s.items.map((i) => ids.includes(i.id) ? { ...i, condition, updatedAt: now } : i),
    }));
    if (_currentUserId && firestoreService.isAvailable()) {
      const updated = get().items.filter((i) => ids.includes(i.id));
      firestoreService.saveItems(_currentUserId, updated).catch(console.error);
    }
    get().logActivity({ action: 'item_updated', entityType: 'item', entityId: ids[0], entityTitle: `${ids.length} items`, details: `Bulk condition set to ${condition}`, userId: 'contrib-1' });
  },

  bulkAddTag: (ids, tag) => {
    const now = new Date().toISOString();
    set((s) => ({
      items: s.items.map((i) => ids.includes(i.id) ? { ...i, tags: i.tags.includes(tag) ? i.tags : [...i.tags, tag], updatedAt: now } : i),
    }));
    if (_currentUserId && firestoreService.isAvailable()) {
      const updated = get().items.filter((i) => ids.includes(i.id));
      firestoreService.saveItems(_currentUserId, updated).catch(console.error);
    }
    get().logActivity({ action: 'item_updated', entityType: 'item', entityId: ids[0], entityTitle: `${ids.length} items`, details: `Bulk added tag "${tag}"`, userId: 'contrib-1' });
  },

  bulkToggleFavorite: (ids, favorite) => {
    const now = new Date().toISOString();
    set((s) => ({
      items: s.items.map((i) => ids.includes(i.id) ? { ...i, isFavorite: favorite, updatedAt: now } : i),
    }));
    if (_currentUserId && firestoreService.isAvailable()) {
      const updated = get().items.filter((i) => ids.includes(i.id));
      firestoreService.saveItems(_currentUserId, updated).catch(console.error);
    }
    get().logActivity({ action: favorite ? 'item_favorited' : 'item_unfavorited', entityType: 'item', entityId: ids[0], entityTitle: `${ids.length} items`, details: `Bulk ${favorite ? 'favorited' : 'unfavorited'}`, userId: 'contrib-1' });
  },

  toggleFavorite: (id) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    const next = !item.isFavorite;
    set((s) => ({ items: s.items.map((i) => i.id === id ? { ...i, isFavorite: next, updatedAt: new Date().toISOString() } : i) }));
    const updated = get().items.find((i) => i.id === id);
    if (updated) syncItem(updated);
    get().logActivity({ action: next ? 'item_favorited' : 'item_unfavorited', entityType: 'item', entityId: id, entityTitle: item.title, userId: 'contrib-1' });
  },

  // ── Maintenance ──
  addMaintenanceEntry: (itemId, entry) => {
    const full: MaintenanceEntry = { ...entry, id: generateId() };
    set((s) => ({
      items: s.items.map((i) => i.id === itemId ? { ...i, maintenanceLog: [...i.maintenanceLog, full], updatedAt: new Date().toISOString() } : i),
    }));
    const item = get().items.find((i) => i.id === itemId);
    if (item) { syncItem(item); get().logActivity({ action: 'maintenance_added', entityType: 'item', entityId: itemId, entityTitle: item.title, details: entry.description, userId: 'contrib-1' }); }
  },
  removeMaintenanceEntry: (itemId, entryId) => {
    set((s) => ({
      items: s.items.map((i) => i.id === itemId ? { ...i, maintenanceLog: i.maintenanceLog.filter((m) => m.id !== entryId), updatedAt: new Date().toISOString() } : i),
    }));
    const item = get().items.find((i) => i.id === itemId);
    if (item) syncItem(item);
  },

  // ── Lending ──
  addLendingRecord: (itemId, record) => {
    const full: LendingRecord = { ...record, id: generateId() };
    set((s) => ({
      items: s.items.map((i) => i.id === itemId ? { ...i, lendingHistory: [...i.lendingHistory, full], updatedAt: new Date().toISOString() } : i),
    }));
    const item = get().items.find((i) => i.id === itemId);
    if (item) { syncItem(item); get().logActivity({ action: 'item_lent', entityType: 'item', entityId: itemId, entityTitle: item.title, details: `Lent to ${record.borrowerName}`, userId: 'contrib-1' }); }
  },
  returnLendingRecord: (itemId, recordId, condition) => {
    set((s) => ({
      items: s.items.map((i) => i.id === itemId ? {
        ...i,
        lendingHistory: i.lendingHistory.map((l) => l.id === recordId ? { ...l, actualReturnDate: new Date().toISOString().slice(0, 10), condition } : l),
        updatedAt: new Date().toISOString(),
      } : i),
    }));
    const item = get().items.find((i) => i.id === itemId);
    if (item) { syncItem(item); get().logActivity({ action: 'item_returned', entityType: 'item', entityId: itemId, entityTitle: item.title, userId: 'contrib-1' }); }
  },

  // ── Wishlist ──
  addWishlistItem: (data) => {
    const now = new Date().toISOString();
    const item: WishlistItem = { ...data, id: generateId(), isAcquired: false, createdAt: now, updatedAt: now };
    set((s) => ({ wishlist: [...s.wishlist, item] }));
    syncWishlist(item);
    get().logActivity({ action: 'wishlist_added', entityType: 'wishlist', entityId: item.id, entityTitle: item.title, userId: 'contrib-1' });
    return item;
  },
  updateWishlistItem: (id, updates) => {
    set((s) => ({ wishlist: s.wishlist.map((w) => w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w) }));
    const updated = get().wishlist.find((w) => w.id === id);
    if (updated) syncWishlist(updated);
  },
  deleteWishlistItem: (id) => {
    set((s) => ({ wishlist: s.wishlist.filter((w) => w.id !== id) }));
    if (_currentUserId && firestoreService.isAvailable()) firestoreService.deleteWishlistItem(_currentUserId, id).catch(console.error);
  },
  acquireWishlistItem: (wishlistId, itemId) => {
    set((s) => ({ wishlist: s.wishlist.map((w) => w.id === wishlistId ? { ...w, isAcquired: true, acquiredItemId: itemId, updatedAt: new Date().toISOString() } : w) }));
    const wish = get().wishlist.find((w) => w.id === wishlistId);
    if (wish) { syncWishlist(wish); get().logActivity({ action: 'wishlist_acquired', entityType: 'wishlist', entityId: wishlistId, entityTitle: wish.title, userId: 'contrib-1' }); }
  },

  // ── Archive ──
  archiveItem: (id) => {
    const item = get().items.find((i) => i.id === id);
    const now = new Date().toISOString();
    set((s) => ({ items: s.items.map((i) => i.id === id ? { ...i, isArchived: true, archivedAt: now, updatedAt: now } : i) }));
    const updated = get().items.find((i) => i.id === id);
    if (updated) syncItem(updated);
    if (item) get().logActivity({ action: 'item_deleted', entityType: 'item', entityId: id, entityTitle: item.title, userId: 'contrib-1', details: 'Archived' });
  },
  archiveItems: (ids) => {
    const now = new Date().toISOString();
    set((s) => ({ items: s.items.map((i) => ids.includes(i.id) ? { ...i, isArchived: true, archivedAt: now, updatedAt: now } : i) }));
    if (_currentUserId && firestoreService.isAvailable()) {
      const items = get().items.filter((i) => ids.includes(i.id));
      firestoreService.saveItems(_currentUserId, items).catch(console.error);
    }
  },
  recoverItem: (id) => {
    const item = get().items.find((i) => i.id === id);
    const now = new Date().toISOString();
    set((s) => ({ items: s.items.map((i) => i.id === id ? { ...i, isArchived: false, archivedAt: undefined, updatedAt: now } : i) }));
    const updated = get().items.find((i) => i.id === id);
    if (updated) syncItem(updated);
    if (item) get().logActivity({ action: 'item_created', entityType: 'item', entityId: id, entityTitle: item.title, userId: 'contrib-1', details: 'Recovered from archive' });
  },
  recoverItems: (ids) => {
    const now = new Date().toISOString();
    set((s) => ({ items: s.items.map((i) => ids.includes(i.id) ? { ...i, isArchived: false, archivedAt: undefined, updatedAt: now } : i) }));
    if (_currentUserId && firestoreService.isAvailable()) {
      const items = get().items.filter((i) => ids.includes(i.id));
      firestoreService.saveItems(_currentUserId, items).catch(console.error);
    }
  },
  permanentDeleteItem: (id) => {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    if (_currentUserId && firestoreService.isAvailable()) firestoreService.deleteItem(_currentUserId, id).catch(console.error);
  },
  permanentDeleteItems: (ids) => {
    set((s) => ({ items: s.items.filter((i) => !ids.includes(i.id)) }));
    if (_currentUserId && firestoreService.isAvailable()) firestoreService.deleteItems(_currentUserId, ids).catch(console.error);
  },
  getArchivedItems: () => get().items.filter((i) => i.isArchived),

  // ── Activity Log ──
  logActivity: (entry) => {
    const full: ActivityLogEntry = { ...entry, id: generateId(), timestamp: new Date().toISOString() };
    set((s) => ({ activityLog: [full, ...s.activityLog] }));
    syncActivity(full);
  },
  clearActivityLog: () => {
    set({ activityLog: [] });
    if (_currentUserId && firestoreService.isAvailable()) firestoreService.clearActivityLog(_currentUserId).catch(console.error);
  },

  // ── Getters ──
  getCategoryById: (id) => get().categories.find((c) => c.id === id),
  getCategoryBySlug: (slug) => get().categories.find((c) => c.slug === slug),
  getItemsByCategory: (categoryId) => get().items.filter((i) => i.categoryId === categoryId && !i.isArchived),
  getItemById: (id) => get().items.find((i) => i.id === id),
  getContributorById: (id) => get().contributors.find((c) => c.id === id),
  getFavoriteItems: () => get().items.filter((i) => i.isFavorite && !i.isArchived),
  getLentItems: () => get().items.filter((i) => !i.isArchived && i.lendingHistory.some((l) => !l.actualReturnDate)),

  getTotalValue: () => get().items.filter((i) => !i.isArchived).reduce((sum, item) => sum + currencyService.convertToUSD(item.valuationInfo.currentEstimatedValue, item.valuationInfo.currentValueCurrency), 0),

  getCategoryStats: () => {
    const { categories, items } = get();
    const active = items.filter((i) => !i.isArchived);
    return categories.map((cat) => {
      const catItems = active.filter((i) => i.categoryId === cat.id);
      const totalValue = catItems.reduce((sum, item) => sum + currencyService.convertToUSD(item.valuationInfo.currentEstimatedValue, item.valuationInfo.currentValueCurrency), 0);
      return { categoryId: cat.id, name: cat.name, count: catItems.length, totalValue };
    }).filter((s) => s.count > 0);
  },

  getRecentItems: (limit = 5) => [...get().items].filter((i) => !i.isArchived).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit),

  getMostValuableItems: (limit = 5) => [...get().items].filter((i) => !i.isArchived).sort((a, b) =>
    currencyService.convertToUSD(b.valuationInfo.currentEstimatedValue, b.valuationInfo.currentValueCurrency) -
    currencyService.convertToUSD(a.valuationInfo.currentEstimatedValue, a.valuationInfo.currentValueCurrency)
  ).slice(0, limit),

  getMonthlyAcquisitions: () => {
    const monthMap = new Map<string, { count: number; value: number }>();
    get().items.filter((i) => !i.isArchived).forEach((item) => {
      const date = new Date(item.purchaseInfo.purchasedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap.get(key) || { count: 0, value: 0 };
      existing.count += 1;
      existing.value += currencyService.convertToUSD(item.purchaseInfo.purchasePrice, item.purchaseInfo.purchaseCurrency);
      monthMap.set(key, existing);
    });
    return Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, data]) => ({ month, ...data }));
  },

  getValueOverTime: () => {
    const dateMap = new Map<string, number>();
    get().items.filter((i) => !i.isArchived).forEach((item) => {
      item.valuationInfo.valueHistory.forEach((vh) => {
        const key = vh.date.slice(0, 7);
        dateMap.set(key, (dateMap.get(key) || 0) + currencyService.convertToUSD(vh.value, vh.currency));
      });
    });
    return Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value: Math.round(value) }));
  },

  // ── Firebase Sync ──
  loadFromFirestore: async (userId) => {
    if (!firestoreService.isAvailable()) return;
    try {
      const data = await firestoreService.loadAll(userId);
      const hasRemoteData = data.categories.length > 0 || data.items.length > 0;

      if (hasRemoteData) {
        const local = get();
        const mergeById = <T extends { id: string }>(remote: T[], localArr: T[]): T[] => {
          const map = new Map(remote.map((r) => [r.id, r]));
          localArr.forEach((l) => { if (!map.has(l.id)) map.set(l.id, l); });
          return Array.from(map.values());
        };

        set({
          categories: data.categories.length > 0 ? mergeById(data.categories, local.categories) : local.categories,
          items: data.items.length > 0 ? mergeById(data.items, local.items) : local.items,
          libraries: data.libraries.length > 0 ? mergeById(data.libraries, local.libraries) : local.libraries,
          wishlist: data.wishlist.length > 0 ? mergeById(data.wishlist, local.wishlist) : local.wishlist,
          activityLog: data.activityLog.length > 0 ? mergeById(data.activityLog, local.activityLog) : local.activityLog,
          contributors: data.contributors.length > 0 ? mergeById(data.contributors, local.contributors) : local.contributors,
          ...(data.settings ? {
            displayCurrency: data.settings.displayCurrency ?? local.displayCurrency,
            theme: data.settings.theme ?? local.theme,
            sidebarOpen: data.settings.sidebarOpen ?? local.sidebarOpen,
            menuCollectionStyle: (data.settings as any)?.menuCollectionStyle ?? local.menuCollectionStyle,
            dashboardWidgets: data.settings.dashboardWidgets?.length ? data.settings.dashboardWidgets : local.dashboardWidgets,
            readNotificationIds: (data.settings as any)?.readNotificationIds ?? local.readNotificationIds,
          } : {}),
        });
        const theme = data.settings?.theme ?? local.theme;
        document.documentElement.classList.toggle('dark', theme === 'dark');
        document.documentElement.classList.toggle('light', theme === 'light');
      } else {
        await get().syncAllToFirestore(userId);
      }
    } catch (err) {
      console.error('Failed to load from Firestore:', err);
    }
  },

  syncAllToFirestore: async (userId) => {
    if (!firestoreService.isAvailable()) return;
    const s = get();
    try {
      await firestoreService.syncAll(userId, {
        categories: s.categories,
        items: s.items,
        libraries: s.libraries,
        wishlist: s.wishlist,
        activityLog: s.activityLog,
        contributors: s.contributors,
        settings: {
          displayCurrency: s.displayCurrency,
          theme: s.theme,
          sidebarOpen: s.sidebarOpen,
          menuCollectionStyle: s.menuCollectionStyle,
          dashboardWidgets: s.dashboardWidgets,
          readNotificationIds: s.readNotificationIds,
        },
      });
    } catch (err) {
      console.error('Failed to sync to Firestore:', err);
    }
  },
}),
    {
      name: 'collectvault-store',
      partialize: (state) => ({
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
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          document.documentElement.classList.toggle('dark', state.theme === 'dark');
          document.documentElement.classList.toggle('light', state.theme === 'light');
        }
        if (state) {
          const mockFieldsById = new Map(mockCategories.map((mc) => [mc.id, mc.fields]));
          state.categories = state.categories.map((cat) => {
            if (cat.fields && cat.fields.length > 0) return cat;
            const fields = mockFieldsById.get(cat.id);
            return fields ? { ...cat, fields } : cat;
          });

          if (!state.notifications) {
            state.notifications = { valueChangeAlerts: true, newItemReminders: true, collectionMilestones: true };
          }

          const deprecatedKeys = new Set(['firstEdition', 'purchaseDate', 'purchasePrice', 'purchaseCurrency', 'currentValue']);
          state.items = state.items.map((item) => {
            if (!item.customFields) return item;
            const hasDeprecated = Object.keys(item.customFields).some((k) => deprecatedKeys.has(k));
            if (!hasDeprecated) return item;
            const cleaned = { ...item.customFields };
            for (const k of deprecatedKeys) delete cleaned[k];
            return { ...item, customFields: cleaned };
          });
        }
      },
    },
  ),
);
