import { describe, expect, it } from 'vitest';

import type { CollectionItem } from '@/types';
import { createMockItem } from '@/test/helpers';
import {
  getItemRealValue,
  getPurchaseBasis,
  getRealValueSummary,
  percentChange,
  type CurrencyConverter,
} from '@/lib/realValue';

// Units per 1 USD today.
const TODAY: Record<string, number> = { USD: 1, TRY: 40, EUR: 0.9 };
const convert: CurrencyConverter = (amount, from, to) => (amount / TODAY[from]) * TODAY[to];

function item(id: string, overrides: Partial<CollectionItem>): CollectionItem {
  return { ...createMockItem(overrides), id, createdAt: '2024-01-01', updatedAt: '2024-01-01' };
}

const usdBought = item('usd', {
  purchaseInfo: {
    purchasedAt: '2023-01-10',
    purchasePrice: 100,
    purchaseCurrency: 'USD',
    exchangeRateAtPurchase: 1,
    currencyEquivalents: [
      { currency: 'USD', rate: 31, value: 100 },
      { currency: 'EUR', rate: 34, value: 3100 / 34 },
    ],
  },
  valuationInfo: { currentEstimatedValue: 150, currentValueCurrency: 'USD', currentExchangeRate: 1, valueHistory: [] },
});

const tryBought = item('try', {
  purchaseInfo: {
    purchasedAt: '2022-05-01',
    purchasePrice: 1000,
    purchaseCurrency: 'TRY',
    exchangeRateAtPurchase: 0.05,
    currencyEquivalents: [
      { currency: 'USD', rate: 20, value: 50 },
      { currency: 'EUR', rate: 25, value: 40 },
    ],
  },
  valuationInfo: { currentEstimatedValue: 1600, currentValueCurrency: 'TRY', currentExchangeRate: 1, valueHistory: [] },
});

const noRates = item('no-rates', {
  purchaseInfo: {
    purchasedAt: '2024-01-01',
    purchasePrice: 80,
    purchaseCurrency: 'USD',
    exchangeRateAtPurchase: 1,
    currencyEquivalents: [],
  },
});

const unpriced = item('unpriced', {
  purchaseInfo: {
    purchasedAt: '2024-01-01',
    purchasePrice: 0,
    purchaseCurrency: 'TRY',
    exchangeRateAtPurchase: 1,
    currencyEquivalents: [],
  },
});

describe('realValue', () => {
  it('computes percent change and guards zero bases', () => {
    expect(percentChange(100, 150)).toBe(50);
    expect(percentChange(0, 150)).toBeNull();
  });

  it('derives the purchase basis from stored purchase-date rates', () => {
    expect(getPurchaseBasis(usdBought, 'USD')).toEqual({ paidTRY: 3100, paidRef: 100 });
    expect(getPurchaseBasis(tryBought, 'USD')).toEqual({ paidTRY: 1000, paidRef: 50 });
    expect(getPurchaseBasis(tryBought, 'EUR')).toEqual({ paidTRY: 1000, paidRef: 40 });
    expect(getPurchaseBasis(noRates, 'USD')).toBeNull();
    expect(getPurchaseBasis(unpriced, 'USD')).toBeNull();
  });

  it('shows a lira gain that is a real loss in USD terms', () => {
    const entry = getItemRealValue(tryBought, 'USD', convert);
    expect(entry).not.toBeNull();
    expect(entry!.worthTRY).toBe(1600);
    expect(entry!.worthRef).toBe(40);
    expect(entry!.nominalChangePct).toBeCloseTo(60);
    expect(entry!.realChangePct).toBeCloseTo(-20);
  });

  it('values a USD purchase in lira at the purchase-date rate', () => {
    const entry = getItemRealValue(usdBought, 'USD', convert)!;
    expect(entry.paidTRY).toBe(3100);
    expect(entry.worthTRY).toBe(6000);
    expect(entry.realChangePct).toBeCloseTo(50);
    expect(entry.nominalChangePct).toBeCloseTo(((6000 - 3100) / 3100) * 100);
  });

  it('falls back to a plausible purchase rate and ignores one stored the wrong way round', () => {
    const base = {
      purchasedAt: '2023-04-22',
      purchasePrice: 1800,
      purchaseCurrency: 'TRY',
      currencyEquivalents: [],
    };
    const plausible = item('plausible', { purchaseInfo: { ...base, exchangeRateAtPurchase: 0.037 } });
    const inverted = item('inverted', { purchaseInfo: { ...base, exchangeRateAtPurchase: 27 } });

    expect(getPurchaseBasis(plausible, 'USD')).toEqual({ paidTRY: 1800, paidRef: 1800 * 0.037 });
    expect(getPurchaseBasis(inverted, 'USD')).toBeNull();
  });

  it('aggregates included items and counts items missing rates', () => {
    const summary = getRealValueSummary([usdBought, tryBought, noRates, unpriced], 'USD', convert);
    expect(summary.items.map((entry) => entry.item.id)).toEqual(['usd', 'try']);
    expect(summary.missingRateCount).toBe(1);
    expect(summary.paidTRY).toBe(4100);
    expect(summary.worthTRY).toBe(7600);
    expect(summary.paidRef).toBe(150);
    expect(summary.worthRef).toBe(190);
    expect(summary.realChangePct).toBeCloseTo((40 / 150) * 100);
  });

  it('skips archived items and supports EUR as the reference', () => {
    const archived = { ...usdBought, id: 'archived', isArchived: true };
    const summary = getRealValueSummary([archived, tryBought], 'EUR', convert);
    expect(summary.items).toHaveLength(1);
    expect(summary.paidRef).toBe(40);
    expect(summary.worthRef).toBeCloseTo(36);
    expect(summary.realChangePct).toBeCloseTo(-10);
  });
});
