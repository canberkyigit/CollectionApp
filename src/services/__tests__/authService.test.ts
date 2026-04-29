import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  onAuthStateChanged: vi.fn(),
  updateProfile: vi.fn(),
  updatePassword: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  doc: vi.fn((...parts: string[]) => ({ path: parts.join('/') })),
  isFirebaseConfigured: vi.fn(() => true),
  currentUser: null as unknown,
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: mocks.signInWithEmailAndPassword,
  createUserWithEmailAndPassword: mocks.createUserWithEmailAndPassword,
  signInWithPopup: mocks.signInWithPopup,
  GoogleAuthProvider: class {},
  signOut: mocks.signOut,
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
  onAuthStateChanged: mocks.onAuthStateChanged,
  updateProfile: mocks.updateProfile,
  updatePassword: mocks.updatePassword,
}));

vi.mock('firebase/firestore', () => ({
  doc: mocks.doc,
  setDoc: mocks.setDoc,
  getDoc: mocks.getDoc,
}));

vi.mock('@/services/firebase', () => ({
  auth: {
    get currentUser() {
      return mocks.currentUser;
    },
  },
  db: { app: 'db' },
  isFirebaseConfigured: mocks.isFirebaseConfigured,
}));

import { authService } from '@/services/authService';

function createFirebaseUser(overrides: Partial<{ uid: string; email: string; displayName: string; photoURL: string }> = {}) {
  return {
    uid: 'user-1',
    email: 'tester@example.com',
    displayName: 'Test User',
    photoURL: 'https://example.com/avatar.png',
    ...overrides,
  };
}

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isFirebaseConfigured.mockReturnValue(true);
    mocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ role: 'editor' }),
    });
    mocks.setDoc.mockResolvedValue(undefined);
    mocks.currentUser = null;
  });

  it('logs in, registers, and signs in with Google using the stored profile role', async () => {
    const user = createFirebaseUser();
    mocks.signInWithEmailAndPassword.mockResolvedValue({ user });
    mocks.createUserWithEmailAndPassword.mockResolvedValue({ user });
    mocks.signInWithPopup.mockResolvedValue({ user });

    await expect(authService.loginWithEmail('tester@example.com', 'secret')).resolves.toMatchObject({ role: 'editor' });
    await expect(authService.registerWithEmail('tester@example.com', 'secret', 'Ada')).resolves.toMatchObject({ role: 'editor' });
    await expect(authService.loginWithGoogle()).resolves.toMatchObject({ role: 'editor' });

    expect(mocks.updateProfile).toHaveBeenCalledWith(user, { displayName: 'Ada' });
  });

  it('creates a user profile document on first login and reuses the legacy fallback when role is missing without writing back', async () => {
    const user = createFirebaseUser({ uid: 'user-2' });
    mocks.signInWithEmailAndPassword.mockResolvedValue({ user });
    mocks.getDoc
      .mockResolvedValueOnce({
        exists: () => false,
        data: () => ({}),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({}),
      });

    const first = await authService.loginWithEmail('tester@example.com', 'secret');
    const second = await authService.loginWithEmail('tester@example.com', 'secret');

    expect(first.role).toBe('admin');
    expect(second.role).toBe('admin');
    // Only the initial create should write to Firestore. Legacy accounts
    // without a role field must NOT trigger a follow-up write because the
    // hardened rules forbid client-side role mutations on update.
    expect(mocks.setDoc).toHaveBeenCalledTimes(1);
  });

  it('subscribes to auth changes, returns the current user, and supports profile updates', async () => {
    const user = createFirebaseUser({ displayName: 'Ada' });
    mocks.currentUser = user;
    mocks.onAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => Promise<void> | void) => {
      Promise.resolve(callback(user)).then(() => callback(null));
      return vi.fn();
    });

    const callback = vi.fn();
    authService.onAuthChanged(callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ uid: 'user-1', role: 'editor' }));
      expect(callback).toHaveBeenCalledWith(null);
    });
    expect(authService.getCurrentUser()).toMatchObject({ uid: 'user-1', role: 'admin' });

    await authService.updateUserProfile('New Name', 'https://example.com/next.png');
    expect(mocks.updateProfile).toHaveBeenCalledWith(user, {
      displayName: 'New Name',
      photoURL: 'https://example.com/next.png',
    });
  });

  it('logs out and changes passwords for authenticated users', async () => {
    const user = createFirebaseUser();
    mocks.currentUser = user;

    await authService.logout();
    await authService.changePassword('new-secret');

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.updatePassword).toHaveBeenCalledWith(user, 'new-secret');
  });

  it('sends password reset emails', async () => {
    mocks.sendPasswordResetEmail.mockResolvedValue(undefined);

    await authService.sendPasswordReset('tester@example.com');

    expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.any(Object),
      'tester@example.com',
    );
  });

  it('throws when Firebase is unavailable or no user is authenticated', async () => {
    mocks.isFirebaseConfigured.mockReturnValue(false);
    await expect(authService.loginWithEmail('x@example.com', 'pw')).rejects.toThrow('Firebase not configured');

    mocks.isFirebaseConfigured.mockReturnValue(true);
    await expect(authService.updateUserProfile('No User')).rejects.toThrow('Not authenticated');
    await expect(authService.changePassword('pw')).rejects.toThrow('Not authenticated');
  });
});
