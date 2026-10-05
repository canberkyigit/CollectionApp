import type { Category, CollectionItem } from '@/types';

import { currencyService } from '@/services/currencyService';
import {
  getItemCurrentValue,
  getItemCurrentValueCurrency,
  getItemCurrentValueUSD,
  getItemGainLoss,
} from '@/lib/valuation';

export { getConditionBadgeProps } from './collectionDetail-helpers';

export interface ItemChartPoint {
  /** ISO date (YYYY-MM-DD) — format for display at render time. */
  date: string;
  value: number;
}

/**
 * Full value history for the chart, oldest first, in the display currency.
 * Starts at the purchase price when the history doesn't already cover the
 * purchase date. One point per day (the last entry for a date wins).
 */
export function buildItemChartData(item: CollectionItem, displayCurrency: string): ItemChartPoint[] {
  const byDate = new Map<string, number>();
  const history = [...(item.valuationInfo.valueHistory ?? [])]
    .filter((entry) => entry.date && Number.isFinite(Number(entry.value)))
    .sort((left, right) => left.date.localeCompare(right.date));

  const purchaseDate = item.purchaseInfo.purchasedAt?.slice(0, 10);
  const purchasePrice = Number(item.purchaseInfo.purchasePrice) || 0;
  if (purchaseDate && purchasePrice > 0 && (history.length === 0 || history[0].date.slice(0, 10) > purchaseDate)) {
    byDate.set(
      purchaseDate,
      currencyService.convert(purchasePrice, item.purchaseInfo.purchaseCurrency, displayCurrency),
    );
  }

  for (const entry of history) {
    byDate.set(entry.date.slice(0, 10), currencyService.convert(Number(entry.value), entry.currency, displayCurrency));
  }

  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({ date, value }));
}

/** Value history entries newest first (for the ledger list). */
export function getSortedValueHistory(item: CollectionItem) {
  return [...(item.valuationInfo.valueHistory ?? [])].sort((left, right) => right.date.localeCompare(left.date));
}

export function getVisibleCustomFields(category: Category, item: CollectionItem) {
  return category.fields.filter((field) => {
    if (
      field.key === 'notes' ||
      field.type === 'rich-notes' ||
      field.key === 'title' ||
      field.key === 'condition' ||
      field.key === 'quantity'
    ) {
      return false;
    }

    if (field.type === 'boolean') return true;

    const value = item.customFields[field.key];
    return value != null && value !== '';
  });
}

export function getItemDetailStats(item: CollectionItem, displayCurrency: string) {
  const currentValueDisplay = getItemCurrentValue(item, displayCurrency);
  const currentValueCurrency = getItemCurrentValueCurrency(item);
  const currentValueUSD = getItemCurrentValueUSD(item);
  const gainLoss = getItemGainLoss(item, displayCurrency);
  const currentExchangeRate = currencyService.getRate(currentValueCurrency, 'USD');
  const purchaseValueDisplay = currencyService.convert(
    item.purchaseInfo.purchasePrice,
    item.purchaseInfo.purchaseCurrency,
    displayCurrency,
  );

  return {
    currentValueDisplay,
    currentValueCurrency,
    currentValueUSD,
    currentExchangeRate,
    gainLoss,
    purchaseValueDisplay,
  };
}
