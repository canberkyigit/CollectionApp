import type { CollectionItem } from '@/types';
import { currencyService } from '@/services/currencyService';
import { getItemCurrentValueCurrency } from '@/lib/valuation';

/**
 * "Real value": compare what an item cost against what it is worth today, both
 * in Turkish lira and in a hard currency (USD or EUR). The purchase side uses
 * the FX rates stored on the item at purchase time
 * (`purchaseInfo.currencyEquivalents`, where `rate` = TRY per 1 unit of the
 * currency and `value` = the price expressed in that currency); the current
 * side uses today's rates.
 *
 * A lira gain can hide a loss in USD/EUR terms when the lira depreciates — the
 * "real change" in the reference currency is the honest number.
 */

export type RealValueReference = 'USD' | 'EUR';
export type CurrencyConverter = (amount: number, from: string, to: string) => number;

export interface PurchaseBasis {
  /** Price in TRY at the purchase-date rate. */
  paidTRY: number;
  /** Price in the reference currency at the purchase-date rate. */
  paidRef: number;
}

export interface RealValueItem extends PurchaseBasis {
  item: CollectionItem;
  /** Current value in TRY at today's rate. */
  worthTRY: number;
  /** Current value in the reference currency at today's rate. */
  worthRef: number;
  /** Change in lira terms, in percent. */
  nominalChangePct: number | null;
  /** Change in reference-currency terms, in percent. */
  realChangePct: number | null;
}

export interface RealValueSummary {
  reference: RealValueReference;
  items: RealValueItem[];
  /** Items with a purchase price but no stored purchase-date rates (excluded). */
  missingRateCount: number;
  paidTRY: number;
  paidRef: number;
  worthTRY: number;
  worthRef: number;
  nominalChangePct: number | null;
  realChangePct: number | null;
}

const defaultConverter: CurrencyConverter = (amount, from, to) => currencyService.convert(amount, from, to);

export function percentChange(from: number, to: number): number | null {
  if (!(from > 0)) return null;
  return ((to - from) / from) * 100;
}

/**
 * Guards against rates stored the wrong way round (e.g. "27" for TRY meaning
 * TRY per USD instead of USD per TRY). Historical rates drift, but never by
 * 50× against today's rate.
 */
function isPlausibleUsdRate(currency: string, rate: number): boolean {
  const today = currencyService.getRate(currency, 'USD');
  if (!(today > 0)) return true;
  const ratio = rate / today;
  return ratio < 50 && ratio > 1 / 50;
}

/** Purchase price in TRY and in the reference currency at purchase-date rates, or null if unknown. */
export function getPurchaseBasis(item: CollectionItem, reference: RealValueReference): PurchaseBasis | null {
  const price = Number(item.purchaseInfo.purchasePrice) || 0;
  if (price <= 0) return null;

  const currency = item.purchaseInfo.purchaseCurrency;
  const equivalents = (item.purchaseInfo.currencyEquivalents ?? [])
    .filter((entry) => entry.rate > 0 && entry.value > 0);

  let paidTRY: number | null = null;
  if (currency === 'TRY') paidTRY = price;
  else if (equivalents.length > 0) paidTRY = equivalents[0].value * equivalents[0].rate;

  let paidRef: number | null = null;
  if (currency === reference) {
    paidRef = price;
  } else {
    const equivalent = equivalents.find((entry) => entry.currency === reference);
    if (equivalent) {
      paidRef = equivalent.value;
    } else if (reference === 'USD') {
      // exchangeRateAtPurchase = purchase currency → USD. Imports default it to 1,
      // so only trust it when it is clearly a real rate.
      const rate = Number(item.purchaseInfo.exchangeRateAtPurchase) || 0;
      if (rate > 0 && rate !== 1 && isPlausibleUsdRate(currency, rate)) paidRef = price * rate;
    }
  }

  if (paidTRY === null || paidRef === null) return null;
  return { paidTRY, paidRef };
}

export function getItemRealValue(
  item: CollectionItem,
  reference: RealValueReference,
  convert: CurrencyConverter = defaultConverter,
): RealValueItem | null {
  const basis = getPurchaseBasis(item, reference);
  const currentValue = Number(item.valuationInfo.currentEstimatedValue) || 0;
  if (!basis || currentValue <= 0) return null;

  const currentCurrency = getItemCurrentValueCurrency(item);
  const worthTRY = convert(currentValue, currentCurrency, 'TRY');
  const worthRef = convert(currentValue, currentCurrency, reference);

  return {
    item,
    ...basis,
    worthTRY,
    worthRef,
    nominalChangePct: percentChange(basis.paidTRY, worthTRY),
    realChangePct: percentChange(basis.paidRef, worthRef),
  };
}

export function getRealValueSummary(
  items: CollectionItem[],
  reference: RealValueReference,
  convert: CurrencyConverter = defaultConverter,
): RealValueSummary {
  const included: RealValueItem[] = [];
  let missingRateCount = 0;

  for (const item of items) {
    if (item.isArchived) continue;
    if (!((Number(item.purchaseInfo.purchasePrice) || 0) > 0)) continue;
    const entry = getItemRealValue(item, reference, convert);
    if (entry) included.push(entry);
    else missingRateCount += 1;
  }

  const sum = (pick: (entry: RealValueItem) => number) => included.reduce((total, entry) => total + pick(entry), 0);
  const paidTRY = sum((entry) => entry.paidTRY);
  const paidRef = sum((entry) => entry.paidRef);
  const worthTRY = sum((entry) => entry.worthTRY);
  const worthRef = sum((entry) => entry.worthRef);

  return {
    reference,
    items: included,
    missingRateCount,
    paidTRY,
    paidRef,
    worthTRY,
    worthRef,
    nominalChangePct: percentChange(paidTRY, worthTRY),
    realChangePct: percentChange(paidRef, worthRef),
  };
}
