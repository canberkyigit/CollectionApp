import { create } from 'zustand';
import type { AuthUser } from '@/services/authService';
import { authService } from '@/services/authService';
import { isFirebaseConfigured } from '@/services/firebase';

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
    } catch (err: any) {
      const msg = err.code === 'auth/invalid-credential' ? 'Invalid email or password'
        : err.code === 'auth/user-not-found' ? 'No account with this email'
        : err.code === 'auth/too-many-requests' ? 'Too many attempts, try again later'
        : err.message || 'Login failed';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  registerWithEmail: async (email, password, displayName) => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.registerWithEmail(email, password, displayName);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      const msg = err.code === 'auth/email-already-in-use' ? 'Email already in use'
        : err.code === 'auth/weak-password' ? 'Password must be at least 6 characters'
        : err.message || 'Registration failed';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  loginWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.loginWithGoogle();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        set({ error: err.message || 'Google login failed', isLoading: false });
      } else {
        set({ isLoading: false });
      }
      throw err;
    }
  },

  loginOffline: () => {
    set({
      user: { uid: 'offline', email: 'offline@local', displayName: 'Local User', photoURL: null },
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    await authService.logout();
    set({ user: null, isAuthenticated: false });
  },

  updateUserProfile: async (displayName, photoURL) => {
    const updated = await authService.updateUserProfile(displayName, photoURL);
    set({ user: updated });
  },

  changePassword: async (newPassword) => {
    await authService.changePassword(newPassword);
  },

  clearError: () => set({ error: null }),
}));
