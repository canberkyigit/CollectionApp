import { describe, expect, it } from 'vitest';

import type { DashboardWidgetConfig } from '@/types';
import { createMockCategory, createMockItem } from '@/test/helpers';
import {
  getDashboardCategoryStats,
  getDashboardMonthlyAcquisitions,
  getDashboardSummary,
  getDashboardValueOverTime,
  getFavoriteDashboardItems,
  getFilteredDashboardItems,
  getVisibleDashboardWidgets,
  getWishlistPendingCount,
  getWishlistPreviewItems,
} from '../dashboard-helpers';

describe('dashboard helpers', () => {
  it('filters active items by selected library', () => {
    const items = [
      { ...createMockItem({ title: 'Shelf A', libraryId: 'lib-a' }), id: '1', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      { ...createMockItem({ title: 'Shelf B', libraryId: 'lib-b' }), id: '2', createdAt: '2024-01-02', updatedAt: '2024-01-02' },
      { ...createMockItem({ title: 'Archived', libraryId: 'lib-a', isArchived: true }), id: '3', createdAt: '2024-01-03', updatedAt: '2024-01-03' },
    ];

    expect(getFilteredDashboardItems(items, 'all')).toHaveLength(2);
    expect(getFilteredDashboardItems(items, 'lib-a').map((item) => item.title)).toEqual(['Shelf A']);
  });

  it('builds purchase summary and trend', () => {
    const items = [
      {
        ...createMockItem({
          purchaseInfo: { purchasedAt: '2024-01-01', purchasePrice: 100, purchaseCurrency: 'USD', exchangeRateAtPurchase: 1, currencyEquivalents: [] },
          valuationInfo: { currentEstimatedValue: 150, currentValueCurrency: 'USD', currentExchangeRate: 1, valueHistory: [] },
        }),
        id: '1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    ];

    const summary = getDashboardSummary(items);

    expect(summary.totalPurchasePrice).toBe(100);
    expect(summary.totalValue).toBe(150);
    expect(summary.valueTrend).toBe(50);
    expect(summary.itemsWithPurchase).toHaveLength(1);
  });

  it('aggregates category, timeline, favorites, and widgets', () => {
    const categories = [
      { ...createMockCategory({ name: 'Books', slug: 'books' }), id: 'cat-books', order: 0, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      { ...createMockCategory({ name: 'Vinyl', slug: 'vinyl' }), id: 'cat-vinyl', order: 1, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    ];
    const items = [
      {
        ...createMockItem({
          categoryId: 'cat-books',
          title: 'Book One',
          isFavorite: true,
          purchaseInfo: { purchasedAt: '2024-01-01', purchasePrice: 30, purchaseCurrency: 'USD', exchangeRateAtPurchase: 1, currencyEquivalents: [] },
          valuationInfo: {
            currentEstimatedValue: 40,
            currentValueCurrency: 'USD',
            currentExchangeRate: 1,
            valueHistory: [{ date: '2024-01-15', value: 35, currency: 'USD' }],
          },
        }),
        id: '1',
        createdAt: '2024-01-05',
        updatedAt: '2024-01-05',
      },
      {
        ...createMockItem({
          categoryId: 'cat-vinyl',
          title: 'Record One',
          purchaseInfo: { purchasedAt: '2024-02-01', purchasePrice: 50, purchaseCurrency: 'USD', exchangeRateAtPurchase: 1, currencyEquivalents: [] },
          valuationInfo: {
            currentEstimatedValue: 60,
            currentValueCurrency: 'USD',
            currentExchangeRate: 1,
            valueHistory: [{ date: '2024-02-10', value: 55, currency: 'USD' }],
          },
        }),
        id: '2',
        createdAt: '2024-02-05',
        updatedAt: '2024-02-05',
      },
    ];
    const widgets: DashboardWidgetConfig[] = [
      { id: 'wishlist', label: 'Wishlist', description: '', icon: 'Heart', visible: false, order: 2, size: 'half' },
      { id: 'stats', label: 'Stats', description: '', icon: 'BarChart3', visible: true, order: 1, size: 'full' },
    ];

    expect(getDashboardCategoryStats(categories, items)).toEqual([
      { categoryId: 'cat-books', name: 'Books', count: 1, totalValue: 40 },
      { categoryId: 'cat-vinyl', name: 'Vinyl', count: 1, totalValue: 60 },
    ]);
    expect(getDashboardMonthlyAcquisitions(items)).toEqual([
      { month: '2024-01', count: 1, value: 30 },
      { month: '2024-02', count: 1, value: 50 },
    ]);
    expect(getDashboardValueOverTime(items)).toEqual([
      { date: '2024-01', value: 35 },
      { date: '2024-02', value: 55 },
    ]);
    expect(getFavoriteDashboardItems(items).map((item) => item.title)).toEqual(['Book One']);
    expect(getVisibleDashboardWidgets(widgets).map((widget) => widget.id)).toEqual(['stats']);
  });

  it('returns wishlist preview counts', () => {
    const wishlist = [
      { id: '1', title: 'Wanted 1', categoryId: 'cat-books', description: '', priority: 'high' as const, images: [], tags: [], addedBy: 'user-1', isAcquired: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      { id: '2', title: 'Wanted 2', categoryId: 'cat-books', description: '', priority: 'low' as const, images: [], tags: [], addedBy: 'user-1', isAcquired: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      { id: '3', title: 'Wanted 3', categoryId: 'cat-books', description: '', priority: 'must-have' as const, images: [], tags: [], addedBy: 'user-1', isAcquired: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    ];

    expect(getWishlistPendingCount(wishlist)).toBe(2);
    expect(getWishlistPreviewItems(wishlist, 1).map((item) => item.title)).toEqual(['Wanted 1']);
  });
});
