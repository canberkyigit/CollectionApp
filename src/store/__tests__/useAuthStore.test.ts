import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authService: {
    onAuthChanged: vi.fn(),
    loginWithEmail: vi.fn(),
    registerWithEmail: vi.fn(),
    loginWithGoogle: vi.fn(),
    logout: vi.fn(),
    updateUserProfile: vi.fn(),
    changePassword: vi.fn(),
  },
  resetForUser: vi.fn(),
  setFirebaseUserId: vi.fn(),
  setCurrentCollectionActor: vi.fn(),
  syncReset: vi.fn(),
}));

vi.mock('@/services/authService', () => ({
  authService: mocks.authService,
}));

vi.mock('@/services/firebase', () => ({
  isFirebaseConfigured: vi.fn(() => true),
}));

vi.mock('@/store/useCollectionStore', () => ({
  useCollectionStore: {
    getState: () => ({ resetForUser: mocks.resetForUser }),
  },
  setFirebaseUserId: mocks.setFirebaseUserId,
  setCurrentCollectionActor: mocks.setCurrentCollectionActor,
}));

vi.mock('@/store/useSyncStore', () => ({
  useSyncStore: {
    getState: () => ({ reset: mocks.syncReset }),
  },
}));

import { useAuthStore } from '@/store/useAuthStore';
import { isFirebaseConfigured } from '@/services/firebase';

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(isFirebaseConfigured).mockReturnValue(true);
    useAuthStore.setState({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      firebaseReady: true,
      error: null,
    });
  });

  it('initializes from auth changes', () => {
    const unsubscribe = vi.fn();
    mocks.authService.onAuthChanged.mockImplementation((callback: (user: unknown) => void) => {
      callback({ uid: 'user-1', email: 'tester@example.com', displayName: 'Tester', photoURL: null, role: 'admin' });
      return unsubscribe;
    });

    const result = useAuthStore.getState().init();

    expect(mocks.authService.onAuthChanged).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.displayName).toBe('Tester');
    expect(result).toBe(unsubscribe);
  });

  it('maps login and register failures to friendly messages', async () => {
    mocks.authService.loginWithEmail.mockRejectedValueOnce({ code: 'auth/invalid-credential', message: 'bad creds' });
    await expect(useAuthStore.getState().loginWithEmail('x@example.com', 'bad')).rejects.toEqual({ code: 'auth/invalid-credential', message: 'bad creds' });
    expect(useAuthStore.getState().error).toBe('Invalid email or password');

    mocks.authService.registerWithEmail.mockRejectedValueOnce({ code: 'auth/email-already-in-use', message: 'duplicate' });
    await expect(useAuthStore.getState().registerWithEmail('x@example.com', 'secret')).rejects.toEqual({ code: 'auth/email-already-in-use', message: 'duplicate' });
    expect(useAuthStore.getState().error).toBe('Email already in use');
  });

  it('supports offline login, profile updates, password changes, and logout cleanup', async () => {
    mocks.authService.updateUserProfile.mockResolvedValue({
      uid: 'user-1',
      email: 'tester@example.com',
      displayName: 'Updated Name',
      photoURL: 'https://example.com/avatar.png',
      role: 'viewer',
    });

    useAuthStore.getState().loginOffline();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.uid).toBe('offline');

    await useAuthStore.getState().updateUserProfile('Updated Name');
    expect(mocks.authService.updateUserProfile).toHaveBeenCalledWith('Updated Name', undefined);
    expect(useAuthStore.getState().user?.displayName).toBe('Updated Name');
    expect(useAuthStore.getState().user?.role).toBe('admin');

    await useAuthStore.getState().changePassword('new-password');
    expect(mocks.authService.changePassword).toHaveBeenCalledWith('new-password');

    await useAuthStore.getState().logout();
    expect(mocks.authService.logout).toHaveBeenCalledTimes(1);
    expect(mocks.setFirebaseUserId).toHaveBeenCalledWith(null);
    expect(mocks.setCurrentCollectionActor).toHaveBeenCalledWith(null);
    expect(mocks.resetForUser).toHaveBeenCalledWith(null, 'empty');
    expect(mocks.syncReset).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('clears popup-closed errors without persisting a message', async () => {
    mocks.authService.loginWithGoogle.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user', message: 'closed' });

    await expect(useAuthStore.getState().loginWithGoogle()).rejects.toEqual({ code: 'auth/popup-closed-by-user', message: 'closed' });
    expect(useAuthStore.getState().error).toBeNull();

    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });

  describe('offline mode (Firebase not configured)', () => {
    beforeEach(() => {
      vi.mocked(isFirebaseConfigured).mockReturnValue(false);
    });

    it('does not clobber an offline session that already exists when init runs', () => {
      useAuthStore.getState().loginOffline();
      useAuthStore.getState().init();

      expect(useAuthStore.getState().user?.uid).toBe('offline');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('restores the offline session after a reload', () => {
      useAuthStore.getState().loginOffline();
      // Simulate a fresh page load: in-memory auth state is gone, localStorage remains.
      useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true });

      useAuthStore.getState().init();

      expect(useAuthStore.getState().user?.uid).toBe('offline');
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('stays signed out on init when there is no offline session', () => {
      useAuthStore.getState().init();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('logs out of offline mode without wiping local collection data', async () => {
      useAuthStore.getState().loginOffline();
      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().user).toBeNull();
      expect(mocks.resetForUser).not.toHaveBeenCalled();
      expect(mocks.authService.logout).not.toHaveBeenCalled();

      // The session flag is cleared, so a reload does not sign back in.
      useAuthStore.getState().init();
      expect(useAuthStore.getState().user).toBeNull();
    });
  });
});
