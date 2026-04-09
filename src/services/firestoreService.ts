import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  limit,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import type {
  Category,
  CollectionItem,
  WishlistItem,
  ActivityLogEntry,
  Contributor,
  Library,
  DashboardWidgetConfig,
  ContributorRole,
} from '@/types';
import { normalizeLibrary } from '@/lib/libraries';

function userPath(userId: string) {
  return `users/${userId}`;
}

function subCol(userId: string, col: string) {
  return collection(db, userPath(userId), col);
}

function subDoc(userId: string, col: string, docId: string) {
  return doc(db, userPath(userId), col, docId);
}

const BATCH_LIMIT = 499;

async function commitInChunks(ops: ((b: ReturnType<typeof writeBatch>) => void)[]): Promise<void> {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
    await batch.commit();
  }
}

function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as T;
  if (Array.isArray(obj)) return obj.map((entry) => stripUndefined(entry)) as T;
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      if (val !== undefined) {
        result[key] = stripUndefined(val);
      }
    }
    return result as T;
  }
  return obj;
}

export interface UserSettings {
  displayCurrency: string;
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  menuCollectionStyle: 'style1' | 'style2';
  dashboardWidgets: DashboardWidgetConfig[];
  readNotificationIds: string[];
  notifications: { valueChangeAlerts: boolean; newItemReminders: boolean; collectionMilestones: boolean };
}

export interface UserProfileDoc extends Partial<UserSettings> {
  role?: ContributorRole;
}

export interface FirestoreSnapshot {
  categories: Category[];
  items: CollectionItem[];
  libraries: Library[];
  wishlist: WishlistItem[];
  activityLog: ActivityLogEntry[];
  contributors: Contributor[];
  settings: UserSettings | null;
}

export const firestoreService = {
  isAvailable(): boolean {
    return isFirebaseConfigured();
  },

  // ── User Settings ──
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return null;
    return snap.data() as UserSettings;
  },

  async saveUserSettings(userId: string, settings: Partial<UserSettings>): Promise<void> {
    await setDoc(doc(db, 'users', userId), stripUndefined({
      ...settings,
      updatedAt: new Date().toISOString(),
    }), { merge: true });
  },

  // ── Categories ──
  async getCategories(userId: string): Promise<Category[]> {
    const snap = await getDocs(query(subCol(userId, 'categories'), orderBy('order')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category);
  },

  async saveCategory(userId: string, category: Category): Promise<void> {
    await setDoc(subDoc(userId, 'categories', category.id), stripUndefined(category));
  },

  async deleteCategory(userId: string, categoryId: string): Promise<void> {
    await deleteDoc(subDoc(userId, 'categories', categoryId));
  },

  // ── Libraries ──
  async getLibraries(userId: string): Promise<Library[]> {
    const snap = await getDocs(subCol(userId, 'libraries'));
    return snap.docs.map((d) => normalizeLibrary({ id: d.id, ...d.data() } as Library));
  },

  async saveLibrary(userId: string, library: Library): Promise<void> {
    await setDoc(subDoc(userId, 'libraries', library.id), stripUndefined(normalizeLibrary(library)));
  },

  async deleteLibrary(userId: string, libraryId: string): Promise<void> {
    await deleteDoc(subDoc(userId, 'libraries', libraryId));
  },

  // ── Items ──
  async getItems(userId: string): Promise<CollectionItem[]> {
    const snap = await getDocs(subCol(userId, 'items'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CollectionItem);
  },

  async saveItem(userId: string, item: CollectionItem): Promise<void> {
    await setDoc(subDoc(userId, 'items', item.id), stripUndefined(item));
  },

  async saveItems(userId: string, items: CollectionItem[]): Promise<void> {
    await commitInChunks(items.map((item) => (b) => b.set(subDoc(userId, 'items', item.id), stripUndefined(item))));
  },

  async deleteItem(userId: string, itemId: string): Promise<void> {
    await deleteDoc(subDoc(userId, 'items', itemId));
  },

  async deleteItems(userId: string, itemIds: string[]): Promise<void> {
    await commitInChunks(itemIds.map((id) => (b) => b.delete(subDoc(userId, 'items', id))));
  },

  // ── Wishlist ──
  async getWishlist(userId: string): Promise<WishlistItem[]> {
    const snap = await getDocs(subCol(userId, 'wishlist'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WishlistItem);
  },

  async saveWishlistItem(userId: string, item: WishlistItem): Promise<void> {
    await setDoc(subDoc(userId, 'wishlist', item.id), stripUndefined(item));
  },

  async deleteWishlistItem(userId: string, itemId: string): Promise<void> {
    await deleteDoc(subDoc(userId, 'wishlist', itemId));
  },

  // ── Activity Log ──
  async getActivityLog(userId: string, count = 100): Promise<ActivityLogEntry[]> {
    const snap = await getDocs(query(subCol(userId, 'activityLog'), orderBy('timestamp', 'desc'), limit(count)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ActivityLogEntry);
  },

  async addActivityEntry(userId: string, entry: ActivityLogEntry): Promise<void> {
    await setDoc(subDoc(userId, 'activityLog', entry.id), stripUndefined(entry));
  },

  async clearActivityLog(userId: string): Promise<void> {
    const snap = await getDocs(subCol(userId, 'activityLog'));
    await commitInChunks(snap.docs.map((d) => (b) => b.delete(d.ref)));
  },

  // ── Contributors ──
  async getContributors(userId: string): Promise<Contributor[]> {
    const snap = await getDocs(subCol(userId, 'contributors'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Contributor);
  },

  async saveContributor(userId: string, contributor: Contributor): Promise<void> {
    await setDoc(subDoc(userId, 'contributors', contributor.id), stripUndefined(contributor));
  },

  async deleteContributor(userId: string, contributorId: string): Promise<void> {
    await deleteDoc(subDoc(userId, 'contributors', contributorId));
  },

  subscribeAll(
    userId: string,
    onData: (snapshot: FirestoreSnapshot) => void,
    onError?: (error: unknown) => void,
  ): Unsubscribe {
    const snapshot: FirestoreSnapshot = {
      categories: [],
      items: [],
      libraries: [],
      wishlist: [],
      activityLog: [],
      contributors: [],
      settings: null,
    };

    const emit = () => {
      onData({
        categories: snapshot.categories,
        items: snapshot.items,
        libraries: snapshot.libraries,
        wishlist: snapshot.wishlist,
        activityLog: snapshot.activityLog,
        contributors: snapshot.contributors,
        settings: snapshot.settings,
      });
    };

    const unsubs: Unsubscribe[] = [
      onSnapshot(query(subCol(userId, 'categories'), orderBy('order')), (snap) => {
        snapshot.categories = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Category);
        emit();
      }, onError),
      onSnapshot(subCol(userId, 'items'), (snap) => {
        snapshot.items = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as CollectionItem);
        emit();
      }, onError),
      onSnapshot(query(subCol(userId, 'libraries'), orderBy('order')), (snap) => {
        snapshot.libraries = snap.docs.map((docSnap) => normalizeLibrary({ id: docSnap.id, ...docSnap.data() } as Library));
        emit();
      }, onError),
      onSnapshot(subCol(userId, 'wishlist'), (snap) => {
        snapshot.wishlist = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as WishlistItem);
        emit();
      }, onError),
      onSnapshot(query(subCol(userId, 'activityLog'), orderBy('timestamp', 'desc'), limit(100)), (snap) => {
        snapshot.activityLog = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as ActivityLogEntry);
        emit();
      }, onError),
      onSnapshot(subCol(userId, 'contributors'), (snap) => {
        snapshot.contributors = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Contributor);
        emit();
      }, onError),
      onSnapshot(doc(db, 'users', userId), (snap) => {
        snapshot.settings = snap.exists() ? (snap.data() as UserSettings) : null;
        emit();
      }, onError),
    ];

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  },

  // ── Bulk Sync (initial upload from localStorage) ──
  async syncAll(userId: string, data: {
    categories: Category[];
    items: CollectionItem[];
    libraries: Library[];
    wishlist: WishlistItem[];
    activityLog: ActivityLogEntry[];
    contributors: Contributor[];
    settings: Partial<UserSettings>;
  }): Promise<void> {
    const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [];

    ops.push((b) => b.set(
      doc(db, 'users', userId),
      { ...data.settings, updatedAt: new Date().toISOString() },
      { merge: true },
    ));

    data.categories.forEach((c) => ops.push((b) => b.set(subDoc(userId, 'categories', c.id), stripUndefined(c))));
    data.items.forEach((i) => ops.push((b) => b.set(subDoc(userId, 'items', i.id), stripUndefined(i))));
    data.libraries.forEach((l) => ops.push((b) => b.set(subDoc(userId, 'libraries', l.id), stripUndefined(normalizeLibrary(l)))));
    data.wishlist.forEach((w) => ops.push((b) => b.set(subDoc(userId, 'wishlist', w.id), stripUndefined(w))));
    data.activityLog.slice(0, 50).forEach((a) => ops.push((b) => b.set(subDoc(userId, 'activityLog', a.id), stripUndefined(a))));
    data.contributors.forEach((c) => ops.push((b) => b.set(subDoc(userId, 'contributors', c.id), stripUndefined(c))));

    await commitInChunks(ops);
  },

  async wipeAllUserData(userId: string): Promise<void> {
    const collectionsToClear = [
      'categories',
      'items',
      'libraries',
      'wishlist',
      'activityLog',
      'contributors',
    ] as const;

    await Promise.all(collectionsToClear.map(async (collectionName) => {
      const snap = await getDocs(subCol(userId, collectionName));
      await commitInChunks(snap.docs.map((docSnap) => (batch) => batch.delete(docSnap.ref)));
    }));

    await deleteDoc(doc(db, 'users', userId));
  },

  // ── Load All (initial load from Firestore) ──
  async loadAll(userId: string): Promise<{
    categories: Category[];
    items: CollectionItem[];
    libraries: Library[];
    wishlist: WishlistItem[];
    activityLog: ActivityLogEntry[];
    contributors: Contributor[];
    settings: UserSettings | null;
  }> {
    const [categories, items, libraries, wishlist, activityLog, contributors, settings] = await Promise.all([
      this.getCategories(userId),
      this.getItems(userId),
      this.getLibraries(userId),
      this.getWishlist(userId),
      this.getActivityLog(userId),
      this.getContributors(userId),
      this.getUserSettings(userId),
    ]);
    return { categories, items, libraries, wishlist, activityLog, contributors, settings };
  },
};
