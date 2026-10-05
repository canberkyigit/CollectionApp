import { getItemCurrentValue, getItemPurchaseValue } from '@/lib/valuation';
import type { Category, CategoryField, CollectionItem } from '@/types';

export interface ReportFilters {
  categoryId: string; // 'all' or a category id
  libraryId: string; // 'all' or a library id
  minValue: number | null; // in display currency
  includeArchived: boolean;
}

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  categoryId: 'all',
  libraryId: 'all',
  minValue: null,
  includeArchived: false,
};

export interface ReportCategorySummary {
  categoryId: string;
  name: string;
  count: number;
  purchaseTotal: number;
  currentTotal: number;
}

export interface ReportTotals {
  count: number;
  purchaseTotal: number;
  currentTotal: number;
  byCategory: ReportCategorySummary[];
}

export function filterReportItems(
  items: CollectionItem[],
  filters: ReportFilters,
  displayCurrency: string,
): CollectionItem[] {
  return items.filter((item) => {
    if (!filters.includeArchived && item.isArchived) return false;
    if (filters.categoryId !== 'all' && item.categoryId !== filters.categoryId) return false;
    if (filters.libraryId !== 'all' && item.libraryId !== filters.libraryId) return false;
    if (filters.minValue !== null && getItemCurrentValue(item, displayCurrency) < filters.minValue) return false;
    return true;
  });
}

export function buildReportTotals(
  items: CollectionItem[],
  categories: Category[],
  displayCurrency: string,
): ReportTotals {
  const order = new Map(categories.map((category, index) => [category.id, category.order ?? index]));
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const byCategory = new Map<string, ReportCategorySummary>();
  let purchaseTotal = 0;
  let currentTotal = 0;

  for (const item of items) {
    const purchase = getItemPurchaseValue(item, displayCurrency);
    const current = getItemCurrentValue(item, displayCurrency);
    purchaseTotal += purchase;
    currentTotal += current;
    const entry = byCategory.get(item.categoryId) ?? {
      categoryId: item.categoryId,
      name: names.get(item.categoryId) ?? item.categoryId,
      count: 0,
      purchaseTotal: 0,
      currentTotal: 0,
    };
    entry.count += 1;
    entry.purchaseTotal += purchase;
    entry.currentTotal += current;
    byCategory.set(item.categoryId, entry);
  }

  return {
    count: items.length,
    purchaseTotal,
    currentTotal,
    byCategory: [...byCategory.values()].sort(
      (left, right) => (order.get(left.categoryId) ?? 999) - (order.get(right.categoryId) ?? 999),
    ),
  };
}

const IDENTIFIER_PATTERN = /serial|seri ?no|seri numara|catalog|katalog|isbn|barcode|barkod|\bsku\b|inventory|envanter|reference|referans|certificate|sertifika|matrix|\bupc\b|\bean\b|cat\.? ?no/i;

function hasValue(value: unknown): boolean {
  if (value == null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Custom fields that look like serial / catalogue / ISBN numbers (shown in mono on the report). */
export function getIdentifierFields(fields: CategoryField[]): CategoryField[] {
  return fields.filter((field) => field.type !== 'image' && (IDENTIFIER_PATTERN.test(field.key) || IDENTIFIER_PATTERN.test(field.label)));
}

const SKIPPED_KEYS = new Set(['title', 'notes', 'condition', 'quantity', 'description', 'location']);

/** Up to `limit` filled-in descriptive custom fields, excluding identifiers and long text. */
export function getKeyFields(item: CollectionItem, fields: CategoryField[], limit = 6): CategoryField[] {
  const identifiers = new Set(getIdentifierFields(fields).map((field) => field.key));
  return [...fields]
    .sort((left, right) => left.order - right.order)
    .filter((field) => (
      !SKIPPED_KEYS.has(field.key)
      && !identifiers.has(field.key)
      && field.type !== 'image'
      && field.type !== 'rich-notes'
      && field.type !== 'textarea'
      && hasValue(item.customFields[field.key])
    ))
    .slice(0, limit);
}

/** Date of the latest valuation: newest value-history entry, else the purchase date. */
export function getLastValuationDate(item: CollectionItem): string | undefined {
  const history = item.valuationInfo.valueHistory ?? [];
  const latest = history.reduce<string | undefined>(
    (max, entry) => (!max || entry.date > max ? entry.date : max),
    undefined,
  );
  return latest ?? item.purchaseInfo.purchasedAt;
}

export function filledIdentifierFields(item: CollectionItem, fields: CategoryField[]): CategoryField[] {
  return getIdentifierFields(fields).filter((field) => hasValue(item.customFields[field.key]));
}
