import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/App';
import { seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useAuthStore } from '@/store/useAuthStore';
import { useCollectionStore } from '@/store/useCollectionStore';

vi.mock('@/components/shared/PWAUpdatePrompt', () => ({
  PWAUpdatePrompt: () => <div>Update available</div>,
}));

describe('App shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedCollectionStore(buildSeedData());
    useCollectionStore.setState({
      loadFromFirestore: vi.fn(async () => true),
      subscribeToFirestore: vi.fn(() => vi.fn()),
      resetForUser: vi.fn(),
      upsertContributorProfile: vi.fn(),
      getLentItems: vi.fn(() => []),
    });
  });

  it('renders login when the user is not authenticated', async () => {
    window.history.pushState({}, '', '/dashboard');
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      firebaseReady: true,
      error: null,
      init: vi.fn(() => vi.fn()),
    });

    render(<App />);
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('redirects unauthorized admin routes and shows the PWA update prompt', async () => {
    window.history.pushState({}, '', '/admin');
    seedAuthStore({ uid: 'viewer-1', displayName: 'Viewer', role: 'viewer' });
    useAuthStore.setState({ init: vi.fn(() => vi.fn()) });

    render(<App />);

    expect(await screen.findByText(/update available/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText(/collections/i)[0]).toBeInTheDocument();
    });
  });

  it('sends signed-in users away from /login', async () => {
    window.history.pushState({}, '', '/login');
    seedAuthStore({ uid: 'admin-1', displayName: 'Admin', role: 'admin' });
    useAuthStore.setState({ init: vi.fn(() => vi.fn()) });

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/collections');
    });
  });

  it('shows a not-found view for unknown URLs when signed in', async () => {
    window.history.pushState({}, '', '/definitely-not-a-page');
    seedAuthStore({ uid: 'admin-1', displayName: 'Admin', role: 'admin' });
    useAuthStore.setState({ init: vi.fn(() => vi.fn()) });

    render(<App />);

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/definitely-not-a-page');
  });

  it('sends signed-out users on unknown URLs to /login', async () => {
    window.history.pushState({}, '', '/definitely-not-a-page');
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      firebaseReady: true,
      error: null,
      init: vi.fn(() => vi.fn()),
    });

    render(<App />);

    expect(await screen.findByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('initialises auth once at the app root', () => {
    window.history.pushState({}, '', '/login');
    const init = vi.fn(() => vi.fn());
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false, init });

    render(<App />);
    expect(init).toHaveBeenCalled();
  });
});
