import { logger } from '@/services/logger';
import { useSyncStore } from '@/store/useSyncStore';

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

interface SyncJob {
  id: string;
  label: string;
  scope: string;
  operation: SyncOperation<void>;
  rollback?: () => void | Promise<void>;
  rollbackOnPermanentFailure: boolean;
  maxAttempts: number;
  attempts: number;
}

const pendingJobs = new Map<string, SyncJob>();
let processing = false;

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
        useSyncStore.getState().resolveMutation(nextJob.id, nextJob.label);
      } catch (error) {
        nextJob.attempts += 1;
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

  resetForTests(): void {
    pendingJobs.clear();
    processing = false;
  },
};
