import { logger } from '@/services/logger';
import { firestoreService } from '@/services/firestoreService';
import { useSyncStore } from '@/store/useSyncStore';
import type {
  ActivityLogEntry,
  Category,
  CollectionItem,
  Contributor,
  Library,
  WishlistItem,
} from '@/types';
import type { UserSettings } from '@/services/firestoreService';

type SyncOperation<T = void> = () => Promise<T>;

type ScheduleOptions = {
  scope?: string;
  rollback?: () => void | Promise<void>;
  rollbackOnPermanentFailure?: boolean;
  maxAttempts?: number;
};

type PerformOptions = {
  kind?: 'mutation' | 'read';
  scope?: string;
};

type FirestoreMutationAction =
  | 'saveCategory'
  | 'deleteCategory'
  | 'saveItem'
  | 'saveItems'
  | 'deleteItem'
  | 'deleteItems'
  | 'saveWishlistItem'
  | 'deleteWishlistItem'
  | 'addActivityEntry'
  | 'clearActivityLog'
  | 'saveLibrary'
  | 'deleteLibrary'
  | 'saveContributor'
  | 'saveUserSettings';

interface FirestoreMutationSpec {
  action: FirestoreMutationAction;
  userId: string;
  payload: unknown;
  scope?: string;
  maxAttempts?: number;
}

interface SyncJob {
  id: string;
  label: string;
  scope: string;
  operation: SyncOperation<void>;
  rollback?: () => void | Promise<void>;
  rollbackOnPermanentFailure: boolean;
  maxAttempts: number;
  attempts: number;
  persistedSpec?: FirestoreMutationSpec;
}

const pendingJobs = new Map<string, SyncJob>();
let processing = false;
const OUTBOX_STORAGE_KEY = 'collectvault-sync-outbox-v1';

type PersistedJob = Omit<SyncJob, 'operation' | 'rollback'> & {
  persistedSpec: FirestoreMutationSpec;
};

function readOutbox(): PersistedJob[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedJob[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(jobs: PersistedJob[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(jobs));
  } catch (error) {
    logger.warn('sync.outbox', 'Failed to persist sync outbox', error);
  }
}

function upsertOutboxJob(job: SyncJob): void {
  if (!job.persistedSpec) return;
  const persistedJob: PersistedJob = {
    id: job.id,
    label: job.label,
    scope: job.scope,
    rollbackOnPermanentFailure: job.rollbackOnPermanentFailure,
    maxAttempts: job.maxAttempts,
    attempts: job.attempts,
    persistedSpec: job.persistedSpec,
  };
  const next = [
    persistedJob,
    ...readOutbox().filter((entry) => entry.id !== job.id),
  ];
  writeOutbox(next);
}

function removeOutboxJob(id: string): void {
  writeOutbox(readOutbox().filter((entry) => entry.id !== id));
}

function getPayloadId(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'id' in payload) {
    const id = (payload as { id?: unknown }).id;
    if (typeof id === 'string') return id;
  }
  return '';
}

function createFirestoreOperation(spec: FirestoreMutationSpec): SyncOperation<void> {
  return async () => {
    switch (spec.action) {
      case 'saveCategory':
        return firestoreService.saveCategory(spec.userId, spec.payload as Category);
      case 'deleteCategory':
        return firestoreService.deleteCategory(spec.userId, getPayloadId(spec.payload));
      case 'saveItem':
        return firestoreService.saveItem(spec.userId, spec.payload as CollectionItem);
      case 'saveItems':
        return firestoreService.saveItems(spec.userId, spec.payload as CollectionItem[]);
      case 'deleteItem':
        return firestoreService.deleteItem(spec.userId, getPayloadId(spec.payload));
      case 'deleteItems':
        return firestoreService.deleteItems(spec.userId, spec.payload as string[]);
      case 'saveWishlistItem':
        return firestoreService.saveWishlistItem(spec.userId, spec.payload as WishlistItem);
      case 'deleteWishlistItem':
        return firestoreService.deleteWishlistItem(spec.userId, getPayloadId(spec.payload));
      case 'addActivityEntry':
        return firestoreService.addActivityEntry(spec.userId, spec.payload as ActivityLogEntry);
      case 'clearActivityLog':
        return firestoreService.clearActivityLog(spec.userId);
      case 'saveLibrary':
        return firestoreService.saveLibrary(spec.userId, spec.payload as Library);
      case 'deleteLibrary':
        return firestoreService.deleteLibrary(spec.userId, getPayloadId(spec.payload));
      case 'saveContributor':
        return firestoreService.saveContributor(spec.userId, spec.payload as Contributor);
      case 'saveUserSettings':
        return firestoreService.saveUserSettings(spec.userId, spec.payload as Partial<UserSettings>);
    }
  };
}

function enqueuePersistedJob(entry: PersistedJob): void {
  if (pendingJobs.has(entry.id)) return;
  pendingJobs.set(entry.id, {
    ...entry,
    operation: createFirestoreOperation(entry.persistedSpec),
    rollbackOnPermanentFailure: entry.rollbackOnPermanentFailure ?? false,
    maxAttempts: entry.maxAttempts ?? entry.persistedSpec.maxAttempts ?? 3,
    attempts: entry.attempts ?? 0,
  });
  useSyncStore.getState().queueMutation({
    id: entry.id,
    label: entry.label,
    scope: entry.scope,
  });
}

function hydratePersistentJobs(): void {
  readOutbox().forEach(enqueuePersistedJob);
}

function isOnline() {
  return useSyncStore.getState().isOnline;
}

function isRetryable(error: unknown) {
  if (!isOnline()) return true;
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network')
      || message.includes('offline')
      || message.includes('unavailable')
      || message.includes('timeout')
    );
  }
  return false;
}

async function processQueue(): Promise<void> {
  if (processing || !isOnline()) return;

  processing = true;
  try {
    while (isOnline()) {
      const nextJob = [...pendingJobs.values()].find((job) => {
        const mutation = useSyncStore.getState().mutations.find((entry) => entry.id === job.id);
        return !mutation || mutation.status !== 'running';
      });

      if (!nextJob) break;

      useSyncStore.getState().markMutationRunning(nextJob.id);

      try {
        await nextJob.operation();
        pendingJobs.delete(nextJob.id);
        removeOutboxJob(nextJob.id);
        useSyncStore.getState().resolveMutation(nextJob.id, nextJob.label);
      } catch (error) {
        nextJob.attempts += 1;
        upsertOutboxJob(nextJob);
        useSyncStore.getState().failMutation(nextJob.id, nextJob.label, error);
        logger.error('sync', error, {
          label: nextJob.label,
          scope: nextJob.scope,
          attempts: nextJob.attempts,
        });

        const exceededAttempts = nextJob.attempts >= nextJob.maxAttempts;
        if (exceededAttempts && nextJob.rollback && nextJob.rollbackOnPermanentFailure) {
          try {
            await nextJob.rollback();
            pendingJobs.delete(nextJob.id);
            removeOutboxJob(nextJob.id);
            useSyncStore.getState().removeMutation(nextJob.id);
            useSyncStore.getState().pushEvent({
              level: 'warn',
              message: `${nextJob.label} rolled back after repeated sync failures`,
            });
          } catch (rollbackError) {
            logger.error('sync.rollback', rollbackError, { label: nextJob.label });
          }
        }

        if (!isRetryable(error)) {
          break;
        }
      }
    }
  } finally {
    processing = false;
  }
}

export const collectionSyncService = {
  schedule(label: string, operation: SyncOperation<void>, options: ScheduleOptions = {}): void {
    const job: SyncJob = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label,
      scope: options.scope ?? 'unknown',
      operation,
      rollback: options.rollback,
      rollbackOnPermanentFailure: options.rollbackOnPermanentFailure ?? false,
      maxAttempts: options.maxAttempts ?? 3,
      attempts: 0,
    };

    pendingJobs.set(job.id, job);
    useSyncStore.getState().queueMutation({
      id: job.id,
      label: job.label,
      scope: job.scope,
    });

    void processQueue();
  },

  scheduleFirestoreMutation(label: string, spec: FirestoreMutationSpec): void {
    const job: SyncJob = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label,
      scope: spec.scope ?? 'unknown',
      operation: createFirestoreOperation(spec),
      rollbackOnPermanentFailure: false,
      maxAttempts: spec.maxAttempts ?? 3,
      attempts: 0,
      persistedSpec: spec,
    };

    pendingJobs.set(job.id, job);
    upsertOutboxJob(job);
    useSyncStore.getState().queueMutation({
      id: job.id,
      label: job.label,
      scope: job.scope,
    });

    void processQueue();
  },

  async perform<T>(
    label: string,
    operation: () => Promise<T>,
    options: PerformOptions = {},
  ): Promise<T> {
    useSyncStore.getState().startOperation(label, {
      kind: options.kind ?? 'read',
      scope: options.scope ?? 'unknown',
    });

    try {
      const result = await operation();
      useSyncStore.getState().completeOperation(label, {
        kind: options.kind ?? 'read',
        scope: options.scope ?? 'unknown',
      });
      return result;
    } catch (error) {
      useSyncStore.getState().failOperation(label, error, {
        kind: options.kind ?? 'read',
        scope: options.scope ?? 'unknown',
      });
      logger.error('sync', error, { label, scope: options.scope ?? 'unknown' });
      throw error;
    }
  },

  async retryPending(): Promise<void> {
    hydratePersistentJobs();
    await processQueue();
  },

  getPendingLabels(): string[] {
    return [...pendingJobs.values()].map((job) => job.label);
  },

  getQueuedJobs() {
    return [...pendingJobs.values()].map((job) => ({
      id: job.id,
      label: job.label,
      scope: job.scope,
      attempts: job.attempts,
    }));
  },

  getPersistedOutbox(): PersistedJob[] {
    return readOutbox();
  },

  resetForTests(): void {
    pendingJobs.clear();
    processing = false;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(OUTBOX_STORAGE_KEY);
    }
  },

  clearRuntimeQueueForTests(): void {
    pendingJobs.clear();
    processing = false;
  },
};

hydratePersistentJobs();
