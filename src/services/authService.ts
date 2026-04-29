import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  sendPasswordResetEmail,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import type { ContributorRole } from '@/types';

const googleProvider = new GoogleAuthProvider();

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: ContributorRole;
}

interface UserProfileDoc {
  role: ContributorRole;
}

// Each user owns their own private sandbox under /users/{uid}, so newly
// registered accounts are admin of their own collection. The Firestore rules
// enforce that this `role` field cannot be changed by the client after
// creation (see firestore.rules), preventing privilege escalation while
// keeping the new-user experience friction-free.
const DEFAULT_NEW_USER_ROLE: ContributorRole = 'admin';

// Fallback for legacy accounts whose Firestore document was created before
// the role field existed. We deliberately do NOT write this back to Firestore
// because the rules block role mutations on update.
const LEGACY_FALLBACK_ROLE: ContributorRole = 'admin';

function mapUser(user: User, role: ContributorRole = LEGACY_FALLBACK_ROLE): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    role,
  };
}

async function ensureUserDoc(user: User): Promise<UserProfileDoc> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const profile: UserProfileDoc = { role: DEFAULT_NEW_USER_ROLE };
    await setDoc(ref, {
      ...profile,
      displayCurrency: 'USD',
      theme: 'light',
      sidebarOpen: true,
      dashboardWidgets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return profile;
  }

  const data = snap.data() as Partial<UserProfileDoc>;
  return {
    role: data.role ?? LEGACY_FALLBACK_ROLE,
  };
}

export const authService = {
  async loginWithEmail(email: string, password: string): Promise<AuthUser> {
    if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await ensureUserDoc(cred.user);
    return mapUser(cred.user, profile.role);
  },

  async registerWithEmail(email: string, password: string, displayName?: string): Promise<AuthUser> {
    if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    const profile = await ensureUserDoc(cred.user);
    return mapUser(cred.user, profile.role);
  },

  async loginWithGoogle(): Promise<AuthUser> {
    if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
    const cred = await signInWithPopup(auth, googleProvider);
    const profile = await ensureUserDoc(cred.user);
    return mapUser(cred.user, profile.role);
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
        const profile = await ensureUserDoc(user);
        callback(mapUser(user, profile.role));
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

  async sendPasswordReset(email: string): Promise<void> {
    if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
    await sendPasswordResetEmail(auth, email);
  },
};
