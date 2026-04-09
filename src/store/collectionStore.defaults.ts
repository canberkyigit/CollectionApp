import type {
  ActivityLogEntry,
  Category,
  CollectionItem,
  Contributor,
  DashboardWidgetConfig,
  Library,
  WishlistItem,
} from '@/types';

import { mockCategories } from '@/data/categories';
import { mockContributors } from '@/data/contributors';
import { mockActivityLog, mockItems, mockWishlistItems } from '@/data/items';
import type { CollectionStore, CollectionStoreResetOptions } from '@/store/collectionStore.types';

export const STORE_VERSION = 4;

export const DEFAULT_NOTIFICATIONS = {
  valueChangeAlerts: true,
  newItemReminders: true,
  collectionMilestones: true,
};

export const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
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

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createStarterCollectionData() {
  return {
    categories: cloneValue(mockCategories),
    items: cloneValue(mockItems),
    libraries: [] as Library[],
    contributors: cloneValue(mockContributors),
    wishlist: cloneValue(mockWishlistItems),
    activityLog: cloneValue(mockActivityLog),
  };
}

export function createEmptyCollectionData() {
  return {
    categories: [] as Category[],
    items: [] as CollectionItem[],
    libraries: [] as Library[],
    contributors: [] as Contributor[],
    wishlist: [] as WishlistItem[],
    activityLog: [] as ActivityLogEntry[],
  };
}

export function createDefaultUiPreferencesState() {
  return {
    viewMode: 'grid' as const,
    searchQuery: '',
    sortField: 'createdAt' as const,
    sortOrder: 'desc' as const,
    selectedTags: [] as string[],
    sidebarOpen: true,
    menuCollectionStyle: 'style1' as const,
    theme: 'light' as const,
    displayCurrency: 'USD',
    itemDialogOpen: false,
    itemDialogCategoryId: null,
    itemDialogItem: null,
  };
}

export function createDefaultDashboardLayoutState() {
  return {
    dashboardWidgets: cloneValue(DEFAULT_WIDGETS),
  };
}

export function createDefaultNotificationState() {
  return {
    readNotificationIds: [] as string[],
    notifications: DEFAULT_NOTIFICATIONS,
  };
}

export function buildResetState({
  userId,
  mode = 'starter',
}: CollectionStoreResetOptions): Partial<CollectionStore> {
  const collectionData = mode === 'empty'
    ? createEmptyCollectionData()
    : createStarterCollectionData();

  return {
    ownerUserId: userId,
    isRemoteDataLoading: userId !== null && mode === 'empty',
    ...collectionData,
    ...createDefaultUiPreferencesState(),
    ...createDefaultDashboardLayoutState(),
    ...createDefaultNotificationState(),
  };
}

export function cloneDefaultWidgets(): DashboardWidgetConfig[] {
  return cloneValue(DEFAULT_WIDGETS);
}

export function cloneDefaultNotifications() {
  return cloneValue(DEFAULT_NOTIFICATIONS);
}
