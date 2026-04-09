import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '@/services/logger';
import { useSyncStore } from '@/store/useSyncStore';

describe('logger', () => {
  beforeEach(() => {
    localStorage.clear();
    useSyncStore.getState().reset();
    vi.restoreAllMocks();
  });

  it('records info, warning, and error entries with serialized context', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.info('sync', 'started', { userId: 'user-1' });
    logger.warn('storage', 'slow');
    logger.error('auth', new Error('bad token'), { retry: true });

    const entries = logger.getEntries();
    expect(entries).toHaveLength(3);
    expect(entries[0]?.scope).toBe('auth');
    expect(entries[0]?.message).toBe('bad token');
    expect(entries[0]?.context).toContain('"retry":true');

    expect(infoSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(useSyncStore.getState().recentEvents[0]?.message).toContain('[auth] bad token');
  });

  it('falls back cleanly when localStorage is invalid', () => {
    localStorage.setItem('collectvault-observability-log', 'not json');

    expect(logger.getEntries()).toEqual([]);
  });
});
