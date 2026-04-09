import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { useAuthStore } from '@/store/useAuthStore';
import { useCollectionStore } from '@/store/useCollectionStore';
import type { Category, CollectionItem } from '@/types';
import type { AuthUser } from '@/services/authService';
import type { ActivityLogEntry, Contributor, Library, WishlistItem } from '@/types';

const defaultAuthUser = {
  uid: 'user-1',
  email: 'tester@example.com',
  displayName: 'Test User',
  photoURL: null,
  role: 'admin',
} satisfies AuthUser;

export function renderWithRouter(ui: ReactElement, initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {ui}
    </MemoryRouter>,
  );
}

export function renderRoute({
  path,
  initialEntry,
  ui,
}: {
  path: string;
  initialEntry: string;
  ui: ReactElement;
}) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path={path} element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}

export function resetCollectionStore() {
  useCollectionStore.setState({
    ownerUserId: null,
    isRemoteDataLoading: false,
    categories: [],
    items: [],
    libraries: [],
    contributors: [],
    wishlist: [],
    activityLog: [],
    searchQuery: '',
    sortField: 'createdAt',
    sortOrder: 'desc',
    viewMode: 'grid',
    displayCurrency: 'USD',
  });
}

export function seedCollectionStore({
  categories = [],
  items = [],
  libraries = [],
  contributors = [],
  wishlist = [],
  activityLog = [],
}: {
  categories?: Category[];
  items?: CollectionItem[];
  libraries?: Library[];
  contributors?: Contributor[];
  wishlist?: WishlistItem[];
  activityLog?: ActivityLogEntry[];
}) {
  resetCollectionStore();
  useCollectionStore.setState({
    categories,
    items,
    libraries,
    contributors,
    wishlist,
    activityLog,
  });
}

export function resetAuthStore() {
  useAuthStore.setState({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    firebaseReady: true,
    error: null,
  });
}

export function seedAuthStore(overrides: Partial<AuthUser> = {}) {
  resetAuthStore();
  useAuthStore.setState({
    user: { ...defaultAuthUser, ...overrides },
    isAuthenticated: true,
    firebaseReady: true,
  });
}
