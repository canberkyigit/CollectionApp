import { create } from 'zustand';
import type { AuthUser } from '@/services/authService';
import { authService } from '@/services/authService';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  setCurrentCollectionActor,
  setFirebaseUserId,
  useCollectionStore,
} from '@/store/useCollectionStore';
import { useSyncStore } from '@/store/useSyncStore';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  firebaseReady: boolean;
  error: string | null;

  init: () => () => void;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginOffline: () => void;
  logout: () => Promise<void>;
  updateUserProfile: (displayName?: string, photoURL?: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  clearError: () => void;
}

type AuthErrorLike = {
  code?: string;
  message?: string;
};

function getAuthErrorMessage(error: unknown, fallback: string): string {
  const err = error as AuthErrorLike;
  return err.message || fallback;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  firebaseReady: isFirebaseConfigured(),
  error: null,

  init: () => {
    if (!isFirebaseConfigured()) {
      set({ isLoading: false, isAuthenticated: false });
      return () => {};
    }

    const unsub = authService.onAuthChanged((user) => {
      set({
        user,
        isAuthenticated: !!user,
        isLoading: false,
      });
    });

    return unsub;
  },

  loginWithEmail: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.loginWithEmail(email, password);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: unknown) {
      const err = error as AuthErrorLike;
      const msg = err.code === 'auth/invalid-credential' ? 'Invalid email or password'
        : err.code === 'auth/user-not-found' ? 'No account with this email'
        : err.code === 'auth/too-many-requests' ? 'Too many attempts, try again later'
        : getAuthErrorMessage(error, 'Login failed');
      set({ error: msg, isLoading: false });
      throw error;
    }
  },

  registerWithEmail: async (email, password, displayName) => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.registerWithEmail(email, password, displayName);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: unknown) {
      const err = error as AuthErrorLike;
      const msg = err.code === 'auth/email-already-in-use' ? 'Email already in use'
        : err.code === 'auth/weak-password' ? 'Password must be at least 6 characters'
        : getAuthErrorMessage(error, 'Registration failed');
      set({ error: msg, isLoading: false });
      throw error;
    }
  },

  loginWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.loginWithGoogle();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: unknown) {
      const err = error as AuthErrorLike;
      if (err.code !== 'auth/popup-closed-by-user') {
        set({ error: getAuthErrorMessage(error, 'Google login failed'), isLoading: false });
      } else {
        set({ isLoading: false });
      }
      throw error;
    }
  },

  loginOffline: () => {
    set({
      user: { uid: 'offline', email: 'offline@local', displayName: 'Local User', photoURL: null, role: 'admin' },
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    await authService.logout();
    setFirebaseUserId(null);
    setCurrentCollectionActor(null);
    useCollectionStore.getState().resetForUser(null, 'empty');
    useSyncStore.getState().reset();
    set({ user: null, isAuthenticated: false });
  },

  updateUserProfile: async (displayName, photoURL) => {
    const updated = await authService.updateUserProfile(displayName, photoURL);
    set((state) => ({
      user: state.user ? { ...updated, role: state.user.role } : updated,
    }));
  },

  changePassword: async (newPassword) => {
    await authService.changePassword(newPassword);
  },

  clearError: () => set({ error: null }),
}));
