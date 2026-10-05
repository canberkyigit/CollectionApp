import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import {
  ArrowUpDown,
  ChevronRight,
  DollarSign,
  Layers,
  LayoutGrid,
  List,
  Package,
  Plus,
  SearchX,
  SortAsc,
  SortDesc,
} from 'lucide-react';

import { PageTransition, MotionGrid, MotionItem } from '@/components/shared/motion';
import { staggerContainer, staggerItem } from '@/components/shared/motion-variants';
import { getCategoryIcon } from '@/lib/icons';
import { CategoryShowcaseCard } from '@/components/collections/CategoryShowcaseCard';
import { PageHeader, StatCard, SearchBar, EmptyState, LoadingSkeleton } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/i18n';
import { cn, formatCurrency, formatCurrencyShort, formatNumber } from '@/lib/utils';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { matchesQuery } from '@/lib/search';
import { useCollectionStore } from '@/store/useCollectionStore';
import { useAuthStore } from '@/store/useAuthStore';
import { canManageCatalog } from '@/lib/permissions';
import { getItemCurrentValue, getItemsCurrentValue } from '@/lib/valuation';
import { libraryMatchesCategory } from '@/lib/libraries';
import type { CollectionItem } from '@/types';

type CatSort = 'order' | 'name' | 'count' | 'value';
const CAT_SORT_OPTIONS: { labelKey: string; value: CatSort }[] = [
  { labelKey: 'collections.sort.order', value: 'order' },
  { labelKey: 'collections.sort.name', value: 'name' },
  { labelKey: 'collections.sort.count', value: 'count' },
  { labelKey: 'collections.sort.value', value: 'value' },
];

const MAX_THUMBNAILS = 4;

/** Cover images for the mosaic: most valuable first, then most recently updated. */
function pickThumbnails(items: CollectionItem[], displayCurrency: string): string[] {
  return items
    .filter((item) => item.images.length > 0)
    .map((item) => ({ item, value: getItemCurrentValue(item, displayCurrency) }))
    .sort((left, right) => (
      right.value - left.value
      || new Date(right.item.updatedAt).getTime() - new Date(left.item.updatedAt).getTime()
    ))
    .slice(0, MAX_THUMBNAILS)
    .map(({ item }) => item.images[0]);
}

export default function Collections() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categories = useCollectionStore((state) => state.categories);
  const items = useCollectionStore((state) => state.items);
  const contributors = useCollectionStore((state) => state.contributors);
  const libraries = useCollectionStore((state) => state.libraries);
  const isRemoteDataLoading = useCollectionStore((state) => state.isRemoteDataLoading);
  const ownerUserId = useCollectionStore((state) => state.ownerUserId);
  const displayCurrency = useCollectionStore((state) => state.displayCurrency);
  const user = useAuthStore((state) => state.user);
  const canCreateCategory = canManageCatalog(user?.role ?? 'viewer');
  const contributorFilter = searchParams.get('contributor');
  const activeContributor = contributorFilter
    ? contributors.find((contributor) => contributor.id === contributorFilter)
    : null;
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [catSearch, setCatSearch] = useState('');
  const [catSort, setCatSort] = useState<CatSort>('order');
  const [catSortDir, setCatSortDir] = useState<'asc' | 'desc'>('asc');

  const activeItems = useMemo(() => {
    const visibleItems = items.filter((item) => !item.isArchived);
    if (!contributorFilter) return visibleItems;
    return visibleItems.filter((item) => item.contributorId === contributorFilter);
  }, [items, contributorFilter]);

  const allCategoryData = useMemo(() => {
    const itemsByCategory = new Map<string, CollectionItem[]>();
    for (const item of activeItems) {
      const bucket = itemsByCategory.get(item.categoryId) ?? [];
      bucket.push(item);
      itemsByCategory.set(item.categoryId, bucket);
    }

    return categories.map((category) => {
      const categoryItems = itemsByCategory.get(category.id) ?? [];
      const lastUpdated = categoryItems.reduce(
        (latest, item) => (new Date(item.updatedAt) > new Date(latest) ? item.updatedAt : latest),
        category.updatedAt,
      );

      const topItem = categoryItems.reduce<{ item: CollectionItem; value: number } | null>((best, item) => {
        const value = getItemCurrentValue(item, displayCurrency);
        return !best || value > best.value ? { item, value } : best;
      }, null);

      return {
        category,
        count: categoryItems.length,
        topItemTitle: topItem && topItem.value > 0 ? topItem.item.title : null,
        totalValue: getItemsCurrentValue(categoryItems, displayCurrency),
        lastUpdated,
        thumbnails: pickThumbnails(categoryItems, displayCurrency),
        libraryCount: libraries.filter((library) => libraryMatchesCategory(library, category.id)).length,
      };
    });
  }, [categories, activeItems, displayCurrency, libraries]);

  const categoryData = useMemo(() => {
    let data = allCategoryData;

    if (catSearch.trim()) {
      data = data.filter((entry) => matchesQuery(catSearch, entry.category.name, entry.category.description));
    }

    if (contributorFilter) {
      data = data.filter((entry) => entry.count > 0);
    }

    return [...data].sort((a, b) => {
      let cmp = 0;
      switch (catSort) {
        case 'order':
          cmp = (a.category.order ?? 0) - (b.category.order ?? 0);
          break;
        case 'name':
          cmp = a.category.name.localeCompare(b.category.name);
          break;
        case 'count':
          cmp = a.count - b.count;
          break;
        case 'value':
          cmp = a.totalValue - b.totalValue;
          break;
      }
      return catSortDir === 'asc' ? cmp : -cmp;
    });
  }, [allCategoryData, catSearch, catSort, catSortDir, contributorFilter]);

  const totalValue = useMemo(
    () => getItemsCurrentValue(activeItems, displayCurrency),
    [activeItems, displayCurrency],
  );
  const shouldShowLoadingState =
    Boolean(ownerUserId)
    && isRemoteDataLoading
    && categories.length === 0
    && activeItems.length === 0;

  const itemCountLabel = (count: number) => t('collections.itemCount', { count, formatted: formatNumber(count) });

  const renderEmptyState = () => {
    if (catSearch.trim() && allCategoryData.length > 0) {
      return (
        <EmptyState
          icon={SearchX}
          eyebrow={t('collections.eyebrow')}
          title={t('collections.noMatches.title')}
          description={t('collections.noMatches.description')}
          action={{ label: t('collections.clearSearch'), onClick: () => setCatSearch('') }}
          className="mx-6 my-8"
        />
      );
    }

    if (activeContributor) {
      return (
        <EmptyState
          icon={Package}
          eyebrow={t('collections.eyebrow')}
          title={t('collections.emptyContributor.title')}
          description={t('collections.emptyContributor.description', { name: activeContributor.name })}
          action={canCreateCategory
            ? { label: t('collections.createCategory'), onClick: () => navigate('/admin/categories/new') }
            : undefined}
          secondaryAction={{ label: t('collections.viewAll'), onClick: () => navigate('/collections') }}
          hint={t('collections.emptyContributor.hint')}
          className="mx-6 my-8"
        />
      );
    }

    return (
      <EmptyState
        icon={Package}
        eyebrow={t('collections.eyebrow')}
        title={t('collections.empty.title')}
        description={t('collections.empty.description')}
        action={canCreateCategory
          ? { label: t('collections.createCategory'), onClick: () => navigate('/admin/categories/new') }
          : undefined}
        secondaryAction={{ label: t('collections.goToDashboard'), onClick: () => navigate('/dashboard') }}
        hint={t('collections.empty.hint')}
        className="mx-6 my-8"
      />
    );
  };

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title={t('collections.title')}
          description={
            activeContributor
              ? t('collections.browsingFor', { name: activeContributor.name })
              : t('collections.description')
          }
        >
          <div className="flex items-center gap-2">
            {activeContributor && (
              <Button variant="outline" onClick={() => navigate('/collections')}>
                {t('collections.clearFilter')}
              </Button>
            )}
            <div className="flex items-center rounded-lg border bg-muted/30 p-0.5" role="group" aria-label={t('collections.view.label')}>
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-2.5 max-sm:h-9"
                aria-label={t('collections.view.grid')}
                aria-pressed={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-2.5 max-sm:h-9"
                aria-label={t('collections.view.list')}
                aria-pressed={viewMode === 'list'}
                onClick={() => setViewMode('list')}
              >
                <List className="size-4" />
              </Button>
            </div>
            {canCreateCategory && (
              <Button onClick={() => navigate('/admin/categories/new')}>
                <Plus className="size-4" />
                {t('collections.newCategory')}
              </Button>
            )}
          </div>
        </PageHeader>

        {shouldShowLoadingState ? (
          <div className="space-y-5">
            <LoadingSkeleton variant="card" count={3} className="lg:grid-cols-3" />
            <LoadingSkeleton variant="card" count={5} className="xl:grid-cols-4 2xl:grid-cols-5" />
          </div>
        ) : (
          <>
            <MotionGrid className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4" variants={staggerContainer} initial="hidden" animate="visible">
              <MotionItem variants={staggerItem}>
                <StatCard
                  title={t('collections.stats.totalItems')}
                  value={formatNumber(activeItems.length)}
                  icon={Package}
                  subtitle={t('collections.stats.totalItemsHint')}
                />
              </MotionItem>
              <MotionItem variants={staggerItem}>
                <StatCard
                  title={t('collections.stats.categories')}
                  value={formatNumber(categories.length)}
                  icon={Layers}
                  subtitle={t('collections.stats.categoriesHint')}
                />
              </MotionItem>
              <MotionItem variants={staggerItem} className="col-span-2 sm:col-span-1">
                <StatCard
                  title={t('collections.stats.portfolioValue')}
                  value={formatCurrency(totalValue, displayCurrency)}
                  icon={DollarSign}
                  subtitle={t('collections.stats.portfolioHint')}
                />
              </MotionItem>
            </MotionGrid>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SearchBar
                value={catSearch}
                onChange={setCatSearch}
                placeholder={t('collections.searchPlaceholder')}
                className="sm:w-72"
              />
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="max-sm:h-9">
                      <ArrowUpDown className="mr-1.5 size-3.5" />
                      {t(CAT_SORT_OPTIONS.find((option) => option.value === catSort)?.labelKey ?? 'collections.sort.label')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{t('collections.sort.label')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={catSort} onValueChange={(value) => setCatSort(value as CatSort)}>
                      {CAT_SORT_OPTIONS.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 sm:size-8"
                  aria-label={catSortDir === 'asc' ? t('collections.sort.ascending') : t('collections.sort.descending')}
                  title={catSortDir === 'asc' ? t('collections.sort.ascending') : t('collections.sort.descending')}
                  onClick={() => setCatSortDir(catSortDir === 'asc' ? 'desc' : 'asc')}
                >
                  {catSortDir === 'asc' ? <SortAsc className="size-3.5" /> : <SortDesc className="size-3.5" />}
                </Button>
              </div>
            </div>

            {viewMode === 'grid' && categoryData.length > 0 ? (
              <MotionGrid
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {categoryData.map(({ category, count, totalValue: categoryValue, lastUpdated, libraryCount, thumbnails, topItemTitle }) => (
                  <MotionItem key={category.id} variants={staggerItem} className="h-full">
                    <CategoryShowcaseCard
                      title={category.name}
                      description={category.description?.trim() || t('collections.card.defaultDescription')}
                      thumbnails={thumbnails}
                      itemCountLabel={itemCountLabel(count)}
                      secondaryStat={libraryCount > 0 || !topItemTitle
                        ? { label: t('collections.card.libraries'), value: libraryCount > 0 ? t('collections.card.spaceCount', { count: libraryCount, formatted: formatNumber(libraryCount) }) : '—' }
                        : { label: t('collections.card.topPiece'), value: topItemTitle, title: topItemTitle }}
                      totalValueLabel={formatCurrencyShort(categoryValue, displayCurrency)}
                      totalValueTitle={formatCurrency(categoryValue, displayCurrency)}
                      averageValueLabel={formatCurrencyShort(count > 0 ? categoryValue / count : 0, displayCurrency)}
                      averageValueTitle={formatCurrency(count > 0 ? categoryValue / count : 0, displayCurrency)}
                      lastUpdated={lastUpdated}
                      icon={getCategoryIcon(category.icon)}
                      to={`/collections/${category.slug}`}
                    />
                  </MotionItem>
                ))}
              </MotionGrid>
            ) : (
              <Card>
                <div className="divide-y">
                  {categoryData.map(({ category, count, totalValue: categoryValue, lastUpdated }) => {
                    const Icon = getCategoryIcon(category.icon);

                    return (
                      <Link
                        key={category.id}
                        to={`/collections/${category.slug}`}
                        className={cn(
                          'group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 sm:gap-4 sm:px-5 sm:py-4',
                          'first:rounded-t-2xl last:rounded-b-2xl focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                        )}
                      >
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                          <Icon className="size-5 text-primary" aria-hidden="true" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate font-semibold">{category.name}</h3>
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              {itemCountLabel(count)}
                            </Badge>
                          </div>
                          {category.description && (
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">
                              {category.description}
                            </p>
                          )}
                        </div>

                        <div className="hidden shrink-0 items-center gap-8 sm:flex">
                          <div className="text-right">
                            <p className="text-sm font-semibold">{formatCurrency(categoryValue, displayCurrency)}</p>
                            <p className="text-xs text-muted-foreground">{t('collections.list.totalValue')}</p>
                          </div>
                          <div className="text-right">
                            <RelativeTime date={lastUpdated} className="block text-sm text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">{t('collections.list.lastUpdated')}</p>
                          </div>
                        </div>

                        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" aria-hidden="true" />
                      </Link>
                    );
                  })}

                  {categoryData.length === 0 && renderEmptyState()}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}
