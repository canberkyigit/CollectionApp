import { beforeEach, describe, expect, it, vi } from 'vitest';

import { collectionSyncService } from '@/services/collectionSyncService';
import { logger } from '@/services/logger';
import { useSyncStore } from '@/store/useSyncStore';

describe('collectionSyncService', () => {
  beforeEach(() => {
    useSyncStore.getState().reset();
    vi.restoreAllMocks();
  });

  it('performs successful operations and clears pending jobs', async () => {
    const result = await collectionSyncService.perform('save', async () => 'ok');

    expect(result).toBe('ok');
    expect(useSyncStore.getState().status).toBe('idle');
    expect(useSyncStore.getState().pendingCount).toBe(0);
  });

  it('tracks failures and keeps scheduled jobs retryable', async () => {
    const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const operation = vi.fn().mockRejectedValueOnce(new Error('first fail')).mockResolvedValueOnce(undefined);

    collectionSyncService.schedule('sync job', operation);
    await vi.waitFor(() => {
      expect(loggerSpy).toHaveBeenCalled();
    });

    expect(collectionSyncService.getPendingLabels()).toContain('sync job');
    expect(useSyncStore.getState().status).toBe('error');

    await collectionSyncService.retryPending();
    expect(collectionSyncService.getPendingLabels()).not.toContain('sync job');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('rethrows perform errors after storing sync metadata', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    await expect(
      collectionSyncService.perform('upload', async () => {
        throw new Error('broken');
      }),
    ).rejects.toThrow('broken');

    expect(useSyncStore.getState().lastError).toContain('upload: broken');
  });
});
