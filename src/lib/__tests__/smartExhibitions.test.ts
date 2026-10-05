import { describe, expect, it } from 'vitest';

import { getItemYear, getSmartPresetItemIds, parseSmartExhibitionId, smartExhibitionId } from '@/lib/exhibition';
import { createMockItem } from '@/test/helpers';
import type { CollectionItem } from '@/types';

function item(id: string, overrides: Partial<CollectionItem> = {}): CollectionItem {
  return {
    ...createMockItem({ images: [`https://example.com/${id}.jpg`], ...overrides }),
    id,
    createdAt: overrides.createdAt ?? '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

const value = (entry: CollectionItem) => entry.valuationInfo.currentEstimatedValue;
const withValue = (id: string, amount: number, extra: Partial<CollectionItem> = {}) => item(id, {
  valuationInfo: { currentEstimatedValue: amount, currentValueCurrency: 'USD', currentExchangeRate: 1, valueHistory: [] },
  ...extra,
});

describe('smart exhibitions', () => {
  it('round-trips preset ids', () => {
    expect(parseSmartExhibitionId(smartExhibitionId('topValue'))).toBe('topValue');
    expect(parseSmartExhibitionId('smart:nope')).toBeNull();
    expect(parseSmartExhibitionId('123-abc')).toBeNull();
  });

  it('picks the ten most valuable pieces, after dropping ones without photos', () => {
    const items = Array.from({ length: 14 }, (_, index) => withValue(`v${index}`, (index + 1) * 100));
    items.push(withValue('noPhoto', 99_999, { images: [] }));
    const ids = getSmartPresetItemIds('topValue', items, { onlyWithPhotos: true, valueOf: value });
    expect(ids).toHaveLength(10);
    expect(ids[0]).toBe('v13');
    expect(ids).not.toContain('noPhoto');
    expect(getSmartPresetItemIds('topValue', items, { onlyWithPhotos: false, valueOf: value })[0]).toBe('noPhoto');
  });

  it('lists items added this year, newest first', () => {
    const now = new Date('2026-10-05T12:00:00');
    const items = [
      item('old', { createdAt: '2025-12-31T10:00:00.000Z' }),
      item('jan', { createdAt: '2026-01-10T10:00:00.000Z' }),
      item('sep', { createdAt: '2026-09-01T10:00:00.000Z' }),
    ];
    expect(getSmartPresetItemIds('addedThisYear', items, { onlyWithPhotos: true, valueOf: value, now })).toEqual(['sep', 'jan']);
  });

  it('orders recent acquisitions by purchase date', () => {
    const purchase = (purchasedAt: string) => ({ purchasedAt, purchasePrice: 1, purchaseCurrency: 'USD', exchangeRateAtPurchase: 1 });
    const items = [
      item('a', { purchaseInfo: purchase('2021-01-01') }),
      item('b', { purchaseInfo: purchase('2024-06-01') }),
      item('c', { purchaseInfo: purchase('2023-03-01') }),
    ];
    expect(getSmartPresetItemIds('recentlyAcquired', items, { onlyWithPhotos: true, valueOf: value })).toEqual(['b', 'c', 'a']);
  });

  it('draws a stable random selection of at most 15 per seed', () => {
    const items = Array.from({ length: 30 }, (_, index) => item(`r${index}`));
    const first = getSmartPresetItemIds('random', items, { onlyWithPhotos: true, valueOf: value, seed: 3 });
    expect(first).toHaveLength(15);
    expect(getSmartPresetItemIds('random', items, { onlyWithPhotos: true, valueOf: value, seed: 3 })).toEqual(first);
    expect(getSmartPresetItemIds('random', items, { onlyWithPhotos: true, valueOf: value, seed: 4 })).not.toEqual(first);
  });

  it('orders pieces from oldest to newest by their year field, including BC', () => {
    const items = [
      item('modern', { customFields: { year: 1969 } }),
      item('ancient', { customFields: { year: -440 } }),
      item('book', { customFields: { publishYear: '1866' } }),
      item('undated', { customFields: {} }),
    ];
    expect(getItemYear(items[2])).toBe(1866);
    expect(getSmartPresetItemIds('chronological', items, { onlyWithPhotos: true, valueOf: value })).toEqual(['ancient', 'book', 'modern']);
  });
});
