import { useSyncExternalStore } from 'react';

/**
 * API keys for optional third-party integrations (AI cataloging, Discogs,
 * Numista). Stored only in this device's localStorage — never synced to the
 * cloud, never included in backups or exports.
 */
export type IntegrationKey = 'anthropic' | 'discogs' | 'numista';

const STORAGE_PREFIX = 'curio-integration:';
const listeners = new Set<() => void>();

function read(key: IntegrationKey): string {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key) ?? '';
  } catch {
    return '';
  }
}

export function getIntegrationKey(key: IntegrationKey): string {
  return read(key).trim();
}

export function setIntegrationKey(key: IntegrationKey, value: string): void {
  try {
    if (value.trim()) localStorage.setItem(STORAGE_PREFIX + key, value.trim());
    else localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // storage unavailable — key just won't persist
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React hook: current value of an integration key, re-renders on change. */
export function useIntegrationKey(key: IntegrationKey): string {
  return useSyncExternalStore(subscribe, () => getIntegrationKey(key), () => '');
}
