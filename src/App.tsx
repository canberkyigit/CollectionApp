import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PWAUpdatePrompt } from '@/components/shared/PWAUpdatePrompt';
import AppLayout from '@/components/layout/AppLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Collections from '@/pages/Collections';
import CollectionDetail from '@/pages/CollectionDetail';
import ItemDetail from '@/pages/ItemDetail';
import ItemForm from '@/pages/ItemForm';
import Contributors from '@/pages/Contributors';
import Admin from '@/pages/Admin';
import AdminCategories from '@/pages/AdminCategories';
import AdminCategoryForm from '@/pages/AdminCategoryForm';
import Settings from '@/pages/Settings';
import Wishlist from '@/pages/Wishlist';
import ActivityLog from '@/pages/ActivityLog';
import LendingTracker from '@/pages/LendingTracker';
import ExportPage from '@/pages/ExportPage';
import AdminBulkActions from '@/pages/AdminBulkActions';
import AdminStorage from '@/pages/AdminStorage';
import AdminArchive from '@/pages/AdminArchive';
import AdminDuplicates from '@/pages/AdminDuplicates';
import AdminPrintLabels from '@/pages/AdminPrintLabels';
import Favorites from '@/pages/Favorites';
import Profile from '@/pages/Profile';

export default function App() {
  return (
    <BrowserRouter>
      <PWAUpdatePrompt />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/collections" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="collections" element={<Collections />} />
          <Route path="collections/:categorySlug" element={<CollectionDetail />} />
          <Route path="items/new" element={<ItemForm />} />
          <Route path="items/:itemId" element={<ItemDetail />} />
          <Route path="items/:itemId/edit" element={<ItemForm />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="lending" element={<LendingTracker />} />
          <Route path="contributors" element={<Contributors />} />
          <Route path="activity" element={<ActivityLog />} />
          <Route path="export" element={<ExportPage />} />
          <Route path="admin" element={<Admin />} />
          <Route path="admin/categories" element={<AdminCategories />} />
          <Route path="admin/categories/new" element={<AdminCategoryForm />} />
          <Route path="admin/categories/:categoryId/edit" element={<AdminCategoryForm />} />
          <Route path="admin/bulk" element={<AdminBulkActions />} />
          <Route path="admin/storage" element={<AdminStorage />} />
          <Route path="admin/archive" element={<AdminArchive />} />
          <Route path="admin/duplicates" element={<AdminDuplicates />} />
          <Route path="admin/print-labels" element={<AdminPrintLabels />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
