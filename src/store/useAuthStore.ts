import { create } from 'zustand';
import { t } from '@/i18n';
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
  sendPasswordReset: (email: string) => Promise<void>;
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

export const OFFLINE_USER_ID = 'offline';
const OFFLINE_SESSION_KEY = 'curio-offline-session';

interface OfflineSession {
  displayName: string | null;
}

function buildOfflineUser(displayName?: string | null): AuthUser {
  return {
    uid: OFFLINE_USER_ID,
    email: 'offline@local',
    displayName: displayName || t('auth.localUser'),
    photoURL: null,
    role: 'admin',
  };
}

function readOfflineSession(): OfflineSession | null {
  try {
    const raw = localStorage.getItem(OFFLINE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OfflineSession> | null;
    return { displayName: typeof parsed?.displayName === 'string' ? parsed.displayName : null };
  } catch {
    return null;
  }
}

function writeOfflineSession(session: OfflineSession | null) {
  try {
    if (session) localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(OFFLINE_SESSION_KEY);
  } catch {
    // storage unavailable — the offline session just won't survive a reload
  }
}

/** Single source of truth for "signed in": a user object is present. */
export const selectIsAuthenticated = (state: Pick<AuthState, 'user'>) => state.user !== null;

export function isOfflineUser(user: Pick<AuthUser, 'uid'> | null | undefined): boolean {
  return user?.uid === OFFLINE_USER_ID;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  firebaseReady: isFirebaseConfigured(),
  error: null,

  init: () => {
    if (!isFirebaseConfigured()) {
      // Never clobber a session that already exists (e.g. loginOffline() ran first).
      const existing = get().user;
      if (existing) {
        set({ isLoading: false, isAuthenticated: true });
        return () => {};
      }

      const session = readOfflineSession();
      set(session
        ? { user: buildOfflineUser(session.displayName), isAuthenticated: true, isLoading: false }
        : { isLoading: false, isAuthenticated: false });
      return () => {};
    }

    // Offline sessions only exist when Firebase is not configured.
    writeOfflineSession(null);

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
      const msg = err.code === 'auth/invalid-credential' ? t('auth.error.invalidCredential')
        : err.code === 'auth/user-not-found' ? t('auth.error.userNotFound')
        : err.code === 'auth/too-many-requests' ? t('auth.error.tooManyRequests')
        : getAuthErrorMessage(error, t('auth.error.loginFailed'));
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
      const msg = err.code === 'auth/email-already-in-use' ? t('auth.error.emailInUse')
        : err.code === 'auth/weak-password' ? t('auth.error.weakPassword')
        : err.code === 'auth/invalid-email' ? t('auth.error.invalidEmail')
        : getAuthErrorMessage(error, t('auth.error.registerFailed'));
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
        set({ error: getAuthErrorMessage(error, t('auth.error.googleFailed')), isLoading: false });
      } else {
        set({ isLoading: false });
      }
      throw error;
    }
  },

  loginOffline: () => {
    const user = buildOfflineUser(readOfflineSession()?.displayName);
    writeOfflineSession({ displayName: user.displayName });
    set({ user, isAuthenticated: true, isLoading: false, error: null });
  },

  logout: async () => {
    if (isOfflineUser(get().user)) {
      // Offline data belongs to this device: end the session but keep the local collection.
      writeOfflineSession(null);
      setCurrentCollectionActor(null);
      useSyncStore.getState().reset();
      set({ user: null, isAuthenticated: false });
      return;
    }

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

  sendPasswordReset: async (email) => {
    set({ error: null });
    try {
      await authService.sendPasswordReset(email);
    } catch (error: unknown) {
      const msg = getAuthErrorMessage(error, t('auth.error.resetFailed'));
      set({ error: msg });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
