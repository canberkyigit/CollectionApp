import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_FILTERS, type FilterState } from '@/components/shared/advancedFilters.types';
import {
  VIEW_PARAM,
  writeDraftParams,
  writeSortParams,
  type ViewSort,
} from '@/lib/collectionViewParams';
import { generateId } from '@/lib/utils';
import { useCollectionStore } from '@/store/useCollectionStore';
import type { Category, ViewMode } from '@/types';

/**
 * Named saved views ("Signed first editions", "Unread sci-fi"…).
 *
 * Stored device-locally in their own persisted store (scoped per signed-in
 * owner) so they survive reloads without touching the synced collection
 * payload. A view with `categoryId: null` belongs to the Favorites page.
 */

export type SavedViewMode = ViewMode | 'list';

export interface SavedView {
  id: string;
  name: string;
  /** Category the view opens; `null` = Favorites. */
  categoryId: string | null;
  /** Library tab (library id or `unassigned`) for collection views. */
  libraryId?: string;
  /** Normalised filters (ranges `[0, 0]` = unbounded). */
  filters: FilterState;
  search: string;
  sort: ViewSort | null;
  viewMode: SavedViewMode | null;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SavedViewInput = Omit<SavedView, 'id' | 'createdAt' | 'updatedAt'>;
export type SavedViewPatch = Partial<Omit<SavedView, 'id' | 'createdAt' | 'ownerUserId'>>;

interface SavedViewsState {
  savedViews: SavedView[];
  addSavedView: (input: SavedViewInput) => SavedView;
  updateSavedView: (id: string, patch: SavedViewPatch) => void;
  removeSavedView: (id: string) => void;
}

export const useSavedViewsStore = create<SavedViewsState>()(
  persist(
    (set) => ({
      savedViews: [],
      addSavedView: (input) => {
        const now = new Date().toISOString();
        const view: SavedView = {
          ...input,
          name: input.name.trim(),
          filters: { ...DEFAULT_FILTERS, ...input.filters },
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ savedViews: [...state.savedViews, view] }));
        return view;
      },
      updateSavedView: (id, patch) => set((state) => ({
        savedViews: state.savedViews.map((view) => (
          view.id === id
            ? {
              ...view,
              ...patch,
              name: patch.name !== undefined ? patch.name.trim() || view.name : view.name,
              updatedAt: new Date().toISOString(),
            }
            : view
        )),
      })),
      removeSavedView: (id) => set((state) => ({
        savedViews: state.savedViews.filter((view) => view.id !== id),
      })),
    }),
    {
      name: 'curio-saved-views',
      version: 1,
      partialize: (state) => ({ savedViews: state.savedViews }),
    },
  ),
);

/** All saved views (every owner). Prefer `useSavedViews` in components. */
export const selectSavedViews = (state: SavedViewsState) => state.savedViews;

/**
 * Saved views for an owner. `categoryId` undefined = every view (e.g. a
 * Sidebar section), `null` = Favorites views, a string = that category.
 */
export function filterSavedViews(
  views: SavedView[],
  ownerUserId: string | null,
  categoryId?: string | null,
): SavedView[] {
  return views
    .filter((view) => view.ownerUserId === ownerUserId)
    .filter((view) => categoryId === undefined || view.categoryId === categoryId)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function useSavedViews(categoryId?: string | null): SavedView[] {
  const views = useSavedViewsStore(selectSavedViews);
  const ownerUserId = useCollectionStore((state) => state.ownerUserId);
  return useMemo(() => filterSavedViews(views, ownerUserId, categoryId), [views, ownerUserId, categoryId]);
}

/** Query string (without `?`) that reproduces a saved view. */
export function buildSavedViewSearch(
  view: Pick<SavedView, 'filters' | 'search' | 'sort' | 'libraryId' | 'viewMode'>,
): string {
  const params = new URLSearchParams();
  if (view.libraryId) params.set(VIEW_PARAM.library, view.libraryId);
  writeDraftParams(params, { search: view.search, filters: { ...DEFAULT_FILTERS, ...view.filters } });
  writeSortParams(params, view.sort);
  if (view.viewMode) params.set(VIEW_PARAM.view, view.viewMode);
  return params.toString();
}

/** Link to open a saved view, or null when its category no longer exists. */
export function getSavedViewHref(view: SavedView, categories: Pick<Category, 'id' | 'slug'>[]): string | null {
  const search = buildSavedViewSearch(view);
  const suffix = search ? `?${search}` : '';
  if (view.categoryId === null) return `/favorites${suffix}`;
  const category = categories.find((entry) => entry.id === view.categoryId);
  return category ? `/collections/${category.slug}${suffix}` : null;
}
