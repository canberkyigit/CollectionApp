import { useSyncExternalStore } from 'react';

function subscribe(query: string, callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const mediaQuery = window.matchMedia(query);
  const handler = () => callback();
  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}

function getSnapshot(query: string) {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia(query).matches;
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => subscribe(query, callback),
    () => getSnapshot(query),
    () => false,
  );
}
