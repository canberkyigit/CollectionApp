import { useEffect, useRef } from 'react';
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
import { Layers } from 'lucide-react';

const AppLayout = () => {
  const { user, isAuthenticated, isLoading, init } = useAuthStore();
  const loadFromFirestore = useCollectionStore((s) => s.loadFromFirestore);
  const subscribeToFirestore = useCollectionStore((s) => s.subscribeToFirestore);
  const resetForUser = useCollectionStore((s) => s.resetForUser);
  const upsertContributorProfile = useCollectionStore((s) => s.upsertContributorProfile);
  const getLentItems = useCollectionStore((s) => s.getLentItems);
  const setOnlineState = useSyncStore((s) => s.setOnlineState);
  const loadedUidRef = useRef<string | null>(null);
  const overdueNotifiedRef = useRef(false);
  const remoteUnsubRef = useRef<(() => void) | null>(null);

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
        loadedUidRef.current = user.uid;
        resetForUser(user.uid, 'empty');
        void loadFromFirestore(user.uid).finally(() => {
          remoteUnsubRef.current = subscribeToFirestore(user.uid);
        });
      } else {
        remoteUnsubRef.current = subscribeToFirestore(user.uid);
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
  }, [user, loadFromFirestore, subscribeToFirestore, resetForUser, upsertContributorProfile]);

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
      <div className="desktop-content-shell surface-page flex h-screen overflow-hidden text-foreground">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-3 sm:p-4 md:p-6">
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
