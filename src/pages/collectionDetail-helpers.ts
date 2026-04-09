import type { FilterState } from '@/components/shared';
import type { Category, CollectionItem, SortField } from '@/types';
import { getItemCurrentValue, getItemPurchaseValue } from '@/lib/valuation';

const CONDITION_ORDER: Record<string, number> = {
  Mint: 0,
  'Near Mint': 1,
  'Very Good': 2,
  Good: 3,
  Fair: 4,
  Poor: 5,
};

export const SORT_OPTIONS: { label: string; value: SortField }[] = [
  { label: 'Title', value: 'title' },
  { label: 'Date Added', value: 'createdAt' },
  { label: 'Last Updated', value: 'updatedAt' },
  { label: 'Condition', value: 'condition' },
  { label: 'Publisher', value: 'publisher' },
];

export interface CollectionFilterMeta {
  maxPrice: number;
  maxValue: number;
  tags: string[];
  currencies: string[];
}

export interface CollectionStats {
  count: number;
  totalValue: number;
  avgValue: number;
  highestValue: number;
}

export function getConditionBadgeProps(condition: string) {
  switch (condition) {
    case 'Mint':
      return {
        variant: 'outline' as const,
        className: 'border-emerald-500/40 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
      };
    case 'Near Mint':
      return {
        variant: 'outline' as const,
        className: 'border-green-500/40 bg-green-500/20 text-green-700 dark:text-green-400',
      };
    case 'Very Good':
      return {
        variant: 'outline' as const,
        className: 'border-teal-500/40 bg-teal-500/20 text-teal-700 dark:text-teal-400',
      };
    case 'Good':
      return {
        variant: 'outline' as const,
        className: 'border-blue-500/40 bg-blue-500/20 text-blue-700 dark:text-blue-400',
      };
    case 'Fair':
      return {
        variant: 'outline' as const,
        className: 'border-amber-500/40 bg-amber-500/20 text-amber-700 dark:text-amber-400',
      };
    case 'Poor':
      return {
        variant: 'outline' as const,
        className: 'border-red-500/40 bg-red-500/20 text-red-700 dark:text-red-400',
      };
    default:
      return { variant: 'secondary' as const };
  }
}

export function getKeyFields(category: Category, item: CollectionItem) {
  const skipKeys = new Set([
    'title',
    'condition',
    'purchasePrice',
    'purchaseCurrency',
    'currentValue',
    'estimatedValue',
    'purchaseDate',
    'notes',
  ]);

  return category.fields
    .filter((field) => !skipKeys.has(field.key) && item.customFields[field.key] != null && item.customFields[field.key] !== '')
    .slice(0, 2)
    .map((field) => ({ label: field.label, value: String(item.customFields[field.key]) }));
}

export function getCollectionItemValue(item: CollectionItem, displayCurrency: string) {
  return getItemCurrentValue(item, displayCurrency);
}

export function getCollectionItemPurchasePrice(item: CollectionItem, displayCurrency: string) {
  return getItemPurchaseValue(item, displayCurrency);
}

export function getCollectionFilterMeta(items: CollectionItem[], displayCurrency: string): CollectionFilterMeta {
  let maxPrice = 0;
  let maxValue = 0;
  const tagSet = new Set<string>();
  const currencySet = new Set<string>();

  items.forEach((item) => {
    const purchasePrice = getCollectionItemPurchasePrice(item, displayCurrency);
    const currentValue = getCollectionItemValue(item, displayCurrency);

    if (purchasePrice > maxPrice) maxPrice = purchasePrice;
    if (currentValue > maxValue) maxValue = currentValue;

    item.tags.forEach((tag) => tagSet.add(tag));
    if (item.purchaseInfo.purchaseCurrency) {
      currencySet.add(item.purchaseInfo.purchaseCurrency);
    }
  });

  return {
    maxPrice: Math.ceil(maxPrice),
    maxValue: Math.ceil(maxValue),
    tags: [...tagSet].sort(),
    currencies: [...currencySet].sort(),
  };
}

interface FilterCollectionItemsArgs {
  items: CollectionItem[];
  searchQuery: string;
  advFilters: FilterState;
  filterMeta: CollectionFilterMeta;
  sortField: SortField;
  sortOrder: 'asc' | 'desc';
  displayCurrency: string;
}

export function filterCollectionItems({
  items,
  searchQuery,
  advFilters,
  filterMeta,
  sortField,
  sortOrder,
  displayCurrency,
}: FilterCollectionItemsArgs) {
  let result = items;

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    result = result.filter((item) => {
      if (item.title.toLowerCase().includes(query)) return true;
      if (item.description.toLowerCase().includes(query)) return true;
      if (item.tags.some((tag) => tag.toLowerCase().includes(query))) return true;
      if (item.condition.toLowerCase().includes(query)) return true;
      if (item.notes && item.notes.toLowerCase().includes(query)) return true;

      return Object.values(item.customFields).some((value) => (
        value != null && String(value).toLowerCase().includes(query)
      ));
    });
  }

  if (advFilters.conditions.length > 0) {
    result = result.filter((item) => advFilters.conditions.includes(item.condition));
  }

  if (advFilters.priceRange[0] > 0 || (advFilters.priceRange[1] > 0 && advFilters.priceRange[1] < filterMeta.maxPrice)) {
    result = result.filter((item) => {
      const purchasePrice = getCollectionItemPurchasePrice(item, displayCurrency);
      return purchasePrice >= advFilters.priceRange[0] && purchasePrice <= advFilters.priceRange[1];
    });
  }

  if (advFilters.valueRange[0] > 0 || (advFilters.valueRange[1] > 0 && advFilters.valueRange[1] < filterMeta.maxValue)) {
    result = result.filter((item) => {
      const currentValue = getCollectionItemValue(item, displayCurrency);
      return currentValue >= advFilters.valueRange[0] && currentValue <= advFilters.valueRange[1];
    });
  }

  if (advFilters.dateFrom) {
    const from = new Date(advFilters.dateFrom).getTime();
    result = result.filter((item) => new Date(item.createdAt).getTime() >= from);
  }

  if (advFilters.dateTo) {
    const to = new Date(advFilters.dateTo).getTime() + 86400000;
    result = result.filter((item) => new Date(item.createdAt).getTime() <= to);
  }

  if (advFilters.tags.length > 0) {
    result = result.filter((item) => advFilters.tags.some((tag) => item.tags.includes(tag)));
  }

  if (advFilters.favoritesOnly) {
    result = result.filter((item) => item.isFavorite);
  }

  if (advFilters.hasImages === true) {
    result = result.filter((item) => item.images.length > 0);
  } else if (advFilters.hasImages === false) {
    result = result.filter((item) => item.images.length === 0);
  }

  if (advFilters.currencies.length > 0) {
    result = result.filter((item) => advFilters.currencies.includes(item.purchaseInfo.purchaseCurrency));
  }

  if (advFilters.readStatus === 'read') {
    result = result.filter((item) => item.isRead);
  } else if (advFilters.readStatus === 'unread') {
    result = result.filter((item) => !item.isRead);
  }

  for (const [key, selectedValues] of Object.entries(advFilters.customSelects)) {
    if (selectedValues.length > 0) {
      result = result.filter((item) => {
        const value = item.customFields[key];
        return typeof value === 'string' && selectedValues.includes(value);
      });
    }
  }

  for (const [key, value] of Object.entries(advFilters.customBooleans)) {
    if (value !== null) {
      result = result.filter((item) => {
        const fieldValue = item.customFields[key];
        return value ? !!fieldValue : !fieldValue;
      });
    }
  }

  return [...result].sort((left, right) => {
    let comparison = 0;

    switch (sortField) {
      case 'title':
        comparison = left.title.localeCompare(right.title);
        break;
      case 'createdAt':
        comparison = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        break;
      case 'updatedAt':
        comparison = new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
        break;
      case 'purchasePrice':
        comparison = getCollectionItemPurchasePrice(left, displayCurrency) - getCollectionItemPurchasePrice(right, displayCurrency);
        break;
      case 'currentValue':
        comparison = getCollectionItemValue(left, displayCurrency) - getCollectionItemValue(right, displayCurrency);
        break;
      case 'condition':
        comparison = (CONDITION_ORDER[left.condition] ?? 99) - (CONDITION_ORDER[right.condition] ?? 99);
        break;
      case 'publisher':
        comparison = String(left.customFields.publisher ?? '').localeCompare(String(right.customFields.publisher ?? ''));
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });
}

export function getCollectionStats(items: CollectionItem[], displayCurrency: string): CollectionStats {
  const totalValue = items.reduce(
    (sum, item) => sum + getCollectionItemValue(item, displayCurrency),
    0,
  );
  const avgValue = items.length > 0 ? totalValue / items.length : 0;
  const highestValue = items.reduce(
    (max, item) => Math.max(max, getCollectionItemValue(item, displayCurrency)),
    0,
  );

  return {
    count: items.length,
    totalValue,
    avgValue,
    highestValue,
  };
}
