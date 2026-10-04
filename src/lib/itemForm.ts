import type {
  Category,
  CategoryField,
  CollectionItem,
  CurrencyEquivalent,
  ItemSourceMetadata,
  ValueHistoryEntry,
} from '@/types';
import type { ItemDialogPrefill } from '@/store/collectionStore.types';
import { currencyService } from '@/services/currencyService';
import { storageService } from '@/services/storageService';
import { getItemCurrentValueCurrency } from '@/lib/valuation';
import { todayISO } from '@/lib/utils';
import { t } from '@/i18n';

/** Default (category-agnostic) scale. Category-aware scales live in `@/lib/conditionScales`. */
export const ITEM_FORM_CONDITIONS = ['Mint', 'Near Mint', 'Very Good', 'Good', 'Fair', 'Poor'] as const;
export const ITEM_FORM_CURRENCIES = ['USD', 'EUR', 'TRY', 'GBP', 'JPY', 'CHF'] as const;

export const ITEM_FORM_BUILT_IN_CUSTOM_KEYS = new Set([
  'title',
  'condition',
  'quantity',
  'purchaseDate',
  'purchasePrice',
  'purchaseCurrency',
  'currentValue',
  'estimatedValue',
  'isFirstEdition',
  'firstEdition',
  'notes',
]);

export const ITEM_FORM_HIDDEN_CUSTOM_KEYS = new Set([
  ...ITEM_FORM_BUILT_IN_CUSTOM_KEYS,
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
  /** YYYY-MM-DD the current value was assessed (defaults to today on save). */
  valuedAt?: string;
  /** Where the valuation came from (appraisal, auction result, price guide…). */
  valuationSource?: string;
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
    valuedAt: item.valuationInfo.valuedAt ?? '',
    valuationSource: item.valuationInfo.valuationSource ?? '',
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

export const DEFAULT_TARGET_YEAR = 2030;

/** Blank form values for a new item, optionally seeded (e.g. from a wishlist entry). */
export function buildEmptyFormValues(
  fields: CategoryField[],
  prefill?: ItemDialogPrefill | null,
): ItemFormValues {
  const customDefaults: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.defaultValue !== undefined) {
      customDefaults[field.key] = field.defaultValue;
    } else if (field.type === 'boolean') {
      customDefaults[field.key] = false;
    } else {
      customDefaults[field.key] = '';
    }
  }

  return {
    title: prefill?.title ?? '',
    description: prefill?.description ?? '',
    condition: '',
    location: '',
    tags: prefill?.tags?.join(', ') ?? '',
    customFields: customDefaults,
    purchaseDate: prefill?.purchaseDate ? prefill.purchaseDate.slice(0, 10) : '',
    purchasePrice: prefill?.purchasePrice,
    purchaseCurrency: prefill?.purchaseCurrency || 'TRY',
    purchaseLocation: prefill?.purchasePlace ?? '',
    exchangeRate: undefined,
    currentValue: undefined,
    currentValueCurrency: '',
    valuedAt: '',
    valuationSource: '',
    targetYear: DEFAULT_TARGET_YEAR,
    targetValue: undefined,
    notes: prefill?.notes ?? '',
    libraryId: '',
    quantity: 1,
    eurRate: undefined,
    usdRate: undefined,
    gbpRate: undefined,
  };
}

/**
 * Distinct storage locations already in use, plus their parent paths, so
 * "Study / Cabinet A / Shelf 2" also suggests "Study" and "Study / Cabinet A".
 */
export function getLocationSuggestions(items: Pick<CollectionItem, 'location'>[]): string[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    const raw = item.location?.trim();
    if (!raw) continue;
    const parts = raw.split('/').map((part) => part.trim()).filter(Boolean);
    for (let depth = 1; depth <= parts.length; depth += 1) {
      const path = parts.slice(0, depth).join(' / ');
      const key = path.toLocaleLowerCase();
      if (!seen.has(key)) seen.set(key, path);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export function normalizeCustomFields(
  fields: CategoryField[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const field of fields) {
    if (ITEM_FORM_BUILT_IN_CUSTOM_KEYS.has(field.key)) continue;
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

export function normalizeItemCustomFields(
  customFields: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const normalized = { ...(customFields ?? {}) };
  for (const key of ITEM_FORM_BUILT_IN_CUSTOM_KEYS) {
    delete normalized[key];
  }
  return normalized;
}

export function getMissingItemFormFields(
  fields: CategoryField[],
  values: Pick<ItemFormValues, 'title' | 'condition' | 'customFields'>,
): string[] {
  const missing: string[] = [];
  if (!values.title?.trim()) missing.push(t('itemForm.field.title'));
  if (!values.condition?.trim()) missing.push(t('itemForm.field.condition'));

  for (const field of fields) {
    if (!field.required || ITEM_FORM_BUILT_IN_CUSTOM_KEYS.has(field.key)) continue;
    const val = values.customFields[field.key];
    const empty =
      val === undefined ||
      val === null ||
      val === '' ||
      (typeof val === 'string' && !val.trim());
    if (empty) missing.push(field.label);
  }

  return missing;
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

/**
 * Value history after saving. A changed current value (or currency) adds a
 * point dated `valuedAt` (default today); re-valuing on the same date replaces
 * that day's point instead of stacking duplicates.
 */
export function buildNextValueHistory(
  existingItem: CollectionItem | undefined,
  next: { value: number; currency: string; valuedAt?: string; source?: string },
): ValueHistoryEntry[] {
  const date = next.valuedAt?.slice(0, 10) || todayISO();
  const point: ValueHistoryEntry = {
    date,
    value: next.value,
    currency: next.currency,
    ...(next.source ? { source: next.source } : {}),
  };

  if (!existingItem) {
    return [point];
  }

  const history = existingItem.valuationInfo.valueHistory ?? [];
  const previous = existingItem.valuationInfo;
  const changed = previous.currentEstimatedValue !== next.value
    || (previous.currentValueCurrency || '') !== next.currency;
  if (!changed || next.value <= 0) return history;

  return [...history.filter((entry) => entry.date !== date), point]
    .sort((a, b) => a.date.localeCompare(b.date));
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

export interface BuildItemFormSubmissionArgs {
  category: Category;
  fields: CategoryField[];
  data: ItemFormValues;
  itemImages: string[];
  coverIndex: number;
  currentUserId: string | null;
  existingItem?: CollectionItem;
  sourceMetadata?: ItemSourceMetadata;
}

export async function buildItemFormSubmission({
  category,
  fields,
  data,
  itemImages,
  coverIndex,
  currentUserId,
  existingItem,
  sourceMetadata,
}: BuildItemFormSubmissionArgs): Promise<Omit<CollectionItem, 'id' | 'createdAt' | 'updatedAt'>> {
  const customFields = normalizeCustomFields(fields, data.customFields);
  const tags = data.tags
    ? data.tags.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const now = new Date().toISOString();
  const purchaseDate = data.purchaseDate || now;
  const orderedImages = coverIndex === 0
    ? itemImages
    : [itemImages[coverIndex], ...itemImages.filter((_, index) => index !== coverIndex)];
  const finalImages = await persistItemImages(
    currentUserId,
    orderedImages.filter(Boolean),
    existingItem?.images ?? [],
  );
  const purchaseAmt = Number(data.purchasePrice) || 0;
  const ratesMap = buildPurchaseRatesMap(data);
  const exchangeRate = getPurchaseExchangeRateToUsd(data.purchaseCurrency, ratesMap);
  const currencyEquivalents = buildCurrencyEquivalents(
    purchaseAmt,
    data.purchaseCurrency,
    ratesMap,
  );
  const resolvedCurrentValuation = resolveCurrentValuationInput(
    data,
    purchaseAmt,
    existingItem,
  );
  const valuationSource = data.valuationSource?.trim() || undefined;
  const valueChanged = !!existingItem && (
    existingItem.valuationInfo.currentEstimatedValue !== resolvedCurrentValuation.currentEstimatedValue
    || (existingItem.valuationInfo.currentValueCurrency || '') !== resolvedCurrentValuation.currentValueCurrency
  );
  let valuedAt = data.valuedAt?.slice(0, 10) || undefined;
  // A new value with an untouched (stale) "valued on" date means "valued today".
  if (valueChanged && (!valuedAt || valuedAt === existingItem?.valuationInfo.valuedAt)) {
    valuedAt = todayISO();
  }
  const valueHistory = buildNextValueHistory(existingItem, {
    value: resolvedCurrentValuation.currentEstimatedValue,
    currency: resolvedCurrentValuation.currentValueCurrency,
    valuedAt,
    source: valuationSource,
  });

  return {
    categoryId: category.id,
    libraryId: data.libraryId || undefined,
    title: data.title,
    description: data.description ?? '',
    customFields,
    notes: data.notes ?? '',
    tags,
    images: finalImages,
    quantity: Number(data.quantity) || 1,
    purchaseInfo: {
      purchasedAt: purchaseDate,
      purchasePrice: purchaseAmt,
      purchaseCurrency: data.purchaseCurrency,
      exchangeRateAtPurchase: exchangeRate,
      purchaseLocation: data.purchaseLocation,
      currencyEquivalents,
    },
    valuationInfo: {
      currentEstimatedValue: resolvedCurrentValuation.currentEstimatedValue,
      currentValueCurrency: resolvedCurrentValuation.currentValueCurrency,
      currentExchangeRate: resolvedCurrentValuation.currentExchangeRate,
      targetYearProjection: Number(data.targetYear) || undefined,
      targetEstimatedValue: data.targetValue ? Number(data.targetValue) || 0 : undefined,
      valuedAt,
      valuationSource,
      valueHistory,
    },
    contributorId: existingItem?.contributorId ?? currentUserId ?? 'offline',
    condition: data.condition,
    location: data.location || undefined,
    isRead: existingItem?.isRead ?? false,
    isFavorite: existingItem?.isFavorite ?? false,
    maintenanceLog: existingItem?.maintenanceLog ?? [],
    lendingHistory: existingItem?.lendingHistory ?? [],
    sourceMetadata: sourceMetadata ?? existingItem?.sourceMetadata,
    documents: existingItem?.documents ?? [],
    lastMutationId: existingItem?.lastMutationId,
    lastSyncedAt: existingItem?.lastSyncedAt,
  };
}
