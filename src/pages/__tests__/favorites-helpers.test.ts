import { describe, expect, it } from 'vitest';

import { DEFAULT_FILTERS } from '@/components/shared';
import {
  filterFavoriteItems,
  getConditionBadgeProps,
  getFavoriteFilterMeta,
  getFavoriteItems,
  getFavoriteStats,
  getKeyFields,
} from '@/pages/favorites-helpers';
import { createMockCategory, createMockItem } from '@/test/helpers';

describe('favorites helpers', () => {
  it('returns badge styles for known and unknown conditions', () => {
    expect(getConditionBadgeProps('Mint')).toEqual(
      expect.objectContaining({ variant: 'outline' }),
    );
    expect(getConditionBadgeProps('Unknown')).toEqual({
      variant: 'secondary',
      className: '',
    });
  });

  it('derives visible key fields while skipping built-in metadata fields', () => {
    const category = createMockCategory({
      fields: [
        { id: 'title', key: 'title', label: 'Title', type: 'text', required: true, order: 0 },
        { id: 'author', key: 'author', label: 'Author', type: 'text', required: false, order: 1 },
        { id: 'signed', key: 'signed', label: 'Signed', type: 'boolean', required: false, order: 2 },
        { id: 'notes', key: 'notes', label: 'Notes', type: 'textarea', required: false, order: 3 },
      ],
    });
    const item = {
      ...createMockItem({
        customFields: {
          title: 'Dune',
          author: 'Frank Herbert',
          signed: true,
          notes: 'Skip this',
        },
      }),
      id: 'item-1',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    expect(getKeyFields(undefined, item)).toEqual([]);
    expect(getKeyFields(category, item)).toEqual([
      { label: 'Author', value: 'Frank Herbert' },
      { label: 'Signed', value: 'true' },
    ]);
  });

  it('builds filter metadata, stats, and complex filtered/sorted favorite lists', () => {
    const categories = [
      { ...createMockCategory({ name: 'Books' }), id: 'cat-books', order: 0, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      { ...createMockCategory({ name: 'Vinyl', slug: 'vinyl' }), id: 'cat-vinyl', order: 1, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    ];

    const items = [
      {
        ...createMockItem({
          title: 'Dune',
          categoryId: 'cat-books',
          isFavorite: true,
          condition: 'Mint',
          tags: ['sci-fi', 'signed'],
          images: ['cover.jpg'],
          purchaseInfo: {
            purchasedAt: '2024-01-10',
            purchasePrice: 25,
            purchaseCurrency: 'USD',
            exchangeRateAtPurchase: 1,
            currencyEquivalents: [],
          },
          valuationInfo: {
            currentEstimatedValue: 50,
            currentValueCurrency: 'USD',
            currentExchangeRate: 1,
            valueHistory: [],
          },
        }),
        id: 'item-1',
        createdAt: '2024-01-10',
        updatedAt: '2024-01-10',
      },
      {
        ...createMockItem({
          title: 'Kind of Blue',
          categoryId: 'cat-vinyl',
          isFavorite: true,
          condition: 'Good',
          tags: ['jazz'],
          images: [],
          purchaseInfo: {
            purchasedAt: '2024-02-15',
            purchasePrice: 30,
            purchaseCurrency: 'USD',
            exchangeRateAtPurchase: 1,
            currencyEquivalents: [],
          },
          valuationInfo: {
            currentEstimatedValue: 60,
            currentValueCurrency: 'USD',
            currentExchangeRate: 1,
            valueHistory: [],
          },
        }),
        id: 'item-2',
        createdAt: '2024-02-15',
        updatedAt: '2024-02-15',
      },
      {
        ...createMockItem({
          title: 'Archived Favorite',
          isFavorite: true,
          isArchived: true,
        }),
        id: 'item-3',
        createdAt: '2024-03-01',
        updatedAt: '2024-03-01',
      },
    ];

    const favorites = getFavoriteItems(items);
    expect(favorites.map((item) => item.id)).toEqual(['item-1', 'item-2']);

    const meta = getFavoriteFilterMeta(favorites, 'USD');
    expect(meta).toEqual({
      maxPrice: 30,
      maxValue: 60,
      tags: ['jazz', 'sci-fi', 'signed'],
    });

    const stats = getFavoriteStats(favorites, 'USD');
    expect(stats).toEqual({
      count: 2,
      totalValue: 110,
      categories: 2,
    });

    const filtered = filterFavoriteItems({
      favorites,
      search: 'dune',
      advFilters: {
        ...DEFAULT_FILTERS,
        conditions: ['Mint'],
        priceRange: [20, 30],
        valueRange: [40, 55],
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        tags: ['signed'],
        hasImages: true,
      },
      filterMeta: meta,
      sortKey: 'title',
      sortDir: 'asc',
      displayCurrency: 'USD',
      getCategoryById: (id) => categories.find((category) => category.id === id),
    });

    expect(filtered.map((item) => item.id)).toEqual(['item-1']);
  });
});
