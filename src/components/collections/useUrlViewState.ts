import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { FilterState } from '@/components/shared/advancedFilters.types';
import {
  EMPTY_DRAFT,
  draftSignature,
  normaliseFilters,
  parseDraft,
  parseSortParams,
  signatureOfDraft,
  withRangeBounds,
  writeDraftParams,
  writeSortParams,
  type RangeBounds,
  type ViewDraft,
  type ViewSort,
} from '@/lib/collectionViewParams';

const URL_WRITE_DELAY_MS = 300;

/**
 * Search + AdvancedFilters + sort state mirrored into the URL query.
 *
 * Typing and slider drags update local state immediately (so inputs stay
 * responsive) and are written to the URL after a short pause with
 * `replace: true`, which keeps history clean and avoids browser rate limits on
 * `history.replaceState`. When the URL changes from outside (back/forward,
 * applying a saved view, opening a shared link) the local state follows.
 */
export function useUrlViewState(bounds: RangeBounds) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSignature = draftSignature(searchParams);

  const [draft, setDraft] = useState<ViewDraft>(() => parseDraft(searchParams));
  const [seenSignature, setSeenSignature] = useState(urlSignature);
  // Last signature this hook wrote — a late-landing write must not clobber newer keystrokes.
  const [writtenSignature, setWrittenSignature] = useState<string | null>(null);

  // Follow external URL changes (derived-state-during-render pattern).
  if (urlSignature !== seenSignature) {
    setSeenSignature(urlSignature);
    if (urlSignature !== writtenSignature && urlSignature !== signatureOfDraft(draft)) {
      setDraft(parseDraft(new URLSearchParams(urlSignature)));
    }
  }

  // Debounced write of local edits to the URL.
  useEffect(() => {
    const signature = signatureOfDraft(draft);
    if (signature === urlSignature) return undefined;
    const timer = window.setTimeout(() => {
      setWrittenSignature(signature);
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        writeDraftParams(next, draft);
        return next;
      }, { replace: true });
    }, URL_WRITE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, urlSignature, setSearchParams]);

  const { maxPrice, maxValue } = bounds;
  const filters = useMemo(
    () => withRangeBounds(draft.filters, { maxPrice, maxValue }),
    [draft.filters, maxPrice, maxValue],
  );

  const setFilters = useCallback((next: FilterState) => {
    setDraft((previous) => ({ ...previous, filters: normaliseFilters(next, { maxPrice, maxValue }) }));
  }, [maxPrice, maxValue]);

  const setSearch = useCallback((search: string) => {
    setDraft((previous) => ({ ...previous, search }));
  }, []);

  const resetDraft = useCallback(() => setDraft(EMPTY_DRAFT), []);
  /** Replace search + filters at once (e.g. applying a saved view). */
  const replaceDraft = useCallback((next: ViewDraft) => setDraft(next), []);

  const urlSort = parseSortParams(searchParams);
  const setUrlSort = useCallback((sort: ViewSort | null) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      writeSortParams(next, sort);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  /** Patch non-draft params (library, detail…) without losing pending edits. */
  const setParam = useCallback((key: string, value: string | null) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value == null || value === '') next.delete(key);
      else next.set(key, value);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return {
    searchParams,
    draft,
    search: draft.search,
    filters,
    setFilters,
    setSearch,
    resetDraft,
    replaceDraft,
    urlSort,
    setUrlSort,
    setParam,
  };
}
