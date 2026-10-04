import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import AppLayout from '@/components/layout/AppLayout';
import { seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useAuthStore } from '@/store/useAuthStore';
import { useCollectionStore } from '@/store/useCollectionStore';

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return { ...actual, toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() } };
});

vi.mock('@/components/layout/Sidebar', () => ({ default: () => null }));
vi.mock('@/components/layout/Topbar', () => ({ default: () => null }));
vi.mock('@/components/shared/AddEditItemDialog', () => ({ AddEditItemDialog: () => null }));

const offlineUser = {
  uid: 'offline',
  email: 'offline@local',
  displayName: 'Local User',
  photoURL: null,
  role: 'admin' as const,
};

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<div>Private Child</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppLayout offline data handling', () => {
  const resetForUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    seedCollectionStore(buildSeedData());
    useCollectionStore.setState({
      resetForUser,
      upsertContributorProfile: vi.fn(),
      getLentItems: vi.fn(() => []),
    });
    useAuthStore.setState({ user: offlineUser, isAuthenticated: true, isLoading: false, firebaseReady: false });
  });

  it('keeps the existing offline collection', async () => {
    useCollectionStore.setState({ ownerUserId: 'offline' });
    renderLayout();

    expect(screen.getByText('Private Child')).toBeInTheDocument();
    await waitFor(() => expect(useCollectionStore.getState().ownerUserId).toBe('offline'));
    expect(resetForUser).not.toHaveBeenCalled();
  });

  it('adopts unowned local data instead of replacing it with demo data', async () => {
    useCollectionStore.setState({ ownerUserId: null });
    const itemCount = useCollectionStore.getState().items.length;
    renderLayout();

    await waitFor(() => expect(useCollectionStore.getState().ownerUserId).toBe('offline'));
    expect(resetForUser).not.toHaveBeenCalled();
    expect(useCollectionStore.getState().items).toHaveLength(itemCount);
  });

  it('seeds starter data only for a brand-new, empty offline profile', async () => {
    seedCollectionStore({});
    useCollectionStore.setState({
      ownerUserId: null,
      resetForUser,
      upsertContributorProfile: vi.fn(),
      getLentItems: vi.fn(() => []),
    });
    renderLayout();

    await waitFor(() => expect(resetForUser).toHaveBeenCalledWith('offline', 'starter'));
  });

  it('never wipes offline data when the session ends', async () => {
    useCollectionStore.setState({ ownerUserId: 'offline' });
    useAuthStore.setState({ user: null, isAuthenticated: false });
    renderLayout();

    expect(await screen.findByText('Login Page')).toBeInTheDocument();
    expect(resetForUser).not.toHaveBeenCalled();
  });

  it("drops a cloud user's cached data when their session ends", async () => {
    useCollectionStore.setState({ ownerUserId: 'cloud-user-1' });
    useAuthStore.setState({ user: null, isAuthenticated: false });
    renderLayout();

    expect(await screen.findByText('Login Page')).toBeInTheDocument();
    expect(resetForUser).toHaveBeenCalledWith(null, 'empty');
  });
});
