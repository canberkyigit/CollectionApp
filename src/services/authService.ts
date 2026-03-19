import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';

const googleProvider = new GoogleAuthProvider();

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

function mapUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

async function ensureUserDoc(user: User): Promise<void> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      displayCurrency: 'USD',
      theme: 'light',
      sidebarOpen: true,
      dashboardWidgets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

export const authService = {
  async loginWithEmail(email: string, password: string): Promise<AuthUser> {
    if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserDoc(cred.user);
    return mapUser(cred.user);
  },

  async registerWithEmail(email: string, password: string, displayName?: string): Promise<AuthUser> {
    if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    await ensureUserDoc(cred.user);
    return mapUser(cred.user);
  },

  async loginWithGoogle(): Promise<AuthUser> {
    if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
    const cred = await signInWithPopup(auth, googleProvider);
    await ensureUserDoc(cred.user);
    return mapUser(cred.user);
  },

  async logout(): Promise<void> {
    if (!isFirebaseConfigured()) return;
    await signOut(auth);
  },

  onAuthChanged(callback: (user: AuthUser | null) => void): Unsubscribe {
    if (!isFirebaseConfigured()) {
      return () => {};
    }
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        await ensureUserDoc(user);
        callback(mapUser(user));
      } else {
        callback(null);
      }
    });
  },

  getCurrentUser(): AuthUser | null {
    const user = auth.currentUser;
    return user ? mapUser(user) : null;
  },

  async updateUserProfile(displayName?: string, photoURL?: string): Promise<AuthUser> {
    if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const updates: { displayName?: string; photoURL?: string } = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (photoURL !== undefined) updates.photoURL = photoURL;
    await updateProfile(user, updates);
    return mapUser(user);
  },

  async changePassword(newPassword: string): Promise<void> {
    if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    await updatePassword(user, newPassword);
  },
};
