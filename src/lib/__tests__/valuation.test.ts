import { describe, expect, it } from 'vitest';

import {
  getItemCurrentValue,
  getItemCurrentValueCurrency,
  getItemGainLoss,
  getItemsCurrentValue,
} from '../valuation';
import { createMockItem } from '@/test/helpers';
import type { CollectionItem } from '@/types';

describe('valuation helpers', () => {
  it('uses current estimated value instead of purchase price', () => {
    const baseItem = createMockItem({
      purchaseInfo: {
        purchasedAt: '2024-01-01T00:00:00Z',
        purchasePrice: 10,
        purchaseCurrency: 'USD',
        exchangeRateAtPurchase: 1,
      },
      valuationInfo: {
        currentEstimatedValue: 45,
        currentValueCurrency: 'USD',
        currentExchangeRate: 1,
        valueHistory: [],
      },
    });
    const item: CollectionItem = {
      ...baseItem,
      id: 'item-valuation-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    expect(getItemCurrentValue(item, 'USD')).toBe(45);
    expect(getItemsCurrentValue([item], 'USD')).toBe(45);
  });

  it('calculates gain and loss from purchase to current value', () => {
    const baseItem = createMockItem({
      purchaseInfo: {
        purchasedAt: '2024-01-01T00:00:00Z',
        purchasePrice: 20,
        purchaseCurrency: 'USD',
        exchangeRateAtPurchase: 1,
      },
      valuationInfo: {
        currentEstimatedValue: 30,
        currentValueCurrency: 'USD',
        currentExchangeRate: 1,
        valueHistory: [],
      },
    });
    const item: CollectionItem = {
      ...baseItem,
      id: 'item-valuation-2',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    expect(getItemGainLoss(item, 'USD')).toMatchObject({
      diff: 10,
      isPositive: true,
    });
  });

  it('falls back to purchase currency when a broken TRY default was stored for current valuation', () => {
    const baseItem = createMockItem({
      purchaseInfo: {
        purchasedAt: '2021-06-08T00:00:00Z',
        purchasePrice: 200,
        purchaseCurrency: 'USD',
        exchangeRateAtPurchase: 1,
        currencyEquivalents: [],
      },
      valuationInfo: {
        currentEstimatedValue: 200,
        currentValueCurrency: 'TRY',
        currentExchangeRate: 1,
        valueHistory: [{ date: '2021-06-08', value: 200, currency: 'TRY' }],
      },
    });
    const item: CollectionItem = {
      ...baseItem,
      id: 'item-valuation-3',
      createdAt: '2021-06-08T00:00:00Z',
      updatedAt: '2021-06-08T00:00:00Z',
    };

    expect(getItemCurrentValueCurrency(item)).toBe('USD');
    expect(getItemCurrentValue(item, 'USD')).toBe(200);
  });
});
