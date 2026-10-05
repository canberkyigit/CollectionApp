import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { generateId } from '@/lib/utils';
import { useCollectionStore } from '@/store/useCollectionStore';

/**
 * Curated exhibitions ("Istanbul selection", "Top 10 by value"): a named,
 * hand-ordered list of item ids played by Exhibition mode.
 *
 * Stored device-locally in their own persisted store, scoped per signed-in
 * owner (same approach as saved views) — no change to the synced collection.
 */
export interface SavedExhibition {
  id: string;
  name: string;
  /** Items in presentation order. Missing or archived items are skipped when playing. */
  itemIds: string[];
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SavedExhibitionInput = Pick<SavedExhibition, 'name' | 'itemIds' | 'ownerUserId'>;
export type SavedExhibitionPatch = Partial<Pick<SavedExhibition, 'name' | 'itemIds'>>;

interface SavedExhibitionsState {
  exhibitions: SavedExhibition[];
  addExhibition: (input: SavedExhibitionInput) => SavedExhibition;
  updateExhibition: (id: string, patch: SavedExhibitionPatch) => void;
  removeExhibition: (id: string) => void;
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

export const useSavedExhibitionsStore = create<SavedExhibitionsState>()(
  persist(
    (set) => ({
      exhibitions: [],
      addExhibition: (input) => {
        const now = new Date().toISOString();
        const exhibition: SavedExhibition = {
          id: generateId(),
          name: input.name.trim(),
          itemIds: uniqueIds(input.itemIds),
          ownerUserId: input.ownerUserId,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ exhibitions: [...state.exhibitions, exhibition] }));
        return exhibition;
      },
      updateExhibition: (id, patch) => set((state) => ({
        exhibitions: state.exhibitions.map((exhibition) => (
          exhibition.id === id
            ? {
              ...exhibition,
              name: patch.name !== undefined ? patch.name.trim() || exhibition.name : exhibition.name,
              itemIds: patch.itemIds !== undefined ? uniqueIds(patch.itemIds) : exhibition.itemIds,
              updatedAt: new Date().toISOString(),
            }
            : exhibition
        )),
      })),
      removeExhibition: (id) => set((state) => ({
        exhibitions: state.exhibitions.filter((exhibition) => exhibition.id !== id),
      })),
    }),
    {
      name: 'curio-saved-exhibitions',
      version: 1,
      partialize: (state) => ({ exhibitions: state.exhibitions }),
    },
  ),
);

export const selectExhibitions = (state: SavedExhibitionsState) => state.exhibitions;

/** Exhibitions of one owner, newest first. */
export function filterExhibitions(exhibitions: SavedExhibition[], ownerUserId: string | null): SavedExhibition[] {
  return exhibitions
    .filter((exhibition) => exhibition.ownerUserId === ownerUserId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

/** The signed-in owner's saved exhibitions. */
export function useSavedExhibitions(): SavedExhibition[] {
  const exhibitions = useSavedExhibitionsStore(selectExhibitions);
  const ownerUserId = useCollectionStore((state) => state.ownerUserId);
  return useMemo(() => filterExhibitions(exhibitions, ownerUserId), [exhibitions, ownerUserId]);
}
