import type { Category, CollectionItem } from '@/types';
import type { FilterState } from '@/components/shared';
import { getItemCurrentValue, getItemPurchaseValue, getItemsCurrentValue } from '@/lib/valuation';

export interface FavoritesFilterMeta {
  maxPrice: number;
  maxValue: number;
  tags: string[];
}

export interface FavoritesStats {
  count: number;
  totalValue: number;
  categories: number;
}

export type FavoritesSortKey = 'title' | 'createdAt' | 'category';

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
      return { variant: 'secondary' as const, className: '' };
  }
}

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

  favorites.forEach((item) => {
    maxPrice = Math.max(maxPrice, getItemPurchaseValue(item, displayCurrency));
    maxValue = Math.max(maxValue, getItemCurrentValue(item, displayCurrency));
    item.tags.forEach((tag) => tagSet.add(tag));
  });

  return {
    maxPrice: Math.ceil(maxPrice),
    maxValue: Math.ceil(maxValue),
    tags: [...tagSet].sort(),
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
    const query = search.toLowerCase();
    list = list.filter(
      (item) => item.title.toLowerCase().includes(query) || item.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
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
        comparison = left.title.localeCompare(right.title);
        break;
      case 'createdAt':
        comparison = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        break;
      case 'category': {
        const leftCategory = getCategoryById(left.categoryId)?.name ?? '';
        const rightCategory = getCategoryById(right.categoryId)?.name ?? '';
        comparison = leftCategory.localeCompare(rightCategory);
        break;
      }
    }
    return sortDir === 'asc' ? comparison : -comparison;
  });
}
