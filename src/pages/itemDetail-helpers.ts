import type { Category, CollectionItem } from '@/types';

import { formatDate } from '@/lib/utils';
import { currencyService } from '@/services/currencyService';
import {
  getItemCurrentValue,
  getItemCurrentValueCurrency,
  getItemCurrentValueUSD,
  getItemGainLoss,
} from '@/lib/valuation';

export function getConditionBadgeProps(condition: string) {
  switch (condition) {
    case 'Mint':
    case 'Near Mint':
      return { variant: 'success' as const };
    case 'Very Good':
    case 'Good':
      return {
        variant: 'outline' as const,
        className: 'border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-400',
      };
    case 'Fair':
      return { variant: 'warning' as const };
    case 'Poor':
      return { variant: 'destructive' as const };
    default:
      return { variant: 'secondary' as const };
  }
}

export function buildItemChartData(item: CollectionItem, displayCurrency: string) {
  return item.valuationInfo.valueHistory.map((entry) => ({
    date: formatDate(entry.date),
    value: currencyService.convert(entry.value, entry.currency, displayCurrency),
  }));
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
