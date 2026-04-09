import { currencyService } from '@/services/currencyService';
import type { CollectionItem } from '@/types';
import { getItemCurrentValue } from '@/lib/valuation';

export function getItemNotes(item: CollectionItem): string {
  return item.notes ?? (item.customFields?.notes as string) ?? '';
}

export function getPurchaseDateValuation(item: CollectionItem, valueCurrency: string): number {
  const equivalents = item.purchaseInfo.currencyEquivalents ?? [];
  const targetEquivalent = equivalents.find((entry) => entry.currency === valueCurrency);
  if (targetEquivalent && targetEquivalent.rate > 0) {
    const purchaseCurrencyEquivalent = equivalents.find(
      (entry) => entry.currency === item.purchaseInfo.purchaseCurrency,
    );
    const purchaseTryAmount =
      item.purchaseInfo.purchaseCurrency === 'TRY'
        ? item.purchaseInfo.purchasePrice
        : item.purchaseInfo.purchasePrice * (purchaseCurrencyEquivalent?.rate ?? 0);

    if (purchaseTryAmount > 0) {
      return purchaseTryAmount / targetEquivalent.rate;
    }
  }

  if (valueCurrency === 'TRY') {
    const purchaseCurrencyEquivalent = equivalents.find(
      (entry) => entry.currency === item.purchaseInfo.purchaseCurrency,
    );
    if ((purchaseCurrencyEquivalent?.rate ?? 0) > 0) {
      return item.purchaseInfo.purchasePrice * purchaseCurrencyEquivalent!.rate;
    }
  }

  return currencyService.convert(
    item.purchaseInfo.purchasePrice,
    item.purchaseInfo.purchaseCurrency,
    valueCurrency,
  );
}

export function getValuationSummary(item: CollectionItem, valueCurrency: string) {
  const currentValuation = getItemCurrentValue(item, valueCurrency);
  const purchaseDateValuation = getPurchaseDateValuation(item, valueCurrency);
  const diff = currentValuation - purchaseDateValuation;
  const percentage = purchaseDateValuation > 0 ? (diff / purchaseDateValuation) * 100 : 0;

  return {
    currentValuation,
    purchaseDateValuation,
    gainLoss: {
      diff,
      percentage,
      isPositive: diff >= 0,
    },
  };
}
