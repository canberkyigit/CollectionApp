import { currencyService } from '@/services/currencyService';
import { getItemCurrentValueUSD } from '@/lib/valuation';
import type {
  Category,
  CollectionItem,
  Contributor,
} from '@/types';
import type { CollectionStoreBaseState } from '@/store/collectionStore.types';

type StateWithCategories = Pick<CollectionStoreBaseState, 'categories'>;
type StateWithItems = Pick<CollectionStoreBaseState, 'items'>;
type StateWithContributors = Pick<CollectionStoreBaseState, 'contributors'>;
type CollectionQueryState = CollectionStoreBaseState;

export function selectCategoryById(state: StateWithCategories, id: string) {
  return state.categories.find((category) => category.id === id);
}

export function selectCategoryBySlug(state: StateWithCategories, slug: string) {
  return state.categories.find((category) => category.slug === slug);
}

export function selectItemsByCategory(state: StateWithItems, categoryId: string) {
  return state.items.filter((item) => item.categoryId === categoryId && !item.isArchived);
}

export function selectItemById(state: StateWithItems, id: string) {
  return state.items.find((item) => item.id === id);
}

export function selectContributorById(state: StateWithContributors, id: string) {
  return state.contributors.find((contributor) => contributor.id === id);
}

export function selectFavoriteItems(state: StateWithItems) {
  return state.items.filter((item) => item.isFavorite && !item.isArchived);
}

export function selectLentItems(state: StateWithItems) {
  return state.items.filter(
    (item) => !item.isArchived && item.lendingHistory.some((record) => !record.actualReturnDate),
  );
}

export function selectArchivedItems(state: StateWithItems) {
  return state.items.filter((item) => item.isArchived);
}

export function selectTotalValue(state: StateWithItems) {
  return state.items
    .filter((item) => !item.isArchived)
    .reduce((sum, item) => sum + getItemCurrentValueUSD(item), 0);
}

export function selectCategoryStats(state: CollectionQueryState) {
  const activeItems = state.items.filter((item) => !item.isArchived);

  return state.categories
    .map((category) => {
      const categoryItems = activeItems.filter((item) => item.categoryId === category.id);
      const totalValue = categoryItems.reduce((sum, item) => sum + getItemCurrentValueUSD(item), 0);
      return {
        categoryId: category.id,
        name: category.name,
        count: categoryItems.length,
        totalValue,
      };
    })
    .filter((entry) => entry.count > 0);
}

export function selectRecentItems(state: StateWithItems, limit = 5) {
  return [...state.items]
    .filter((item) => !item.isArchived)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export function selectMostValuableItems(state: StateWithItems, limit = 5) {
  return [...state.items]
    .filter((item) => !item.isArchived)
    .sort((a, b) => getItemCurrentValueUSD(b) - getItemCurrentValueUSD(a))
    .slice(0, limit);
}

export function selectMonthlyAcquisitions(state: StateWithItems) {
  const monthMap = new Map<string, { count: number; value: number }>();

  state.items
    .filter((item) => !item.isArchived)
    .forEach((item) => {
      const date = new Date(item.purchaseInfo.purchasedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap.get(key) ?? { count: 0, value: 0 };

      existing.count += 1;
      existing.value += currencyService.convertToUSD(
        item.purchaseInfo.purchasePrice,
        item.purchaseInfo.purchaseCurrency,
      );

      monthMap.set(key, existing);
    });

  return Array.from(monthMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, data]) => ({ month, ...data }));
}

export function selectValueOverTime(state: StateWithItems) {
  const dateMap = new Map<string, number>();

  state.items
    .filter((item) => !item.isArchived)
    .forEach((item) => {
      item.valuationInfo.valueHistory.forEach((entry) => {
        const key = entry.date.slice(0, 7);
        dateMap.set(
          key,
          (dateMap.get(key) ?? 0) + currencyService.convertToUSD(entry.value, entry.currency),
        );
      });
    });

  return Array.from(dateMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({ date, value: Math.round(value) }));
}

export function hasRemoteSnapshotData(state: {
  categories: Category[];
  items: CollectionItem[];
  contributors: Contributor[];
  libraries: CollectionQueryState['libraries'];
  wishlist: CollectionQueryState['wishlist'];
  activityLog: CollectionQueryState['activityLog'];
  settings: unknown;
}) {
  return (
    state.categories.length > 0
    || state.items.length > 0
    || state.libraries.length > 0
    || state.wishlist.length > 0
    || state.activityLog.length > 0
    || state.contributors.length > 0
    || state.settings !== null
  );
}

export function selectIsColdLoading(state: Pick<CollectionStoreBaseState, 'ownerUserId' | 'isRemoteDataLoading'>, counts: number[]) {
  return Boolean(state.ownerUserId) && state.isRemoteDataLoading && counts.every((count) => count === 0);
}
