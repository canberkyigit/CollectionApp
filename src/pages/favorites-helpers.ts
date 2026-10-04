import type { Category, CollectionItem } from '@/types';
import type { FilterState } from '@/components/shared';
import { getLocale } from '@/i18n';
import { getItemCurrentValue, getItemPurchaseValue, getItemsCurrentValue } from '@/lib/valuation';
import { itemMatchesSearch } from './collectionDetail-helpers';

export interface FavoritesFilterMeta {
  maxPrice: number;
  maxValue: number;
  tags: string[];
  conditions: string[];
}

export interface FavoritesStats {
  count: number;
  totalValue: number;
  categories: number;
}

export type FavoritesSortKey = 'title' | 'createdAt' | 'category';

/** `labelKey` is an i18n key (collections.sort.*). */
export const FAVORITES_SORT_OPTIONS: { labelKey: string; value: FavoritesSortKey }[] = [
  { labelKey: 'collections.sort.title', value: 'title' },
  { labelKey: 'collections.sort.createdAt', value: 'createdAt' },
  { labelKey: 'collections.sort.category', value: 'category' },
];

export function isFavoritesSortKey(value: string): value is FavoritesSortKey {
  return FAVORITES_SORT_OPTIONS.some((option) => option.value === value);
}

export { getConditionBadgeProps } from './collectionDetail-helpers';

export function getKeyFields(category: Category | undefined, item: CollectionItem) {
  if (!category) return [];

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

export function getFavoriteItems(items: CollectionItem[]): CollectionItem[] {
  return items.filter((item) => item.isFavorite && !item.isArchived);
}

export function getFavoriteFilterMeta(favorites: CollectionItem[], displayCurrency: string): FavoritesFilterMeta {
  let maxPrice = 0;
  let maxValue = 0;
  const tagSet = new Set<string>();
  const conditionSet = new Set<string>();

  favorites.forEach((item) => {
    if (item.condition) conditionSet.add(item.condition);
    maxPrice = Math.max(maxPrice, getItemPurchaseValue(item, displayCurrency));
    maxValue = Math.max(maxValue, getItemCurrentValue(item, displayCurrency));
    item.tags.forEach((tag) => tagSet.add(tag));
  });

  return {
    maxPrice: Math.ceil(maxPrice),
    maxValue: Math.ceil(maxValue),
    tags: [...tagSet].sort(),
    conditions: [...conditionSet],
  };
}

export function getFavoriteStats(favorites: CollectionItem[], displayCurrency: string): FavoritesStats {
  return {
    count: favorites.length,
    totalValue: getItemsCurrentValue(favorites, displayCurrency),
    categories: new Set(favorites.map((item) => item.categoryId)).size,
  };
}

interface FilterFavoriteItemsArgs {
  favorites: CollectionItem[];
  search: string;
  advFilters: FilterState;
  filterMeta: FavoritesFilterMeta;
  sortKey: FavoritesSortKey;
  sortDir: 'asc' | 'desc';
  displayCurrency: string;
  getCategoryById: (id: string) => Category | undefined;
}

export function filterFavoriteItems({
  favorites,
  search,
  advFilters,
  filterMeta,
  sortKey,
  sortDir,
  displayCurrency,
  getCategoryById,
}: FilterFavoriteItemsArgs): CollectionItem[] {
  let list = favorites;

  if (search.trim()) {
    list = list.filter((item) => itemMatchesSearch(item, search));
  }

  if (advFilters.conditions.length > 0) {
    list = list.filter((item) => advFilters.conditions.includes(item.condition));
  }

  if (advFilters.priceRange[0] > 0 || (advFilters.priceRange[1] > 0 && advFilters.priceRange[1] < filterMeta.maxPrice)) {
    list = list.filter((item) => {
      const purchaseValue = getItemPurchaseValue(item, displayCurrency);
      return purchaseValue >= advFilters.priceRange[0] && purchaseValue <= advFilters.priceRange[1];
    });
  }

  if (advFilters.valueRange[0] > 0 || (advFilters.valueRange[1] > 0 && advFilters.valueRange[1] < filterMeta.maxValue)) {
    list = list.filter((item) => {
      const currentValue = getItemCurrentValue(item, displayCurrency);
      return currentValue >= advFilters.valueRange[0] && currentValue <= advFilters.valueRange[1];
    });
  }

  if (advFilters.dateFrom) {
    const from = new Date(advFilters.dateFrom).getTime();
    list = list.filter((item) => new Date(item.createdAt).getTime() >= from);
  }

  if (advFilters.dateTo) {
    const to = new Date(advFilters.dateTo).getTime() + 86400000;
    list = list.filter((item) => new Date(item.createdAt).getTime() <= to);
  }

  if (advFilters.tags.length > 0) {
    list = list.filter((item) => advFilters.tags.some((tag) => item.tags.includes(tag)));
  }

  if (advFilters.hasImages === true) {
    list = list.filter((item) => item.images.length > 0);
  } else if (advFilters.hasImages === false) {
    list = list.filter((item) => item.images.length === 0);
  }

  return [...list].sort((left, right) => {
    let comparison = 0;
    switch (sortKey) {
      case 'title':
        comparison = left.title.localeCompare(right.title, getLocale());
        break;
      case 'createdAt':
        comparison = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        break;
      case 'category': {
        const leftCategory = getCategoryById(left.categoryId)?.name ?? '';
        const rightCategory = getCategoryById(right.categoryId)?.name ?? '';
        comparison = leftCategory.localeCompare(rightCategory, getLocale());
        break;
      }
    }
    return sortDir === 'asc' ? comparison : -comparison;
  });
}
