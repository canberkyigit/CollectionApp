import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Package,
  Plus,
  Layers,
  DollarSign,
  ArrowRight,
  LayoutGrid,
  List,
  ChevronRight,
  ArrowUpDown,
  SortAsc,
  SortDesc,
} from 'lucide-react';
import { PageTransition, MotionGrid, MotionItem, staggerContainer, staggerItem } from '@/components/shared/motion';
import { getCategoryIcon } from '@/lib/icons';

import { PageHeader, StatCard, SearchBar } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatCurrency, formatNumber, formatRelativeDate } from '@/lib/utils';
import { currencyService } from '@/services/currencyService';
import { useCollectionStore } from '@/store/useCollectionStore';

type CatSort = 'order' | 'name' | 'count' | 'value';
const CAT_SORT_OPTIONS: { label: string; value: CatSort }[] = [
  { label: 'Custom Order', value: 'order' },
  { label: 'Name', value: 'name' },
  { label: 'Item Count', value: 'count' },
  { label: 'Total Value', value: 'value' },
];

export default function Collections() {
  const navigate = useNavigate();
  const { categories, items } = useCollectionStore();
  const displayCurrency = useCollectionStore((s) => s.displayCurrency);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [catSearch, setCatSearch] = useState('');
  const [catSort, setCatSort] = useState<CatSort>('order');
  const [catSortDir, setCatSortDir] = useState<'asc' | 'desc'>('asc');

  const allCategoryData = useMemo(() => {
    return categories.map((cat) => {
      const catItems = items.filter((i) => i.categoryId === cat.id && !i.isArchived);
      const totalValue = catItems.reduce(
        (sum, item) =>
          sum +
          currencyService.convert(
            item.purchaseInfo.purchasePrice,
            item.purchaseInfo.purchaseCurrency,
            displayCurrency,
          ),
        0,
      );
      const lastUpdated = catItems.length > 0
        ? catItems.reduce((latest, item) =>
            new Date(item.updatedAt) > new Date(latest.updatedAt) ? item : latest,
          ).updatedAt
        : cat.updatedAt;

      return { category: cat, count: catItems.length, totalValue, lastUpdated };
    });
  }, [categories, items, displayCurrency]);

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
  }, [allCategoryData, catSearch, catSort, catSortDir]);

  const activeItems = useMemo(() => items.filter((i) => !i.isArchived), [items]);

  const totalValue = useMemo(
    () =>
      activeItems.reduce(
        (sum, item) =>
          sum +
          currencyService.convert(
            item.purchaseInfo.purchasePrice,
            item.purchaseInfo.purchaseCurrency,
            displayCurrency,
          ),
        0,
      ),
    [activeItems, displayCurrency],
  );

  return (
    <PageTransition>
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      <PageHeader
        title="Collections"
        description="Browse and manage your collection categories"
      >
        <div className="flex items-center gap-2">
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
          <Button onClick={() => navigate('/admin/categories/new')}>
            <Plus className="size-4" />
            New Category
          </Button>
        </div>
      </PageHeader>

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
        <MotionGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4" variants={staggerContainer} initial="hidden" animate="visible">
          {categoryData.map(({ category, count, totalValue: catValue, lastUpdated }) => {
            const Icon = getCategoryIcon(category.icon);

            return (
              <MotionItem key={category.id} variants={staggerItem}>
              <Card
                className={cn(
                  'group relative cursor-pointer overflow-hidden transition-shadow duration-300',
                  'hover:shadow-xl hover:shadow-primary/5',
                )}
                onClick={() => navigate(`/collections/${category.slug}`)}
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/60 to-primary/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="rounded-xl bg-primary/10 p-3 transition-colors duration-300 group-hover:bg-primary/15">
                      <Icon className="size-6 text-primary" />
                    </div>
                    <Badge variant="secondary" className="font-medium">
                      {count} {count === 1 ? 'item' : 'items'}
                    </Badge>
                  </div>
                  <div className="mt-4 space-y-1">
                    <h3 className="text-lg font-semibold tracking-tight">
                      {category.name}
                    </h3>
                    <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2.5 pb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Value</span>
                    <span className="font-semibold">{formatCurrency(catValue, displayCurrency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span className="text-muted-foreground">
                      {formatRelativeDate(lastUpdated)}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="pt-0">
                  <Button
                    variant="ghost"
                    className="w-full transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground"
                  >
                    View Collection
                    <ArrowRight className="ml-1 size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Button>
                </CardFooter>
              </Card>
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
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Package className="mb-3 size-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No categories yet</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
    </PageTransition>
  );
}
