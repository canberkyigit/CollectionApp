import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  Package,
  Plus,
  Layers,
  DollarSign,
  LayoutGrid,
  List,
  ChevronRight,
  ArrowUpDown,
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatCurrency, formatNumber, formatRelativeDate } from '@/lib/utils';
import { useCollectionStore } from '@/store/useCollectionStore';
import { useAuthStore } from '@/store/useAuthStore';
import { canManageCatalog } from '@/lib/permissions';
import { getItemsCurrentValue } from '@/lib/valuation';
import { libraryMatchesCategory } from '@/lib/libraries';

type CatSort = 'order' | 'name' | 'count' | 'value';
const CAT_SORT_OPTIONS: { label: string; value: CatSort }[] = [
  { label: 'Custom Order', value: 'order' },
  { label: 'Name', value: 'name' },
  { label: 'Item Count', value: 'count' },
  { label: 'Total Value', value: 'value' },
];

export default function Collections() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { categories, items, contributors, libraries } = useCollectionStore();
  const isRemoteDataLoading = useCollectionStore((state) => state.isRemoteDataLoading);
  const ownerUserId = useCollectionStore((state) => state.ownerUserId);
  const user = useAuthStore((state) => state.user);
  const displayCurrency = useCollectionStore((s) => s.displayCurrency);
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
    return categories.map((cat) => {
      const catItems = activeItems.filter((i) => i.categoryId === cat.id);
      const totalValue = getItemsCurrentValue(catItems, displayCurrency);
      const lastUpdated = catItems.length > 0
        ? catItems.reduce((latest, item) =>
            new Date(item.updatedAt) > new Date(latest.updatedAt) ? item : latest,
          ).updatedAt
        : cat.updatedAt;
      const libraryCount = libraries.filter((library) => libraryMatchesCategory(library, cat.id)).length;

      return { category: cat, count: catItems.length, totalValue, lastUpdated, libraryCount };
    });
  }, [categories, activeItems, displayCurrency, libraries]);

  const categoryData = useMemo(() => {
    let data = allCategoryData;

    if (catSearch.trim()) {
      const q = catSearch.toLowerCase();
      data = data.filter(
        (d) =>
          d.category.name.toLowerCase().includes(q) ||
          d.category.description.toLowerCase().includes(q),
      );
    }

    if (contributorFilter) {
      data = data.filter((entry) => entry.count > 0);
    }

    const sorted = [...data].sort((a, b) => {
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

    return sorted;
  }, [allCategoryData, catSearch, catSort, catSortDir, contributorFilter]);

  const totalValue = useMemo(
    () => getItemsCurrentValue(activeItems, displayCurrency),
    [activeItems, displayCurrency],
  );
  const shouldShowLoadingState =
    Boolean(ownerUserId) &&
    isRemoteDataLoading &&
    categories.length === 0 &&
    activeItems.length === 0;

  return (
    <PageTransition>
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      <PageHeader
        title="Collections"
        description={
          activeContributor
            ? `Browsing categories for ${activeContributor.name}`
            : 'Browse and manage your collection categories'
        }
      >
        <div className="flex items-center gap-2">
          {activeContributor && (
            <Button variant="outline" onClick={() => navigate('/collections')}>
              Clear Filter
            </Button>
          )}
          <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 px-2.5"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 px-2.5"
              onClick={() => setViewMode('list')}
            >
              <List className="size-4" />
            </Button>
          </div>
          {canCreateCategory && (
            <Button onClick={() => navigate('/admin/categories/new')}>
              <Plus className="size-4" />
              New Category
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
            <MotionItem variants={staggerItem}><StatCard
              title="Total Items"
              value={formatNumber(activeItems.length)}
              icon={Package}
              subtitle="across all categories"
            /></MotionItem>
            <MotionItem variants={staggerItem}><StatCard
              title="Categories"
              value={formatNumber(categories.length)}
              icon={Layers}
              subtitle="collection types"
            /></MotionItem>
            <MotionItem variants={staggerItem}><StatCard
              title="Total Value"
              value={formatCurrency(totalValue, displayCurrency)}
              icon={DollarSign}
              subtitle="estimated portfolio"
            /></MotionItem>
          </MotionGrid>

      {/* Search & Sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={catSearch}
          onChange={setCatSearch}
          placeholder="Search categories..."
          className="sm:w-72"
        />
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowUpDown className="mr-1.5 size-3.5" />
                {CAT_SORT_OPTIONS.find((o) => o.value === catSort)?.label ?? 'Sort'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {CAT_SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setCatSort(opt.value)}
                  className={cn(catSort === opt.value && 'bg-accent')}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setCatSortDir(catSortDir === 'asc' ? 'desc' : 'asc')}
          >
            {catSortDir === 'asc' ? <SortAsc className="size-3.5" /> : <SortDesc className="size-3.5" />}
          </Button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <MotionGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" variants={staggerContainer} initial="hidden" animate="visible">
          {categoryData.map(({ category, count, totalValue: catValue, lastUpdated, libraryCount }) => {
            const Icon = getCategoryIcon(category.icon);
            const categoryDescription = category.description?.trim() || 'A focused collection ready for new additions.';
            const averageValue = count > 0 ? catValue / count : 0;

            return (
              <MotionItem key={category.id} variants={staggerItem} className="h-full">
              <CategoryShowcaseCard
                title={category.name}
                description={categoryDescription}
                itemCount={count}
                libraryCount={libraryCount}
                totalValueLabel={formatCurrency(catValue, displayCurrency)}
                averageValueLabel={formatCurrency(averageValue, displayCurrency)}
                lastUpdatedLabel={formatRelativeDate(lastUpdated)}
                icon={Icon}
                onClick={() => navigate(`/collections/${category.slug}`)}
              />
              </MotionItem>
            );
          })}
        </MotionGrid>
      ) : (
        <Card>
          <div className="divide-y">
            {categoryData.map(({ category, count, totalValue: catValue, lastUpdated }) => {
              const Icon = getCategoryIcon(category.icon);

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => navigate(`/collections/${category.slug}`)}
                  className="group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 sm:gap-4 sm:px-5 sm:py-4"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                    <Icon className="size-5 text-primary" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold">{category.name}</h3>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {count} {count === 1 ? 'item' : 'items'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {category.description}
                    </p>
                  </div>

                  <div className="hidden shrink-0 items-center gap-8 sm:flex">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(catValue, displayCurrency)}</p>
                      <p className="text-xs text-muted-foreground">Total Value</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {formatRelativeDate(lastUpdated)}
                      </p>
                      <p className="text-xs text-muted-foreground">Last Updated</p>
                    </div>
                  </div>

                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                </button>
              );
            })}

            {categoryData.length === 0 && (
              <EmptyState
                icon={Package}
                eyebrow="Collections"
                title={activeContributor ? 'No shared collections yet' : 'No categories yet'}
                description={
                  activeContributor
                    ? `${activeContributor.name} does not have any items assigned yet. Add an item for this contributor or switch back to all collections.`
                    : 'Create your first category to start organizing your collection and grouping items into libraries.'
                }
                action={
                  canCreateCategory
                    ? {
                        label: 'Create Category',
                        onClick: () => navigate('/admin/categories/new'),
                      }
                    : undefined
                }
                secondaryAction={{
                  label: activeContributor ? 'View All Collections' : 'Go to Dashboard',
                  onClick: () => navigate(activeContributor ? '/collections' : '/dashboard'),
                }}
                hint={
                  activeContributor
                    ? 'Contributor filters only show categories that currently contain visible items for that person.'
                    : 'Once categories exist, you can add libraries under them and browse from the sidebar.'
                }
                className="mx-6 my-8"
              />
            )}
          </div>
        </Card>
      )}
        </>
      )}
    </div>
    </PageTransition>
  );
}
