import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import AppLayout from '@/components/layout/AppLayout';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithRouter, seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useAuthStore } from '@/store/useAuthStore';
import { useCollectionStore } from '@/store/useCollectionStore';
import { useSyncStore } from '@/store/useSyncStore';
import { collectionSyncService } from '@/services/collectionSyncService';

const mocks = vi.hoisted(() => ({
  toastWarning: vi.fn(),
}));

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return {
    ...actual,
    toast: {
      warning: mocks.toastWarning,
      success: vi.fn(),
      error: vi.fn(),
    },
    Toaster: () => null,
  };
});

describe('layout components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const seed = buildSeedData();
    seedCollectionStore(seed);
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
    useCollectionStore.setState({
      sidebarOpen: true,
      menuCollectionStyle: 'style1',
      readNotificationIds: [],
      notifications: {
        valueChangeAlerts: true,
        newItemReminders: true,
        collectionMilestones: true,
      },
    });
    useSyncStore.getState().reset();
  });

  it('renders topbar interactions for search, settings, notifications, and logout', async () => {
    const user = userEvent.setup();
    const logout = vi.fn(async () => undefined);
    useAuthStore.setState({ logout });
    vi.spyOn(collectionSyncService, 'retryPending').mockResolvedValue(undefined);
    useSyncStore.setState({ status: 'error', pendingCount: 2, lastError: 'sync failed' });

    renderWithRouter(
      <TooltipProvider>
        <Topbar />
      </TooltipProvider>,
    );
    await user.type(screen.getByPlaceholderText(/search items, categories/i), 'dune');
    expect(await screen.findByText('Items')).toBeInTheDocument();
    await user.click(screen.getAllByText('Dune')[0]);

    await user.click(screen.getByRole('button', { name: /open settings/i }));

    await user.click(screen.getByRole('button', { name: /open notifications/i }));
    expect(await screen.findByText('Notifications')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /mark all read/i }));
    expect(useCollectionStore.getState().readNotificationIds.length).toBeGreaterThan(0);

    await user.click(screen.getByText(/sync issue/i).closest('button') as HTMLButtonElement);
    expect(collectionSyncService.retryPending).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /open account menu/i }));
    await user.click(await screen.findByText(/log out/i));
    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });
  });

  it('renders sidebar tree and drill-in navigation states', async () => {
    const user = userEvent.setup();
    const seed = buildSeedData();
    seed.items.push({
      ...seed.items[0],
      id: 'item-4',
      title: 'Children of Dune',
      createdAt: '2024-02-10',
      updatedAt: '2024-02-10',
    });
    seedCollectionStore(seed);

    const LocationProbe = () => {
      const location = useLocation();
      return <div data-testid="location">{location.pathname}{location.search}</div>;
    };

    const firstSidebarRender = render(
      <MemoryRouter initialEntries={['/collections/books']}>
        <Sidebar />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('Collections')[0]).toBeInTheDocument();
    await user.click(screen.getByTitle(/reorder categories/i));
    await user.click(screen.getByRole('button', { name: /books/i }));
    await user.click(screen.getByRole('button', { name: /all/i }));
    expect(await screen.findByText('Dune')).toBeInTheDocument();
    firstSidebarRender.unmount();

    act(() => {
      useCollectionStore.setState({ menuCollectionStyle: 'style2' });
    });
    render(
      <MemoryRouter initialEntries={['/collections/books?library=all']}>
        <Sidebar />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('Books')[0]).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/search/i), 'dune');
    expect(screen.getByText('Dune')).toBeInTheDocument();
    await user.click(screen.getByText('Dune'));
    expect(screen.getByTestId('location')).toHaveTextContent('/collections/books?library=all&detail=item-1');
    await user.clear(screen.getByPlaceholderText(/search/i));
    await user.click(screen.getByText('Children of Dune'));
    expect(screen.getByTestId('location')).toHaveTextContent('/collections/books?library=all&detail=item-4');
  });

  it('updates sync affordances for healthy, queued, failed, and offline states', async () => {
    renderWithRouter(
      <TooltipProvider>
        <Topbar />
      </TooltipProvider>,
    );

    act(() => {
      useSyncStore.setState({
        status: 'idle',
        pendingCount: 0,
        queuedCount: 0,
        runningCount: 0,
        failedCount: 0,
        lastSuccessfulSyncAt: '2024-04-01T10:00:00Z',
        mutations: [],
        lastError: null,
      });
    });
    expect(screen.getByText('Synced')).toBeInTheDocument();

    act(() => {
      useSyncStore.setState({
        status: 'syncing',
        pendingCount: 2,
        queuedCount: 1,
        runningCount: 1,
        failedCount: 0,
      });
    });
    expect(screen.getByText('2 In Queue')).toBeInTheDocument();

    act(() => {
      useSyncStore.setState({
        status: 'error',
        pendingCount: 1,
        queuedCount: 0,
        runningCount: 0,
        failedCount: 1,
        lastError: 'Save item: network down',
        mutations: [
          {
            id: 'sync-1',
            label: 'Save item',
            scope: 'items',
            kind: 'mutation',
            status: 'failed',
            attempts: 2,
            queuedAt: '2024-04-01T09:00:00Z',
            lastAttemptAt: '2024-04-01T09:05:00Z',
            lastSettledAt: '2024-04-01T09:05:00Z',
            errorMessage: 'network down',
          },
        ],
      });
    });
    expect(screen.getByText('Sync Issue')).toBeInTheDocument();

    act(() => {
      useSyncStore.getState().setOnlineState(false);
    });
    expect(screen.getByText('1 Offline')).toBeInTheDocument();
  });

  it('renders app layout, handles auth redirects, and reacts to connectivity changes', async () => {
    const user = userEvent.setup();
    const init = vi.fn(() => vi.fn());
    const loadFromFirestore = vi.fn(async () => true);
    const subscribeToFirestore = vi.fn(() => vi.fn());
    const resetForUser = vi.fn();
    const upsertContributorProfile = vi.fn();
    const getLentItems = vi.fn(() => buildSeedData().items.slice(0, 1));

    useAuthStore.setState({
      isAuthenticated: true,
      isLoading: false,
      init,
    });
    useCollectionStore.setState({
      loadFromFirestore,
      subscribeToFirestore,
      resetForUser,
      upsertContributorProfile,
      getLentItems,
    });
    vi.spyOn(collectionSyncService, 'retryPending').mockResolvedValue(undefined);

    const firstLayout = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<div>Dashboard Child</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Dashboard Child')).toBeInTheDocument();
    await waitFor(() => {
      expect(init).toHaveBeenCalled();
      expect(loadFromFirestore).toHaveBeenCalledWith('contrib-1');
    });
    expect(mocks.toastWarning).toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(useSyncStore.getState().status).toBe('offline');

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => {
      expect(collectionSyncService.retryPending).toHaveBeenCalled();
    });

    firstLayout.unmount();
    act(() => {
      useAuthStore.setState({ isAuthenticated: false });
    });
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<div>Private Child</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect((await screen.findAllByText('Login Page'))[0]).toBeInTheDocument();
    await user.click(document.body);
  });
});
