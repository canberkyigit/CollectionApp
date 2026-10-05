import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Route-level unsaved-changes guard for the full-page editor: intercepts
 * in-app links, browser back, reload shortcuts and tab close while `dirty`.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);
  const bypassRef = useRef(false);

  const ask = useCallback((onConfirm: () => void) => {
    pendingRef.current = onConfirm;
    setOpen(true);
  }, []);

  /** Run `action` now if clean, otherwise after the user confirms. */
  const requestLeave = useCallback((action: () => void) => {
    if (!dirty || bypassRef.current) {
      action();
      return;
    }
    ask(action);
  }, [dirty, ask]);

  const confirmLeave = useCallback(() => {
    bypassRef.current = true;
    setOpen(false);
    const pending = pendingRef.current;
    pendingRef.current = null;
    pending?.();
  }, []);

  const cancelLeave = useCallback(() => {
    pendingRef.current = null;
    setOpen(false);
  }, []);

  /** Call right before navigating away after a successful save. */
  const allowNavigation = useCallback(() => {
    bypassRef.current = true;
  }, []);

  /** Re-arm after "save & add another". */
  const rearm = useCallback(() => {
    bypassRef.current = false;
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypassRef.current) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (bypassRef.current) return;
      const isReload = event.key === 'F5' || ((event.ctrlKey || event.metaKey) && event.key === 'r');
      if (!isReload) return;
      event.preventDefault();
      ask(() => window.location.reload());
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [dirty, ask]);

  useEffect(() => {
    if (!dirty) return;
    const onPopState = () => {
      if (bypassRef.current) return;
      window.history.pushState(null, '', window.location.href);
      ask(() => navigate(-1));
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [dirty, navigate, ask]);

  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: MouseEvent) => {
      if (bypassRef.current) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank') return;
      const href = anchor.getAttribute('href');
      if (!href || /^[a-z]+:/i.test(href) || href.startsWith('//')) return;
      event.preventDefault();
      event.stopPropagation();
      ask(() => navigate(href));
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty, navigate, ask]);

  return { open, requestLeave, confirmLeave, cancelLeave, allowNavigation, rearm };
}
