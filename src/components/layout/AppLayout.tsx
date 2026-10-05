import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ShellLoading } from '@/components/shared/ShellLoading';
import { t } from '@/i18n';
import type { AuthUser } from '@/services/authService';
import { OFFLINE_USER_ID, useAuthStore } from '@/store/useAuthStore';
import {
  useCollectionStore,
  setFirebaseUserId,
  setCurrentCollectionActor,
} from '@/store/useCollectionStore';
import { useSyncStore } from '@/store/useSyncStore';
import { collectionSyncService } from '@/services/collectionSyncService';
import { isBackupBundle, type BackupBundle } from '@/services/backupRestoreService';
import { getDesktopLocalSyncApi } from '@/lib/runtime';
import { BRAND_NAME } from '@/lib/brand';
import { todayISO } from '@/lib/utils';

// The item editor is heavy (photos, lookups, AI review); load it on first use.
const AddEditItemDialog = lazy(() => import('@/components/shared/AddEditItemDialog')
  .then((module) => ({ default: module.AddEditItemDialog })));

/** Mounts the lazily-loaded item dialog the first time it opens, then keeps it for exit animations. */
function LazyItemDialog() {
  const itemDialogOpen = useCollectionStore((s) => s.itemDialogOpen);
  const [mounted, setMounted] = useState(itemDialogOpen);
  if (itemDialogOpen && !mounted) setMounted(true);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <AddEditItemDialog />
    </Suspense>
  );
}

const LOCAL_AUTO_SYNC_DELAY_MS = 10_000;

/**
 * Auth guard for every signed-in route. `init()` runs once at the app root (App.tsx);
 * this component only reads the result. `user` is the single source of truth.
 */
const AppLayout = () => {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const location = useLocation();

  useEffect(() => {
    if (isLoading || user) return;
    // A cloud session ended (e.g. signed out elsewhere): drop that user's cached data.
    // Offline (device-local) data is never wiped implicitly.
    const { ownerUserId, resetForUser } = useCollectionStore.getState();
    if (ownerUserId && ownerUserId !== OFFLINE_USER_ID) {
      setFirebaseUserId(null);
      setCurrentCollectionActor(null);
      resetForUser(null, 'empty');
    }
  }, [isLoading, user]);

  if (!user) {
    if (isLoading) return <ShellLoading className="desktop-content-shell h-screen" />;
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <AuthenticatedShell user={user} />;
};

function AuthenticatedShell({ user }: { user: AuthUser }) {
  const location = useLocation();
  const navigate = useNavigate();
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

    const attemptKey = `${user.uid}:${reason}`;
    if (localFallbackAttemptRef.current === attemptKey) return false;
    localFallbackAttemptRef.current = attemptKey;

    try {
      const snapshot = await api.restoreSnapshot();
      if (!isBackupBundle(snapshot)) return false;

      await restoreBackupBundle(snapshot, 'replace', { skipRemoteSync: true });
      pushSyncEvent({
        level: 'warn',
        message: reason === 'offline'
          ? t('shell.sync.localCopyOffline')
          : t('shell.sync.localCopyCloudFailed'),
      });
      toast.success(t('shell.sync.localCopyLoaded'), {
        description: t('shell.sync.localCopyDescription', { brand: BRAND_NAME }),
      });
      return true;
    } catch {
      pushSyncEvent({
        level: 'warn',
        message: t('shell.sync.localCopyUnavailable'),
      });
      return false;
    }
  }, [user.uid, restoreBackupBundle, pushSyncEvent]);

  useEffect(() => {
    remoteUnsubRef.current?.();

    if (user.uid !== OFFLINE_USER_ID) {
      setFirebaseUserId(user.uid);
      setCurrentCollectionActor({
        id: user.uid,
        name: user.displayName ?? user.email ?? t('shell.defaultUserName'),
        avatar: user.photoURL ?? '',
        role: user.role,
      });
      upsertContributorProfile({
        id: user.uid,
        name: user.displayName ?? user.email ?? t('shell.defaultUserName'),
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
    } else {
      const localName = user.displayName ?? t('auth.localUser');
      setFirebaseUserId(null);
      setCurrentCollectionActor({
        id: OFFLINE_USER_ID,
        name: localName,
        avatar: '',
        role: 'admin',
      });
      const collection = useCollectionStore.getState();
      if (collection.ownerUserId !== OFFLINE_USER_ID) {
        // Keep whatever is already on this device; demo data only for a brand-new, empty profile.
        const hasLocalData = collection.ownerUserId === null && (
          collection.items.length > 0
          || collection.categories.length > 0
          || collection.wishlist.length > 0
        );
        if (hasLocalData) {
          useCollectionStore.setState({ ownerUserId: OFFLINE_USER_ID, isRemoteDataLoading: false });
        } else {
          resetForUser(OFFLINE_USER_ID, 'starter');
        }
      }
      upsertContributorProfile({
        id: OFFLINE_USER_ID,
        name: localName,
        avatar: '',
        role: 'admin',
        joinedAt: new Date().toISOString(),
        itemCount: 0,
        totalContributionValue: 0,
        lastContributionAt: new Date().toISOString(),
      });
      void loadDesktopLocalFallback('offline');
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
    if (!api || isRemoteDataLoading) return;

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
          message: t('shell.sync.autoSynced'),
        });
      }).catch((error) => {
        pushSyncEvent({
          level: 'error',
          message: error instanceof Error
            ? t('shell.sync.autoSyncFailedWithReason', { reason: error.message })
            : t('shell.sync.autoSyncFailed'),
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
    if (overdueNotifiedRef.current) return;
    const today = todayISO();
    const lentItems = getLentItems();
    const overdueCount = lentItems.reduce((count, item) => {
      return count + item.lendingHistory.filter(
        (r) => !r.actualReturnDate && r.expectedReturnDate < today,
      ).length;
    }, 0);
    if (overdueCount > 0) {
      overdueNotifiedRef.current = true;
      toast.warning(
        t('shell.overdue.title', { count: overdueCount }),
        { description: t('shell.overdue.description'), duration: 6000 },
      );
    }
  }, [getLentItems]);

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
            <ErrorBoundary resetKey={location.pathname} onNavigateHome={() => navigate('/collections')}>
              <Suspense fallback={<ShellLoading fullScreen={false} className="py-24" />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <LazyItemDialog />
    </TooltipProvider>
  );
}

export default AppLayout;
