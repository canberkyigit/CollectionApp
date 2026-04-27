import { useCallback, useEffect, useRef } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { AddEditItemDialog } from '@/components/shared/AddEditItemDialog';
import { useAuthStore } from '@/store/useAuthStore';
import {
  useCollectionStore,
  setFirebaseUserId,
  setCurrentCollectionActor,
} from '@/store/useCollectionStore';
import { useSyncStore } from '@/store/useSyncStore';
import { collectionSyncService } from '@/services/collectionSyncService';
import { isBackupBundle, type BackupBundle } from '@/services/backupRestoreService';
import { getDesktopLocalSyncApi } from '@/lib/runtime';
import { Layers } from 'lucide-react';

const LOCAL_AUTO_SYNC_DELAY_MS = 10_000;

const AppLayout = () => {
  const { user, isAuthenticated, isLoading, init } = useAuthStore();
  const loadFromFirestore = useCollectionStore((s) => s.loadFromFirestore);
  const subscribeToFirestore = useCollectionStore((s) => s.subscribeToFirestore);
  const resetForUser = useCollectionStore((s) => s.resetForUser);
  const upsertContributorProfile = useCollectionStore((s) => s.upsertContributorProfile);
  const getLentItems = useCollectionStore((s) => s.getLentItems);
  const restoreBackupBundle = useCollectionStore((s) => s.restoreBackupBundle);
  const isRemoteDataLoading = useCollectionStore((s) => s.isRemoteDataLoading);
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
  const setOnlineState = useSyncStore((s) => s.setOnlineState);
  const isOnline = useSyncStore((s) => s.isOnline);
  const pushSyncEvent = useSyncStore((s) => s.pushEvent);
  const loadedUidRef = useRef<string | null>(null);
  const overdueNotifiedRef = useRef(false);
  const remoteUnsubRef = useRef<(() => void) | null>(null);
  const localFallbackAttemptRef = useRef<string | null>(null);
  const localAutoSyncTimerRef = useRef<number | null>(null);
  const lastLocalAutoSyncFingerprintRef = useRef('');

  useEffect(() => {
    const unsub = init();
    return unsub;
  }, [init]);

  useEffect(() => {
    const handleOnline = () => {
      setOnlineState(true);
      void collectionSyncService.retryPending();
    };
    const handleOffline = () => setOnlineState(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnlineState]);

  const loadDesktopLocalFallback = useCallback(async (reason: string) => {
    const api = getDesktopLocalSyncApi();
    if (!api) return false;

    const attemptKey = `${user?.uid ?? 'anonymous'}:${reason}`;
    if (localFallbackAttemptRef.current === attemptKey) return false;
    localFallbackAttemptRef.current = attemptKey;

    try {
      const snapshot = await api.restoreSnapshot();
      if (!isBackupBundle(snapshot)) return false;

      await restoreBackupBundle(snapshot, 'replace', { skipRemoteSync: true });
      pushSyncEvent({
        level: 'warn',
        message: reason === 'offline'
          ? 'Loaded desktop local copy while offline'
          : 'Loaded desktop local copy after cloud load failed',
      });
      toast.success('Loaded desktop local copy', {
        description: 'ESÇ is using the saved local snapshot on this Mac.',
      });
      return true;
    } catch {
      pushSyncEvent({
        level: 'warn',
        message: 'Desktop local copy was not available',
      });
      return false;
    }
  }, [user?.uid, restoreBackupBundle, pushSyncEvent]);

  useEffect(() => {
    remoteUnsubRef.current?.();

    if (user && user.uid !== 'offline') {
      setFirebaseUserId(user.uid);
      setCurrentCollectionActor({
        id: user.uid,
        name: user.displayName ?? user.email ?? 'User',
        avatar: user.photoURL ?? '',
        role: user.role,
      });
      upsertContributorProfile({
        id: user.uid,
        name: user.displayName ?? user.email ?? 'User',
        avatar: user.photoURL ?? '',
        role: user.role,
        joinedAt: new Date().toISOString(),
        itemCount: 0,
        totalContributionValue: 0,
        lastContributionAt: new Date().toISOString(),
      });
      if (loadedUidRef.current !== user.uid) {
        resetForUser(user.uid, 'empty');
        if (!isOnline) {
          void loadDesktopLocalFallback('offline');
          return;
        }

        void loadFromFirestore(user.uid).then(async (loadedRemote) => {
          if (loadedRemote) {
            loadedUidRef.current = user.uid;
          } else {
            await loadDesktopLocalFallback('cloud-failed');
          }
        }).finally(() => {
          if (isOnline) {
            remoteUnsubRef.current = subscribeToFirestore(user.uid);
          }
        });
      } else {
        if (isOnline) {
          remoteUnsubRef.current = subscribeToFirestore(user.uid);
        } else {
          void loadDesktopLocalFallback('offline');
        }
      }
    } else if (user?.uid === 'offline') {
      setFirebaseUserId(null);
      setCurrentCollectionActor({
        id: 'offline',
        name: user.displayName ?? 'Local User',
        avatar: '',
        role: 'admin',
      });
      resetForUser('offline');
      upsertContributorProfile({
        id: 'offline',
        name: user.displayName ?? 'Local User',
        avatar: '',
        role: 'admin',
        joinedAt: new Date().toISOString(),
        itemCount: 0,
        totalContributionValue: 0,
        lastContributionAt: new Date().toISOString(),
      });
      void loadDesktopLocalFallback('offline');
    } else {
      setFirebaseUserId(null);
      setCurrentCollectionActor(null);
      resetForUser(null, 'empty');
      loadedUidRef.current = null;
    }
    overdueNotifiedRef.current = false;

    return () => {
      remoteUnsubRef.current?.();
      remoteUnsubRef.current = null;
    };
  }, [
    user,
    isOnline,
    loadFromFirestore,
    subscribeToFirestore,
    resetForUser,
    upsertContributorProfile,
    restoreBackupBundle,
    pushSyncEvent,
    loadDesktopLocalFallback,
  ]);

  useEffect(() => {
    const api = getDesktopLocalSyncApi();
    if (!api || !isAuthenticated || isRemoteDataLoading) return;

    const snapshot: BackupBundle = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
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
    };

    const fingerprint = JSON.stringify({
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
    });

    if (fingerprint === lastLocalAutoSyncFingerprintRef.current) return;

    if (localAutoSyncTimerRef.current) {
      window.clearTimeout(localAutoSyncTimerRef.current);
    }

    localAutoSyncTimerRef.current = window.setTimeout(() => {
      void api.syncSnapshot(snapshot).then(() => {
        lastLocalAutoSyncFingerprintRef.current = fingerprint;
        pushSyncEvent({
          level: 'info',
          message: 'Desktop local copy auto-synced',
        });
      }).catch((error) => {
        pushSyncEvent({
          level: 'error',
          message: error instanceof Error
            ? `Desktop local auto-sync failed: ${error.message}`
            : 'Desktop local auto-sync failed',
        });
      });
    }, LOCAL_AUTO_SYNC_DELAY_MS);

    return () => {
      if (localAutoSyncTimerRef.current) {
        window.clearTimeout(localAutoSyncTimerRef.current);
        localAutoSyncTimerRef.current = null;
      }
    };
  }, [
    isAuthenticated,
    isRemoteDataLoading,
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
    pushSyncEvent,
  ]);

  useEffect(() => {
    if (!isAuthenticated || overdueNotifiedRef.current) return;
    const today = new Date().toISOString().slice(0, 10);
    const lentItems = getLentItems();
    const overdueCount = lentItems.reduce((count, item) => {
      return count + item.lendingHistory.filter(
        (r) => !r.actualReturnDate && r.expectedReturnDate < today,
      ).length;
    }, 0);
    if (overdueCount > 0) {
      overdueNotifiedRef.current = true;
      toast.warning(
        `${overdueCount} lent item${overdueCount > 1 ? 's are' : ' is'} overdue`,
        { description: 'Check Lending Tracker for details', duration: 6000 },
      );
    }
  }, [isAuthenticated, getLentItems]);

  if (isLoading) {
    return (
      <div className="desktop-content-shell surface-page flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <Layers className="size-7 animate-pulse text-primary" />
          </div>
          <div className="size-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="desktop-content-shell surface-page flex h-screen overflow-hidden text-foreground print:block print:h-auto print:overflow-visible print:bg-white print:text-black">
        <div className="print:hidden">
          <Sidebar />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:block print:min-w-full print:overflow-visible">
          <div className="print:hidden">
            <Topbar />
          </div>
          <main className="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-3 sm:p-4 md:p-6 print:block print:h-auto print:overflow-visible print:p-0">
            <Outlet />
          </main>
        </div>
      </div>
      <AddEditItemDialog />
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          className: 'border border-border bg-card text-foreground',
        }}
      />
    </TooltipProvider>
  );
};

export default AppLayout;
