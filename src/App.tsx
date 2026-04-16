import { Suspense, lazy, type ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { PWAUpdatePrompt } from '@/components/shared/PWAUpdatePrompt';
import { DesktopUpdatePrompt } from '@/components/shared/DesktopUpdatePrompt';
import AppLayout from '@/components/layout/AppLayout';
import { useAuthStore } from '@/store/useAuthStore';

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
const LendingTracker = lazy(() => import('@/pages/LendingTracker'));
const ExportPage = lazy(() => import('@/pages/ExportPage'));
const AdminBulkActions = lazy(() => import('@/pages/AdminBulkActions'));
const AdminStorage = lazy(() => import('@/pages/AdminStorage'));
const AdminArchive = lazy(() => import('@/pages/AdminArchive'));
const AdminDuplicates = lazy(() => import('@/pages/AdminDuplicates'));
const AdminPrintLabels = lazy(() => import('@/pages/AdminPrintLabels'));
const Favorites = lazy(() => import('@/pages/Favorites'));
const Profile = lazy(() => import('@/pages/Profile'));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
          <Layers className="size-7 animate-pulse text-primary" />
        </div>
        <div className="size-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    </div>
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
  return (
    <BrowserRouter>
      <PWAUpdatePrompt />
      <DesktopUpdatePrompt />
      <Suspense fallback={<RouteFallback />}>
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
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
