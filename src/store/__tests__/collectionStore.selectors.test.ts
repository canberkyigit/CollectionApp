import { describe, expect, it } from 'vitest';

import { buildSeedData } from '@/test/seed';
import {
  hasRemoteSnapshotData,
  selectArchivedItems,
  selectCategoryById,
  selectCategoryBySlug,
  selectCategoryStats,
  selectContributorById,
  selectFavoriteItems,
  selectIsColdLoading,
  selectItemById,
  selectItemsByCategory,
  selectLentItems,
  selectMonthlyAcquisitions,
  selectMostValuableItems,
  selectRecentItems,
  selectTotalValue,
  selectValueOverTime,
} from '@/store/collectionStore.selectors';

describe('collectionStore selectors', () => {
  const seed = buildSeedData();
  const state = {
    categories: seed.categories,
    items: seed.items,
    contributors: seed.contributors,
    libraries: seed.libraries,
    wishlist: seed.wishlist,
    activityLog: seed.activityLog,
    ownerUserId: 'contrib-1',
    isRemoteDataLoading: false,
  };

  it('selects categories, items, and contributors by id or slug', () => {
    expect(selectCategoryById(state, 'cat-books')?.name).toBe('Books');
    expect(selectCategoryBySlug(state, 'vinyl')?.id).toBe('cat-vinyl');
    expect(selectItemById(state, 'item-1')?.title).toBe('Dune');
    expect(selectItemsByCategory(state, 'cat-books').map((item) => item.id)).toEqual(['item-1']);
    expect(selectContributorById(state, 'contrib-1')?.name).toBe('Ada Curator');
  });

  it('returns favorite, lent, archived, recent, and valuable item slices', () => {
    expect(selectFavoriteItems(state).map((item) => item.id)).toEqual(['item-1']);
    expect(selectLentItems(state).map((item) => item.id)).toEqual(['item-1']);
    expect(selectArchivedItems(state).map((item) => item.id)).toEqual(['item-3']);
    expect(selectRecentItems(state, 1).map((item) => item.id)).toEqual(['item-2']);
    expect(selectMostValuableItems(state, 1).map((item) => item.id)).toEqual(['item-2']);
  });

  it('computes totals, category stats, acquisition summaries, and value history', () => {
    expect(selectTotalValue(state)).toBe(95);
    expect(selectCategoryStats(state)).toEqual([
      { categoryId: 'cat-books', name: 'Books', count: 1, totalValue: 40 },
      { categoryId: 'cat-vinyl', name: 'Vinyl', count: 1, totalValue: 55 },
    ]);
    expect(selectMonthlyAcquisitions(state)).toEqual([
      { month: '2024-01', count: 1, value: 25 },
      { month: '2024-03', count: 1, value: 30 },
    ]);
    expect(selectValueOverTime(state)).toEqual([
      { date: '2024-01', value: 25 },
      { date: '2024-02', value: 40 },
      { date: '2024-03', value: 85 },
    ]);
  });

  it('detects remote snapshot data and cold-loading conditions', () => {
    expect(
      hasRemoteSnapshotData({
        categories: [],
        items: [],
        contributors: [],
        libraries: [],
        wishlist: [],
        activityLog: [],
        settings: null,
      }),
    ).toBe(false);

    expect(
      hasRemoteSnapshotData({
        categories: [],
        items: [],
        contributors: [],
        libraries: [],
        wishlist: [],
        activityLog: [],
        settings: { theme: 'dark' },
      }),
    ).toBe(true);

    expect(selectIsColdLoading({ ownerUserId: 'user-1', isRemoteDataLoading: true }, [0, 0, 0])).toBe(true);
    expect(selectIsColdLoading({ ownerUserId: 'user-1', isRemoteDataLoading: true }, [1, 0, 0])).toBe(false);
    expect(selectIsColdLoading({ ownerUserId: null, isRemoteDataLoading: true }, [0, 0, 0])).toBe(false);
  });
});
