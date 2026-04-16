import { beforeEach, describe, expect, it, vi } from 'vitest';

import { collectionSyncService } from '@/services/collectionSyncService';
import { firestoreService } from '@/services/firestoreService';
import { logger } from '@/services/logger';
import { useSyncStore } from '@/store/useSyncStore';
import { createMockItem } from '@/test/helpers';

describe('collectionSyncService', () => {
  beforeEach(() => {
    collectionSyncService.resetForTests();
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

  it('persists firestore mutations and retries them after a runtime restart', async () => {
    const item = {
      ...createMockItem({ title: 'Offline Book' }),
      id: 'item-offline',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    const saveItem = vi.spyOn(firestoreService, 'saveItem').mockResolvedValue(undefined);

    useSyncStore.getState().setOnlineState(false);
    collectionSyncService.scheduleFirestoreMutation('Save item', {
      action: 'saveItem',
      userId: 'user-1',
      payload: item,
      scope: 'items',
    });

    expect(collectionSyncService.getPersistedOutbox()).toHaveLength(1);
    expect(saveItem).not.toHaveBeenCalled();

    collectionSyncService.clearRuntimeQueueForTests();
    useSyncStore.getState().reset();
    useSyncStore.getState().setOnlineState(true);

    await collectionSyncService.retryPending();

    expect(saveItem).toHaveBeenCalledWith('user-1', item);
    expect(collectionSyncService.getPersistedOutbox()).toHaveLength(0);
    expect(useSyncStore.getState().pendingCount).toBe(0);
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
