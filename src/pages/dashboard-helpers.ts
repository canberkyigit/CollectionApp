import type {
  ActivityLogEntry,
  Category,
  CollectionItem,
  Contributor,
  DashboardWidgetConfig,
  WishlistItem,
} from '@/types';
import { buildContributorSummaries } from '@/lib/contributors';
import { currencyService } from '@/services/currencyService';
import { getItemCurrentValueUSD } from '@/lib/valuation';

export interface DashboardCategoryStat {
  categoryId: string;
  name: string;
  count: number;
  totalValue: number;
}

export interface DashboardSummary {
  totalValue: number;
  totalPurchasePrice: number;
  itemsWithPurchase: CollectionItem[];
  valueTrend: number | null;
}

export function getFilteredDashboardItems(items: CollectionItem[], selectedLibrary: string) {
  const activeItems = items.filter((item) => !item.isArchived);
  return selectedLibrary === 'all'
    ? activeItems
    : activeItems.filter((item) => item.libraryId === selectedLibrary);
}

export function getDashboardSummary(filteredItems: CollectionItem[]): DashboardSummary {
  const totalValue = filteredItems.reduce(
    (sum, item) => sum + getItemCurrentValueUSD(item),
    0,
  );

  const totalPurchasePrice = filteredItems.reduce(
    (sum, item) => sum + currencyService.convertToUSD(
      item.purchaseInfo.purchasePrice,
      item.purchaseInfo.purchaseCurrency,
    ),
    0,
  );

  const itemsWithPurchase = filteredItems.filter((item) => item.purchaseInfo.purchasePrice > 0);
  const valueTrend = totalPurchasePrice === 0
    ? null
    : ((totalValue - totalPurchasePrice) / totalPurchasePrice) * 100;

  return { totalValue, totalPurchasePrice, itemsWithPurchase, valueTrend };
}

export function getDashboardCategoryStats(categories: Category[], items: CollectionItem[]): DashboardCategoryStat[] {
  const activeItems = items.filter((item) => !item.isArchived);

  return categories
    .map((category) => {
      const categoryItems = activeItems.filter((item) => item.categoryId === category.id);
      const totalValue = categoryItems.reduce(
        (sum, item) => sum + getItemCurrentValueUSD(item),
        0,
      );

      return {
        categoryId: category.id,
        name: category.name,
        count: categoryItems.length,
        totalValue,
      };
    })
    .filter((stat) => stat.count > 0);
}

export function getRecentDashboardItems(items: CollectionItem[], limit = 6) {
  return [...items]
    .filter((item) => !item.isArchived)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);
}

export function getFavoriteDashboardItems(items: CollectionItem[]) {
  return items.filter((item) => item.isFavorite && !item.isArchived);
}

export function getDashboardValueOverTime(items: CollectionItem[]) {
  const dateMap = new Map<string, number>();

  items
    .filter((item) => !item.isArchived)
    .forEach((item) => {
      item.valuationInfo.valueHistory.forEach((entry) => {
        const key = entry.date.slice(0, 7);
        dateMap.set(
          key,
          (dateMap.get(key) || 0) + currencyService.convertToUSD(entry.value, entry.currency),
        );
      });
    });

  return Array.from(dateMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({ date, value: Math.round(value) }));
}

export function getDashboardMonthlyAcquisitions(items: CollectionItem[]) {
  const monthMap = new Map<string, { count: number; value: number }>();

  items
    .filter((item) => !item.isArchived)
    .forEach((item) => {
      const purchaseDate = new Date(item.purchaseInfo.purchasedAt);
      const key = `${purchaseDate.getFullYear()}-${String(purchaseDate.getMonth() + 1).padStart(2, '0')}`;
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

export function getTopDashboardContributors(contributors: Contributor[], items: CollectionItem[], limit = 5) {
  return buildContributorSummaries(contributors, items)
    .sort((left, right) => right.derivedTotalContributionValue - left.derivedTotalContributionValue)
    .slice(0, limit);
}

export function getVisibleDashboardWidgets(dashboardWidgets: DashboardWidgetConfig[]) {
  return [...dashboardWidgets]
    .filter((widget) => widget.visible)
    .sort((left, right) => left.order - right.order);
}

export function getWishlistPreviewItems(wishlist: WishlistItem[], limit = 4) {
  return wishlist.filter((item) => !item.isAcquired).slice(0, limit);
}

export function getWishlistPendingCount(wishlist: WishlistItem[]) {
  return wishlist.filter((item) => !item.isAcquired).length;
}

export function getRecentActivityPreview(activityLog: ActivityLogEntry[], limit = 5) {
  return activityLog.slice(0, limit);
}
