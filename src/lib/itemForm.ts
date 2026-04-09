import type { CategoryField, CollectionItem, CurrencyEquivalent } from '@/types';
import { currencyService } from '@/services/currencyService';
import { storageService } from '@/services/storageService';
import { getItemCurrentValueCurrency } from '@/lib/valuation';

export const ITEM_FORM_CONDITIONS = ['Mint', 'Near Mint', 'Very Good', 'Good', 'Fair', 'Poor'] as const;
export const ITEM_FORM_CURRENCIES = ['USD', 'EUR', 'TRY', 'GBP', 'JPY', 'CHF'] as const;

export const ITEM_FORM_HIDDEN_CUSTOM_KEYS = new Set([
  'purchaseDate',
  'purchasePrice',
  'purchaseCurrency',
  'currentValue',
  'isFirstEdition',
  'condition',
  'notes',
]);

export interface ItemFormValues {
  title: string;
  description?: string;
  condition: string;
  location?: string;
  tags?: string;
  customFields: Record<string, unknown>;
  purchaseDate?: string;
  purchasePrice?: number;
  purchaseCurrency: string;
  purchaseLocation?: string;
  exchangeRate?: number;
  currentValue?: number;
  currentValueCurrency: string;
  targetYear: number;
  targetValue?: number;
  notes?: string;
  libraryId?: string;
  quantity?: number;
  eurRate?: number;
  usdRate?: number;
  gbpRate?: number;
}

export interface HistoricalPurchaseRates {
  gbpRate?: number;
  usdRate?: number;
  eurRate?: number;
}

export function itemToFormValues(
  item: CollectionItem,
  fields: CategoryField[],
): ItemFormValues {
  const customFieldValues: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = item.customFields[field.key];
    if (field.type === 'boolean') {
      customFieldValues[field.key] = !!raw;
    } else if (field.type === 'multi-select' || field.type === 'tags') {
      customFieldValues[field.key] = Array.isArray(raw) ? raw.join(', ') : (raw ?? '');
    } else {
      customFieldValues[field.key] = raw ?? '';
    }
  }

  const equivalents = item.purchaseInfo.currencyEquivalents ?? [];
  const eurEq = equivalents.find((entry) => entry.currency === 'EUR');
  const usdEq = equivalents.find((entry) => entry.currency === 'USD');
  const gbpEq = equivalents.find((entry) => entry.currency === 'GBP');

  return {
    title: item.title,
    description: item.description,
    condition: item.condition,
    location: item.location ?? '',
    tags: item.tags.join(', '),
    customFields: customFieldValues,
    purchaseDate: item.purchaseInfo.purchasedAt ? item.purchaseInfo.purchasedAt.slice(0, 10) : '',
    purchasePrice: item.purchaseInfo.purchasePrice,
    purchaseCurrency: item.purchaseInfo.purchaseCurrency,
    purchaseLocation: item.purchaseInfo.purchaseLocation ?? '',
    exchangeRate: item.purchaseInfo.exchangeRateAtPurchase,
    currentValue: item.valuationInfo.currentEstimatedValue,
    currentValueCurrency: getItemCurrentValueCurrency(item),
    targetYear: item.valuationInfo.targetYearProjection ?? 2030,
    targetValue: item.valuationInfo.targetEstimatedValue,
    notes: item.notes,
    libraryId: item.libraryId ?? '',
    quantity: item.quantity ?? 1,
    eurRate: eurEq?.rate,
    usdRate: usdEq?.rate,
    gbpRate: gbpEq?.rate,
  };
}

export function normalizeCustomFields(
  fields: CategoryField[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.key];
    if (field.type === 'tags' || field.type === 'multi-select') {
      normalized[field.key] =
        typeof value === 'string'
          ? value.split(',').map((entry) => entry.trim()).filter(Boolean)
          : value;
    } else {
      normalized[field.key] = value;
    }
  }
  return normalized;
}

export function buildPurchaseRatesMap(values: Pick<ItemFormValues, 'gbpRate' | 'usdRate' | 'eurRate'>): Record<string, number> {
  return {
    TRY: 1,
    GBP: Number(values.gbpRate) || 0,
    USD: Number(values.usdRate) || 0,
    EUR: Number(values.eurRate) || 0,
  };
}

function getAmountInTry(purchaseAmount: number, purchaseCurrency: string, ratesMap: Record<string, number>): number {
  if (purchaseAmount <= 0) return 0;
  if (purchaseCurrency === 'TRY') return purchaseAmount;
  const tryRate = ratesMap[purchaseCurrency] || 0;
  if (tryRate <= 0) return 0;
  return purchaseAmount * tryRate;
}

export function buildCurrencyEquivalents(
  purchaseAmount: number,
  purchaseCurrency: string,
  ratesMap: Record<string, number>,
): CurrencyEquivalent[] {
  const amountInTry = getAmountInTry(purchaseAmount, purchaseCurrency, ratesMap);
  if (amountInTry <= 0) return [];

  const equivalents: CurrencyEquivalent[] = [];

  for (const currency of ['EUR', 'USD', 'GBP'] as const) {
    const rate = ratesMap[currency];
    if (!rate || rate <= 0) continue;
    equivalents.push({
      currency,
      rate,
      value: amountInTry / rate,
    });
  }

  return equivalents;
}

export function getEquivalentForDisplay(
  purchaseAmount: number,
  purchaseCurrency: string,
  targetCurrency: 'GBP' | 'USD' | 'EUR',
  ratesMap: Record<string, number>,
): number | null {
  const targetRate = ratesMap[targetCurrency];
  if (!targetRate || targetRate <= 0) return null;
  const amountInTry = getAmountInTry(purchaseAmount, purchaseCurrency, ratesMap);
  if (amountInTry <= 0) return null;
  return amountInTry / targetRate;
}

export async function getHistoricalPurchaseRates(date: string): Promise<HistoricalPurchaseRates | null> {
  if (!date) return null;

  const rates = await currencyService.getHistoricalRates(date, 'TRY');
  if (!rates) return null;

  return {
    gbpRate: rates.GBP ? Number((1 / rates.GBP).toFixed(4)) : undefined,
    usdRate: rates.USD ? Number((1 / rates.USD).toFixed(4)) : undefined,
    eurRate: rates.EUR ? Number((1 / rates.EUR).toFixed(4)) : undefined,
  };
}

export function getPurchaseExchangeRateToUsd(
  purchaseCurrency: string,
  ratesMap: Record<string, number>,
): number {
  if (purchaseCurrency === 'USD') return 1;

  const usdTryRate = ratesMap.USD;
  if (usdTryRate > 0) {
    if (purchaseCurrency === 'TRY') {
      return Number((1 / usdTryRate).toFixed(6));
    }

    const purchaseTryRate = ratesMap[purchaseCurrency];
    if (purchaseTryRate > 0) {
      return Number((purchaseTryRate / usdTryRate).toFixed(6));
    }
  }

  return currencyService.getRate(purchaseCurrency, 'USD');
}

export function resolveCurrentValuationInput(
  values: Pick<ItemFormValues, 'currentValue' | 'currentValueCurrency' | 'purchaseCurrency'>,
  purchaseAmount: number,
  existingItem?: CollectionItem,
) {
  const hasExplicitCurrentValue =
    values.currentValue !== undefined
    && values.currentValue !== null
    && String(values.currentValue).trim() !== '';

  const currentEstimatedValue = hasExplicitCurrentValue
    ? Number(values.currentValue) || 0
    : existingItem?.valuationInfo.currentEstimatedValue ?? purchaseAmount;

  const explicitCurrency = typeof values.currentValueCurrency === 'string'
    ? values.currentValueCurrency.trim()
    : '';

  const currentValueCurrency = hasExplicitCurrentValue
    ? explicitCurrency || existingItem?.valuationInfo.currentValueCurrency || values.purchaseCurrency
    : existingItem?.valuationInfo.currentValueCurrency || values.purchaseCurrency;

  return {
    currentEstimatedValue,
    currentValueCurrency,
    currentExchangeRate: currencyService.getRate(currentValueCurrency, 'USD'),
  };
}

function isBase64Image(image: string): boolean {
  return image.startsWith('data:image/');
}

function isFirebaseStorageUrl(image: string): boolean {
  return image.includes('firebasestorage.googleapis.com');
}

export async function persistItemImages(
  userId: string | null | undefined,
  images: string[],
  previousImages: string[] = [],
): Promise<string[]> {
  const finalImages = await Promise.all(images.map(async (image) => {
    if (!isBase64Image(image)) return image;
    if (!userId || !storageService.isAvailable()) return image;
    return storageService.uploadBase64(userId, image, 'items');
  }));

  if (userId && storageService.isAvailable()) {
    const removedImages = previousImages.filter(
      (image) => isFirebaseStorageUrl(image) && !finalImages.includes(image),
    );
    await Promise.allSettled(removedImages.map((image) => storageService.deleteImage(image)));
  }

  return finalImages;
}
