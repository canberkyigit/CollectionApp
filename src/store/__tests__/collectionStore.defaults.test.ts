import { describe, expect, it } from 'vitest';

import {
  DEFAULT_NOTIFICATIONS,
  DEFAULT_WIDGETS,
  buildResetState,
  cloneDefaultNotifications,
  cloneDefaultWidgets,
  createDefaultDashboardLayoutState,
  createDefaultNotificationState,
  createDefaultUiPreferencesState,
  createEmptyCollectionData,
  createStarterCollectionData,
} from '@/store/collectionStore.defaults';

describe('collectionStore defaults', () => {
  it('creates starter and empty collection payloads', () => {
    const starter = createStarterCollectionData();
    const empty = createEmptyCollectionData();

    expect(starter.categories.length).toBeGreaterThan(0);
    expect(starter.items.length).toBeGreaterThan(0);
    expect(starter.contributors.length).toBeGreaterThan(0);

    expect(empty.categories).toEqual([]);
    expect(empty.items).toEqual([]);
    expect(empty.libraries).toEqual([]);
    expect(empty.contributors).toEqual([]);
    expect(empty.wishlist).toEqual([]);
    expect(empty.activityLog).toEqual([]);
  });

  it('builds default ui, dashboard, and notification slices', () => {
    expect(createDefaultUiPreferencesState()).toEqual({
      viewMode: 'grid',
      searchQuery: '',
      sortField: 'createdAt',
      sortOrder: 'desc',
      selectedTags: [],
      sidebarOpen: true,
      menuCollectionStyle: 'style1',
      theme: 'light',
      displayCurrency: 'USD',
      itemDialogOpen: false,
      itemDialogCategoryId: null,
      itemDialogItem: null,
    });

    expect(createDefaultDashboardLayoutState().dashboardWidgets).toEqual(DEFAULT_WIDGETS);
    expect(createDefaultNotificationState()).toEqual({
      readNotificationIds: [],
      notifications: DEFAULT_NOTIFICATIONS,
    });
  });

  it('clones notifications and widgets without reusing references', () => {
    const widgetClone = cloneDefaultWidgets();
    const notificationClone = cloneDefaultNotifications();

    widgetClone[0].visible = false;
    notificationClone.valueChangeAlerts = false;

    expect(DEFAULT_WIDGETS[0].visible).toBe(true);
    expect(DEFAULT_NOTIFICATIONS.valueChangeAlerts).toBe(true);
  });

  it('builds reset state for starter and empty modes', () => {
    const starterReset = buildResetState({ userId: 'user-1', mode: 'starter' });
    const emptyReset = buildResetState({ userId: 'user-1', mode: 'empty' });

    expect(starterReset.ownerUserId).toBe('user-1');
    expect(starterReset.isRemoteDataLoading).toBe(false);
    expect(starterReset.categories?.length).toBeGreaterThan(0);

    expect(emptyReset.ownerUserId).toBe('user-1');
    expect(emptyReset.isRemoteDataLoading).toBe(true);
    expect(emptyReset.categories).toEqual([]);
    expect(emptyReset.notifications).toEqual(DEFAULT_NOTIFICATIONS);
    expect(emptyReset.dashboardWidgets).toEqual(DEFAULT_WIDGETS);
  });
});
