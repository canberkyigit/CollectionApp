import { createDefaultNotificationState } from '@/store/collectionStore.defaults';
import type {
  CollectionStoreCreator,
  CollectionStoreDependencies,
  NotificationPreferencesSlice,
} from '@/store/collectionStore.types';

export function createNotificationSlice(
  dependencies: CollectionStoreDependencies,
): CollectionStoreCreator<NotificationPreferencesSlice> {
  const defaults = createDefaultNotificationState();

  return (set, get) => ({
    readNotificationIds: defaults.readNotificationIds,
    notifications: defaults.notifications,

    markNotificationRead: (id) => {
      const currentIds = get().readNotificationIds;
      if (currentIds.includes(id)) return;

      const nextIds = [...currentIds, id];
      set({ readNotificationIds: nextIds });
      dependencies.syncSettings({ readNotificationIds: nextIds });
    },

    markAllNotificationsRead: () => {
      const notificationIds = get().activityLog.slice(0, 20).map((entry) => entry.id);
      const mergedIds = [...new Set([...get().readNotificationIds, ...notificationIds])];
      set({ readNotificationIds: mergedIds });
      dependencies.syncSettings({ readNotificationIds: mergedIds });
    },

    setNotifications: (updates) => {
      const nextNotifications = { ...get().notifications, ...updates };
      set({ notifications: nextNotifications });
      dependencies.syncSettings({ notifications: nextNotifications });
    },
  });
}
