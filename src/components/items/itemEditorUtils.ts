import { useSyncExternalStore } from 'react';

import type { CategoryField } from '@/types';
import { useT } from '@/i18n';
import { CatalogLookupError, providerLabel, type CatalogProvider } from '@/services/catalogEnrichmentService';

export const INTEGRATIONS_SETTINGS_PATH = '/settings?section=integrations';

export function isAbortLike(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || String(error.message).includes('abort');
}

export function isFullWidthField(field: CategoryField): boolean {
  return field.type === 'textarea' || field.type === 'rich-notes' || field.type === 'image' || field.type === 'multi-select';
}

/** Translated message for any lookup/AI failure. */
export function useLookupErrorMessage() {
  const t = useT();
  return (error: unknown, provider: CatalogProvider): string => {
    const name = providerLabel(provider);
    if (error instanceof CatalogLookupError) {
      return t(`itemForm.lookup.error.${error.code}`, { provider: name });
    }
    return t('itemForm.lookup.error.api', { provider: name });
  };
}

const COARSE_POINTER_QUERY = '(pointer: coarse)';

function subscribeToPointer(callback: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia(COARSE_POINTER_QUERY);
  media.addEventListener?.('change', callback);
  return () => media.removeEventListener?.('change', callback);
}

function getIsTouchDevice() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(COARSE_POINTER_QUERY).matches;
}

/** True on phones/tablets — used to offer the camera capture action. */
export function useIsTouchDevice(): boolean {
  return useSyncExternalStore(subscribeToPointer, getIsTouchDevice, () => false);
}
