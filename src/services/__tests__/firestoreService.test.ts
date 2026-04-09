import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  collection: vi.fn((...parts: string[]) => ({ kind: 'collection', path: parts.join('/') })),
  doc: vi.fn((...parts: string[]) => ({ kind: 'doc', path: parts.join('/') })),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn((...args: unknown[]) => ({ kind: 'query', args })),
  orderBy: vi.fn((field: string, direction?: string) => ({ field, direction })),
  limit: vi.fn((count: number) => ({ count })),
  onSnapshot: vi.fn(),
  writeBatchCommit: vi.fn(),
  batchSet: vi.fn(),
  batchDelete: vi.fn(),
  isFirebaseConfigured: vi.fn(() => true),
}));

vi.mock('firebase/firestore', () => ({
  collection: mocks.collection,
  doc: mocks.doc,
  getDocs: mocks.getDocs,
  getDoc: mocks.getDoc,
  setDoc: mocks.setDoc,
  deleteDoc: mocks.deleteDoc,
  writeBatch: vi.fn(() => ({
    set: mocks.batchSet,
    delete: mocks.batchDelete,
    commit: mocks.writeBatchCommit,
  })),
  query: mocks.query,
  orderBy: mocks.orderBy,
  limit: mocks.limit,
  onSnapshot: mocks.onSnapshot,
}));

vi.mock('@/services/firebase', () => ({
  db: { app: 'db' },
  isFirebaseConfigured: mocks.isFirebaseConfigured,
}));

import { firestoreService } from '@/services/firestoreService';

function makeDocs(entries: Array<Record<string, unknown>>) {
  return entries.map((entry) => ({
    id: String(entry.id),
    data: () => {
      const { id: _id, ...rest } = entry;
      return rest;
    },
    ref: { path: `ref/${entry.id}` },
  }));
}

describe('firestoreService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isFirebaseConfigured.mockReturnValue(true);
    mocks.batchSet.mockImplementation(() => undefined);
    mocks.batchDelete.mockImplementation(() => undefined);
    mocks.writeBatchCommit.mockResolvedValue(undefined);
    mocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ displayCurrency: 'USD', role: 'admin' }),
    });
    mocks.getDocs.mockResolvedValue({ docs: [] });
    mocks.setDoc.mockResolvedValue(undefined);
    mocks.deleteDoc.mockResolvedValue(undefined);
    mocks.onSnapshot.mockImplementation((_target: unknown, onNext: (snap: { docs: ReturnType<typeof makeDocs>; exists?: () => boolean; data?: () => unknown }) => void) => {
      onNext({ docs: [] });
      return vi.fn();
    });
  });

  it('loads and saves collections, items, contributors, and user settings', async () => {
    mocks.getDocs
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'cat-1', name: 'Books', order: 0 }]) })
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'item-1', title: 'Dune' }]) })
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'lib-1', name: 'Main Shelf', categoryId: 'cat-1' }]) })
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'wish-1', title: 'Neuromancer' }]) })
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'act-1', entityTitle: 'Dune', timestamp: '2024-01-01' }]) })
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'contrib-1', name: 'Ada' }]) });

    expect(await firestoreService.getUserSettings('user-1')).toMatchObject({ displayCurrency: 'USD' });
    expect(await firestoreService.getCategories('user-1')).toHaveLength(1);
    expect(await firestoreService.getItems('user-1')).toHaveLength(1);
    await expect(firestoreService.getLibraries('user-1')).resolves.toEqual([
      expect.objectContaining({ id: 'lib-1', name: 'Main Shelf', categoryIds: ['cat-1'] }),
    ]);
    expect(await firestoreService.getWishlist('user-1')).toHaveLength(1);
    expect(await firestoreService.getActivityLog('user-1')).toHaveLength(1);
    expect(await firestoreService.getContributors('user-1')).toHaveLength(1);

    await firestoreService.saveUserSettings('user-1', { theme: 'dark' });
    await firestoreService.saveCategory('user-1', { id: 'cat-1', name: 'Books' } as never);
    await firestoreService.saveItem('user-1', { id: 'item-1', title: 'Dune' } as never);
    await firestoreService.saveLibrary('user-1', { id: 'lib-1', name: 'Main Shelf', categoryIds: ['cat-1'] } as never);
    await firestoreService.saveWishlistItem('user-1', { id: 'wish-1', title: 'Wish' } as never);
    await firestoreService.addActivityEntry('user-1', { id: 'act-1', entityTitle: 'Added' } as never);
    await firestoreService.saveContributor('user-1', { id: 'contrib-1', name: 'Ada' } as never);

    expect(mocks.setDoc).toHaveBeenCalled();
  });

  it('supports batched sync, deletes, and full account wipes', async () => {
    await firestoreService.saveItems('user-1', [
      { id: 'item-1', title: 'One' } as never,
      { id: 'item-2', title: 'Two' } as never,
    ]);
    await firestoreService.deleteItems('user-1', ['item-1', 'item-2']);
    await firestoreService.syncAll('user-1', {
      categories: [{ id: 'cat-1', name: 'Books' } as never],
      items: [{ id: 'item-1', title: 'Dune' } as never],
      libraries: [{ id: 'lib-1', name: 'Main Shelf', categoryIds: ['cat-1'] } as never],
      wishlist: [{ id: 'wish-1', title: 'Wish' } as never],
      activityLog: [{ id: 'act-1', entityTitle: 'Added' } as never],
      contributors: [{ id: 'contrib-1', name: 'Ada' } as never],
      settings: { theme: 'dark', displayCurrency: 'USD' },
    });

    mocks.getDocs
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'cat-1' }]) })
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'item-1' }]) })
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'lib-1' }]) })
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'wish-1' }]) })
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'act-1' }]) })
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'contrib-1' }]) });

    await firestoreService.wipeAllUserData('user-1');
    await firestoreService.deleteCategory('user-1', 'cat-1');
    await firestoreService.deleteItem('user-1', 'item-1');
    await firestoreService.deleteLibrary('user-1', 'lib-1');
    await firestoreService.deleteWishlistItem('user-1', 'wish-1');
    await firestoreService.deleteContributor('user-1', 'contrib-1');

    expect(mocks.batchSet).toHaveBeenCalled();
    expect(mocks.batchDelete).toHaveBeenCalled();
    expect(mocks.deleteDoc).toHaveBeenCalled();
  });

  it('loads all collections and subscribes to realtime snapshots', async () => {
    mocks.getDocs
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'cat-1', name: 'Books', order: 0 }]) })
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'item-1', title: 'Dune' }]) })
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'lib-1', name: 'Main Shelf', categoryId: 'cat-1' }]) })
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'wish-1', title: 'Neuromancer' }]) })
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'act-1', entityTitle: 'Dune', timestamp: '2024-01-01' }]) })
      .mockResolvedValueOnce({ docs: makeDocs([{ id: 'contrib-1', name: 'Ada' }]) });

    const loaded = await firestoreService.loadAll('user-1');
    expect(loaded.categories).toHaveLength(1);
    expect(loaded.items).toHaveLength(1);

    const onData = vi.fn();
    const onError = vi.fn();

    const unsubs = [vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn()];
    let index = 0;
    mocks.onSnapshot.mockImplementation((target: { kind?: string }, onNext: (snap: { docs: ReturnType<typeof makeDocs>; exists?: () => boolean; data?: () => unknown }) => void) => {
      if (target.kind === 'doc') {
        onNext({ docs: [], exists: () => true, data: () => ({ theme: 'dark' }) });
      } else {
        onNext({ docs: makeDocs([{ id: `entry-${index}`, name: `Entry ${index}`, title: `Title ${index}`, timestamp: '2024-01-01' }]) });
      }
      const unsub = unsubs[index] ?? vi.fn();
      index += 1;
      return unsub;
    });

    const unsubscribe = firestoreService.subscribeAll('user-1', onData, onError);
    expect(onData).toHaveBeenCalled();
    unsubscribe();
    unsubs.forEach((unsub) => {
      expect(unsub).toHaveBeenCalled();
    });
  });

  it('reports availability using the Firebase config helper', () => {
    mocks.isFirebaseConfigured.mockReturnValue(false);
    expect(firestoreService.isAvailable()).toBe(false);
  });
});
