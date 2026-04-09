import type { CollectionItem } from '@/types';
import { currencyService } from '@/services/currencyService';
import { calculateGainLoss } from '@/lib/utils';

function shouldFallbackCurrentValueCurrencyToPurchaseCurrency(item: CollectionItem): boolean {
  const purchaseCurrency = item.purchaseInfo.purchaseCurrency;
  const currentValueCurrency = item.valuationInfo.currentValueCurrency;

  if (!purchaseCurrency || purchaseCurrency === currentValueCurrency) return false;
  if (purchaseCurrency === 'TRY' || currentValueCurrency !== 'TRY') return false;

  const purchasePrice = Number(item.purchaseInfo.purchasePrice) || 0;
  const currentEstimatedValue = Number(item.valuationInfo.currentEstimatedValue) || 0;
  if (purchasePrice <= 0 || currentEstimatedValue <= 0 || purchasePrice !== currentEstimatedValue) {
    return false;
  }

  const valueHistory = item.valuationInfo.valueHistory ?? [];
  if (valueHistory.length > 1) return false;
  if (valueHistory.length === 1) {
    const [initialEntry] = valueHistory;
    if (initialEntry.value !== currentEstimatedValue || initialEntry.currency !== currentValueCurrency) {
      return false;
    }
  }

  return true;
}

export function getItemCurrentValueCurrency(item: CollectionItem): string {
  return shouldFallbackCurrentValueCurrencyToPurchaseCurrency(item)
    ? item.purchaseInfo.purchaseCurrency
    : item.valuationInfo.currentValueCurrency;
}

export function getItemPurchaseValue(item: CollectionItem, displayCurrency: string): number {
  return currencyService.convert(
    item.purchaseInfo.purchasePrice,
    item.purchaseInfo.purchaseCurrency,
    displayCurrency,
  );
}

export function getItemCurrentValue(item: CollectionItem, displayCurrency: string): number {
  return currencyService.convert(
    item.valuationInfo.currentEstimatedValue,
    getItemCurrentValueCurrency(item),
    displayCurrency,
  );
}

export function getItemCurrentValueUSD(item: CollectionItem): number {
  return currencyService.convert(
    item.valuationInfo.currentEstimatedValue,
    getItemCurrentValueCurrency(item),
    'USD',
  );
}

export function getItemsCurrentValue(items: CollectionItem[], displayCurrency: string): number {
  return items.reduce((sum, item) => sum + getItemCurrentValue(item, displayCurrency), 0);
}

export function getItemsCurrentValueUSD(items: CollectionItem[]): number {
  return items.reduce((sum, item) => sum + getItemCurrentValueUSD(item), 0);
}

export function getItemGainLoss(item: CollectionItem, displayCurrency: string) {
  return calculateGainLoss(
    getItemPurchaseValue(item, displayCurrency),
    getItemCurrentValue(item, displayCurrency),
  );
}
