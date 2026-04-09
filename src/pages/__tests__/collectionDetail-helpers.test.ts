import { describe, expect, it } from 'vitest';

import { DEFAULT_FILTERS } from '@/components/shared';
import { createMockCategory, createMockItem } from '@/test/helpers';
import {
  filterCollectionItems,
  getCollectionFilterMeta,
  getCollectionStats,
  getKeyFields,
} from '../collectionDetail-helpers';

describe('collection detail helpers', () => {
  const category = {
    ...createMockCategory({
      fields: [
        { id: 'title', key: 'title', label: 'Title', type: 'text', required: true, order: 0 },
        { id: 'author', key: 'author', label: 'Author', type: 'text', required: false, order: 1 },
        { id: 'publisher', key: 'publisher', label: 'Publisher', type: 'text', required: false, order: 2 },
      ],
    }),
    id: 'cat-books',
    order: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };

  const items = [
    {
      ...createMockItem({
        title: 'Alpha',
        condition: 'Mint',
        tags: ['signed'],
        isFavorite: true,
        images: ['cover.jpg'],
        isRead: true,
        customFields: { title: 'Alpha', author: 'Author A', publisher: 'Publisher A' },
        purchaseInfo: { purchasedAt: '2024-01-01', purchasePrice: 20, purchaseCurrency: 'USD', exchangeRateAtPurchase: 1, currencyEquivalents: [] },
        valuationInfo: { currentEstimatedValue: 35, currentValueCurrency: 'USD', currentExchangeRate: 1, valueHistory: [] },
      }),
      id: '1',
      createdAt: '2024-01-02',
      updatedAt: '2024-01-02',
    },
    {
      ...createMockItem({
        title: 'Beta',
        condition: 'Good',
        tags: ['classic'],
        isFavorite: false,
        images: [],
        isRead: false,
        customFields: { title: 'Beta', author: 'Author B', publisher: 'Publisher Z' },
        purchaseInfo: { purchasedAt: '2024-02-01', purchasePrice: 10, purchaseCurrency: 'EUR', exchangeRateAtPurchase: 1, currencyEquivalents: [] },
        valuationInfo: { currentEstimatedValue: 15, currentValueCurrency: 'EUR', currentExchangeRate: 1, valueHistory: [] },
      }),
      id: '2',
      createdAt: '2024-02-03',
      updatedAt: '2024-02-03',
    },
  ];

  it('extracts key fields and range metadata', () => {
    expect(getKeyFields(category, items[0])).toEqual([
      { label: 'Author', value: 'Author A' },
      { label: 'Publisher', value: 'Publisher A' },
    ]);

    const meta = getCollectionFilterMeta(items, 'USD');
    expect(meta.maxPrice).toBeGreaterThanOrEqual(20);
    expect(meta.maxValue).toBeGreaterThanOrEqual(16);
    expect(meta.tags).toEqual(['classic', 'signed']);
    expect(meta.currencies).toEqual(['EUR', 'USD']);
  });

  it('filters and sorts items across search, flags, and custom selects', () => {
    const filterMeta = getCollectionFilterMeta(items, 'USD');
    const filtered = filterCollectionItems({
      items,
      searchQuery: 'author',
      advFilters: {
        ...DEFAULT_FILTERS,
        conditions: ['Mint'],
        favoritesOnly: true,
        hasImages: true,
        readStatus: 'read',
        customSelects: { publisher: ['Publisher A'] },
      },
      filterMeta,
      sortField: 'title',
      sortOrder: 'asc',
      displayCurrency: 'USD',
    });

    expect(filtered.map((item) => item.title)).toEqual(['Alpha']);
  });

  it('sorts by publisher and computes aggregate stats', () => {
    const filterMeta = getCollectionFilterMeta(items, 'USD');
    const sorted = filterCollectionItems({
      items,
      searchQuery: '',
      advFilters: DEFAULT_FILTERS,
      filterMeta,
      sortField: 'publisher',
      sortOrder: 'desc',
      displayCurrency: 'USD',
    });

    expect(sorted.map((item) => item.title)).toEqual(['Beta', 'Alpha']);

    const stats = getCollectionStats(items, 'USD');
    expect(stats.count).toBe(2);
    expect(stats.totalValue).toBeGreaterThan(50);
    expect(stats.highestValue).toBeGreaterThan(stats.avgValue);
  });
});
