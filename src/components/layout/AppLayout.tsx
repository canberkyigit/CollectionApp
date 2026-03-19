import { useEffect, useRef } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { AddEditItemDialog } from '@/components/shared/AddEditItemDialog';
import { useAuthStore } from '@/store/useAuthStore';
import { useCollectionStore, setFirebaseUserId } from '@/store/useCollectionStore';
import { Layers } from 'lucide-react';

const AppLayout = () => {
  const { user, isAuthenticated, isLoading, init } = useAuthStore();
  const loadFromFirestore = useCollectionStore((s) => s.loadFromFirestore);
  const getLentItems = useCollectionStore((s) => s.getLentItems);
  const loadedUidRef = useRef<string | null>(null);
  const overdueNotifiedRef = useRef(false);

  useEffect(() => {
    const unsub = init();
    return unsub;
  }, [init]);

  useEffect(() => {
    if (user && user.uid !== 'offline') {
      setFirebaseUserId(user.uid);
      if (loadedUidRef.current !== user.uid) {
        loadedUidRef.current = user.uid;
        loadFromFirestore(user.uid);
      }
    } else {
      setFirebaseUserId(null);
      loadedUidRef.current = null;
    }
  }, [user, loadFromFirestore]);

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
      <div className="flex h-screen items-center justify-center bg-background">
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
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
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
