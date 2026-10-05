import { Suspense, lazy, useEffect, type ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { PWAUpdatePrompt } from '@/components/shared/PWAUpdatePrompt';
import { DesktopUpdatePrompt } from '@/components/shared/DesktopUpdatePrompt';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { MotionProvider } from '@/components/shared/motion';
import { ShellLoading } from '@/components/shared/ShellLoading';
import AppLayout from '@/components/layout/AppLayout';
import { useT } from '@/i18n';
import { useAuthStore } from '@/store/useAuthStore';
import { useCollectionStore } from '@/store/useCollectionStore';

const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Collections = lazy(() => import('@/pages/Collections'));
const CollectionDetail = lazy(() => import('@/pages/CollectionDetail'));
const ItemDetail = lazy(() => import('@/pages/ItemDetail'));
const ItemForm = lazy(() => import('@/pages/ItemForm'));
const Contributors = lazy(() => import('@/pages/Contributors'));
const Admin = lazy(() => import('@/pages/Admin'));
const AdminCategories = lazy(() => import('@/pages/AdminCategories'));
const AdminCategoryForm = lazy(() => import('@/pages/AdminCategoryForm'));
const Settings = lazy(() => import('@/pages/Settings'));
const Wishlist = lazy(() => import('@/pages/Wishlist'));
const ActivityLog = lazy(() => import('@/pages/ActivityLog'));
const Exhibition = lazy(() => import('@/pages/Exhibition'));
const LendingTracker = lazy(() => import('@/pages/LendingTracker'));
const ExportPage = lazy(() => import('@/pages/ExportPage'));
const AdminBulkActions = lazy(() => import('@/pages/AdminBulkActions'));
const AdminStorage = lazy(() => import('@/pages/AdminStorage'));
const AdminArchive = lazy(() => import('@/pages/AdminArchive'));
const AdminDuplicates = lazy(() => import('@/pages/AdminDuplicates'));
const AdminPrintLabels = lazy(() => import('@/pages/AdminPrintLabels'));
const Favorites = lazy(() => import('@/pages/Favorites'));
const Profile = lazy(() => import('@/pages/Profile'));
const NotFound = lazy(() => import('@/pages/NotFound'));

/** App-wide toaster: original rich-colour card toasts, mounted once at the root. */
function AppToaster() {
  const theme = useCollectionStore((state) => state.theme);
  const t = useT();

  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      richColors
      closeButton
      containerAriaLabel={t('shell.notifications')}
      toastOptions={{
        className: 'border border-border bg-card text-foreground',
      }}
    />
  );
}

function RequireRole({
  roles,
  children,
}: {
  roles: Array<'admin' | 'editor' | 'viewer'>;
  children: ReactElement;
}) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/collections" replace />;
  }

  return children;
}

export default function App() {
  // Auth is initialised exactly once, at the root, so every route (including /login) sees the same session.
  useEffect(() => useAuthStore.getState().init(), []);

  return (
    <MotionProvider>
      <ErrorBoundary fullScreen>
        <BrowserRouter>
          <PWAUpdatePrompt />
          <DesktopUpdatePrompt />
          <Suspense fallback={<ShellLoading />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<AppLayout />}>
                <Route index element={<Navigate to="/collections" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="collections" element={<Collections />} />
                <Route path="collections/:categorySlug" element={<CollectionDetail />} />
                <Route path="items/new" element={<RequireRole roles={['admin', 'editor']}><ItemForm /></RequireRole>} />
                <Route path="items/:itemId" element={<ItemDetail />} />
                <Route path="items/:itemId/edit" element={<RequireRole roles={['admin', 'editor']}><ItemForm /></RequireRole>} />
                <Route path="favorites" element={<Favorites />} />
                <Route path="wishlist" element={<Wishlist />} />
                <Route path="lending" element={<LendingTracker />} />
                <Route path="contributors" element={<Contributors />} />
                <Route path="activity" element={<ActivityLog />} />
                <Route path="exhibition" element={<Exhibition />} />
                <Route path="export" element={<ExportPage />} />
                <Route path="admin" element={<RequireRole roles={['admin']}><Admin /></RequireRole>} />
                <Route path="admin/categories" element={<RequireRole roles={['admin']}><AdminCategories /></RequireRole>} />
                <Route path="admin/categories/new" element={<RequireRole roles={['admin']}><AdminCategoryForm /></RequireRole>} />
                <Route path="admin/categories/:categoryId/edit" element={<RequireRole roles={['admin']}><AdminCategoryForm /></RequireRole>} />
                <Route path="admin/bulk" element={<RequireRole roles={['admin']}><AdminBulkActions /></RequireRole>} />
                <Route path="admin/storage" element={<RequireRole roles={['admin']}><AdminStorage /></RequireRole>} />
                <Route path="admin/archive" element={<RequireRole roles={['admin']}><AdminArchive /></RequireRole>} />
                <Route path="admin/duplicates" element={<RequireRole roles={['admin']}><AdminDuplicates /></RequireRole>} />
                <Route path="admin/print-labels" element={<RequireRole roles={['admin']}><AdminPrintLabels /></RequireRole>} />
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Settings />} />
                {/* Unknown URLs: signed-in users get a 404 inside the shell; AppLayout sends everyone else to /login. */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
        <AppToaster />
      </ErrorBoundary>
    </MotionProvider>
  );
}
