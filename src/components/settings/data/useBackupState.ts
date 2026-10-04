import { useCallback, useMemo } from 'react';

import type { RestorableBackupState } from '@/services/backupRestoreService';
import { exportService } from '@/services/exportService';
import { useCollectionStore } from '@/store/useCollectionStore';

/** Current collection as a restorable backup state, plus helpers to bundle / download it. */
export function useBackupState() {
  const categories = useCollectionStore((s) => s.categories);
  const items = useCollectionStore((s) => s.items);
  const libraries = useCollectionStore((s) => s.libraries);
  const wishlist = useCollectionStore((s) => s.wishlist);
  const activityLog = useCollectionStore((s) => s.activityLog);
  const contributors = useCollectionStore((s) => s.contributors);
  const displayCurrency = useCollectionStore((s) => s.displayCurrency);
  const theme = useCollectionStore((s) => s.theme);
  const sidebarOpen = useCollectionStore((s) => s.sidebarOpen);
  const menuCollectionStyle = useCollectionStore((s) => s.menuCollectionStyle);
  const dashboardWidgets = useCollectionStore((s) => s.dashboardWidgets);
  const readNotificationIds = useCollectionStore((s) => s.readNotificationIds);
  const notifications = useCollectionStore((s) => s.notifications);

  const currentBackupState = useMemo<RestorableBackupState>(() => ({
    categories,
    items,
    libraries,
    wishlist,
    activityLog,
    contributors,
    settings: {
      displayCurrency,
      theme,
      sidebarOpen,
      menuCollectionStyle,
      dashboardWidgets,
      readNotificationIds,
      notifications,
    },
  }), [
    categories,
    items,
    libraries,
    wishlist,
    activityLog,
    contributors,
    displayCurrency,
    theme,
    sidebarOpen,
    menuCollectionStyle,
    dashboardWidgets,
    readNotificationIds,
    notifications,
  ]);

  const buildFullBackupBundle = useCallback(() => ({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    ...currentBackupState,
  }), [currentBackupState]);

  const downloadFullBackup = useCallback((filename?: string) => {
    exportService.exportBackupBundle(currentBackupState, filename);
  }, [currentBackupState]);

  return { currentBackupState, buildFullBackupBundle, downloadFullBackup };
}
