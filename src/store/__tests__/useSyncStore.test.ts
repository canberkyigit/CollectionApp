import { beforeEach, describe, expect, it } from 'vitest';

import { useSyncStore } from '@/store/useSyncStore';

describe('useSyncStore', () => {
  beforeEach(() => {
    useSyncStore.getState().reset();
  });

  it('tracks sync operations and completion timestamps', () => {
    useSyncStore.getState().startOperation('upload items');
    expect(useSyncStore.getState().status).toBe('syncing');
    expect(useSyncStore.getState().pendingCount).toBe(1);
    expect(useSyncStore.getState().recentEvents[0]?.message).toContain('upload items started');

    useSyncStore.getState().completeOperation('upload items');
    expect(useSyncStore.getState().status).toBe('idle');
    expect(useSyncStore.getState().pendingCount).toBe(0);
    expect(useSyncStore.getState().lastSyncAt).toBeTruthy();
    expect(useSyncStore.getState().recentEvents[0]?.message).toContain('upload items completed');
  });

  it('captures failures and respects offline mode', () => {
    useSyncStore.getState().startOperation('save draft');
    useSyncStore.getState().failOperation('save draft', new Error('network down'));

    expect(useSyncStore.getState().status).toBe('error');
    expect(useSyncStore.getState().lastError).toContain('save draft: network down');
    expect(useSyncStore.getState().pendingCount).toBe(0);

    useSyncStore.getState().setOnlineState(false);
    expect(useSyncStore.getState().status).toBe('offline');
    expect(useSyncStore.getState().recentEvents[0]?.message).toBe('Working offline');

    useSyncStore.getState().setOnlineState(true);
    expect(useSyncStore.getState().status).toBe('idle');
    expect(useSyncStore.getState().recentEvents[0]?.message).toBe('Connection restored');
  });

  it('limits recent events and clears state on reset', () => {
    for (let index = 0; index < 30; index += 1) {
      useSyncStore.getState().pushEvent({ level: 'info', message: `event-${index}` });
    }

    expect(useSyncStore.getState().recentEvents).toHaveLength(25);
    expect(useSyncStore.getState().recentEvents[0]?.message).toBe('event-29');

    useSyncStore.getState().reset();
    expect(useSyncStore.getState().recentEvents).toEqual([]);
    expect(useSyncStore.getState().lastError).toBeNull();
    expect(useSyncStore.getState().pendingCount).toBe(0);
  });
});
