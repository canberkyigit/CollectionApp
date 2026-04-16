import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageTransition } from '@/components/shared/motion';
import {
  Star,
  Package,
  ArrowUpDown,
  SortAsc,
  SortDesc,
  LayoutGrid,
  List,
  MoreHorizontal,
  Eye,
  Pencil,
  Check,
} from 'lucide-react';
import { getCategoryIcon } from '@/lib/icons';

import type { FilterState } from '@/components/shared';
import {
  PageHeader,
  SearchBar,
  EmptyState,
  LoadingSkeleton,
  StatCard,
  AdvancedFilters,
  DEFAULT_FILTERS,
  VirtualGrid,
  VirtualList,
} from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  cn,
  formatCurrency,
  formatNumber,
  formatDate,
} from '@/lib/utils';
import { currencyService } from '@/services/currencyService';
import { useCollectionStore } from '@/store/useCollectionStore';
import { selectIsColdLoading } from '@/store/collectionStore.selectors';
import { ItemDetailPanel } from '@/components/shared/ItemDetailPanel';
import {
  filterFavoriteItems,
  getConditionBadgeProps,
  getFavoriteFilterMeta,
  getFavoriteItems,
  getFavoriteStats,
  getKeyFields,
  type FavoritesSortKey,
} from '@/pages/favorites-helpers';

type SortKey = FavoritesSortKey;
const VIRTUAL_THRESHOLD = 80;

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'Title', value: 'title' },
  { label: 'Date Added', value: 'createdAt' },
  { label: 'Category', value: 'category' },
];

export default function Favorites() {
  const navigate = useNavigate();
  const getCategoryById = useCollectionStore((s) => s.getCategoryById);
  const toggleFavorite = useCollectionStore((s) => s.toggleFavorite);
  const items = useCollectionStore((s) => s.items);
  const openItemDialog = useCollectionStore((s) => s.openItemDialog);
  const ownerUserId = useCollectionStore((s) => s.ownerUserId);
  const isRemoteDataLoading = useCollectionStore((s) => s.isRemoteDataLoading);
  const displayCurrency = useCollectionStore((s) => s.displayCurrency);
  const shouldShowLoadingState = selectIsColdLoading(
    { ownerUserId, isRemoteDataLoading },
    [items.length],
  );

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [detailPanelItemId, setDetailPanelItemId] = useState<string | null>(null);

  const favorites = getFavoriteItems(items);

  const filterMeta = useMemo(
    () => getFavoriteFilterMeta(favorites, displayCurrency),
    [favorites, displayCurrency],
  );

  const [advFilters, setAdvFilters] = useState<FilterState>(() => ({
    ...DEFAULT_FILTERS,
    priceRange: [0, filterMeta.maxPrice],
    valueRange: [0, filterMeta.maxValue],
  }));

  const filtered = useMemo(
    () => filterFavoriteItems({
      favorites,
      search,
      advFilters,
      filterMeta,
      sortKey,
      sortDir,
      displayCurrency,
      getCategoryById,
    }),
    [favorites, search, advFilters, filterMeta, sortKey, sortDir, displayCurrency, getCategoryById],
  );

  const stats = useMemo(
    () => getFavoriteStats(favorites, displayCurrency),
    [favorites, displayCurrency],
  );

  const renderFavoriteCard = (item: typeof filtered[number]) => {
    const cat = getCategoryById(item.categoryId);
    const Icon = cat ? getCategoryIcon(cat.icon) : Package;
    const condBadge = getConditionBadgeProps(item.condition);
    const keyFields = getKeyFields(cat, item);
    const isBookCategory = cat?.id === 'cat-books';
    const qty = (item.customFields?.quantity as number) || item.quantity || 1;

    return (
      <Card
        className={cn(
          'group cursor-pointer overflow-hidden transition-all duration-300',
          'hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/5',
        )}
        onClick={() => setDetailPanelItemId(item.id)}
      >
        <div className={cn(
          'relative overflow-hidden bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent',
          isBookCategory ? 'aspect-[2/3]' : 'aspect-[4/3]',
        )}>
          {item.images.length > 0 ? (
            <img
              src={item.images[0]}
              alt={item.title}
              className={cn(
                'h-full w-full transition-transform duration-500 group-hover:scale-105',
                isBookCategory ? 'object-contain' : 'object-cover',
              )}
            />
          ) : (
            <Icon className="absolute inset-0 m-auto size-14 text-amber-500/20 transition-transform duration-500 group-hover:scale-110" />
          )}
          <div className="absolute right-2 top-2 flex flex-col gap-1">
            <Badge variant={condBadge.variant} className={cn('text-[10px]', condBadge.className)}>{item.condition}</Badge>
            {item.isRead && (
              <Badge variant="success" className="text-[10px] gap-0.5">
                <Check className="size-2.5" /> Read
              </Badge>
            )}
          </div>
          <div className="absolute left-2 top-2 flex items-center gap-1.5">
            <button
              type="button"
              className="rounded-full bg-background/80 p-1.5 backdrop-blur-sm transition-colors hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(item.id);
              }}
            >
              <Star className="size-4 fill-amber-500 text-amber-500" />
            </button>
            {qty > 1 && (
              <Badge variant="secondary" className="text-[10px]">x{qty}</Badge>
            )}
          </div>
        </div>

        <CardContent className="relative space-y-2 p-3">
          <div>
            <h3 className="text-sm font-semibold leading-tight tracking-tight line-clamp-2">
              {item.title}
            </h3>
            {keyFields.map((kf) => (
              <p key={kf.label} className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                {kf.value}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderGridView = () => (
    filtered.length > VIRTUAL_THRESHOLD ? (
      <VirtualGrid
        items={filtered}
        threshold={VIRTUAL_THRESHOLD}
        minColumnWidth={170}
        estimateRowHeight={340}
        getItemKey={(item) => item.id}
        renderItem={renderFavoriteCard}
        gapClassName="gap-3 sm:gap-4"
      />
    ) : (
      <div
        className="grid gap-3 sm:gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 170px), 1fr))' }}
      >
        {filtered.map((item) => (
          <div key={item.id}>
            {renderFavoriteCard(item)}
          </div>
        ))}
      </div>
    )
  );

  const renderFavoriteListRow = (item: typeof filtered[number]) => {
    const cat = getCategoryById(item.categoryId);
    const Icon = cat ? getCategoryIcon(cat.icon) : Package;
    const condBadge = getConditionBadgeProps(item.condition);

    return (
      <div
        className="grid grid-cols-[minmax(260px,1fr)_160px_140px_120px_48px] border-b cursor-pointer text-sm transition-colors hover:bg-muted/30"
        onClick={() => setDetailPanelItemId(item.id)}
      >
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              {item.images[0] ? (
                <img src={item.images[0]} alt="" className="size-9 rounded-lg object-cover" />
              ) : (
                <Icon className="size-4 text-amber-500" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{item.title}</p>
            </div>
            <Star className="size-3.5 shrink-0 fill-amber-500 text-amber-500" />
          </div>
        </div>
        <div className="px-4 py-3">
          {cat && <Badge variant="secondary" className="text-xs">{cat.name}</Badge>}
        </div>
        <div className="px-4 py-3">
          <Badge variant={condBadge.variant} className={cn(condBadge.className)}>{item.condition}</Badge>
        </div>
        <div className="px-4 py-3 text-muted-foreground">{formatDate(item.createdAt)}</div>
        <div className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDetailPanelItemId(item.id)}>
                <Eye className="mr-2 size-4" /> View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openItemDialog(item.categoryId, item)}>
                <Pencil className="mr-2 size-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toggleFavorite(item.id)}>
                <Star className="mr-2 size-4" /> Remove Favorite
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  const renderListView = () => (
    <Card>
      <div className="overflow-x-auto">
        {filtered.length > VIRTUAL_THRESHOLD ? (
          <div className="min-w-[728px]">
            <div className="grid grid-cols-[minmax(260px,1fr)_160px_140px_120px_48px] border-b bg-muted/50 text-sm">
              <div className="px-4 py-3 font-medium text-muted-foreground">Item</div>
              <div className="px-4 py-3 font-medium text-muted-foreground">Category</div>
              <div className="px-4 py-3 font-medium text-muted-foreground">Condition</div>
              <div className="px-4 py-3 font-medium text-muted-foreground">Added</div>
              <div className="px-4 py-3" />
            </div>
            <VirtualList
              items={filtered}
              threshold={VIRTUAL_THRESHOLD}
              estimateSize={65}
              getItemKey={(item) => item.id}
              renderItem={renderFavoriteListRow}
              viewportHeight="min(72vh, 720px)"
            />
          </div>
        ) : (
          <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Item</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Condition</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Added</th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const cat = getCategoryById(item.categoryId);
              const Icon = cat ? getCategoryIcon(cat.icon) : Package;
              const condBadge = getConditionBadgeProps(item.condition);

              return (
                <tr
                  key={item.id}
                  className="border-b cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => setDetailPanelItemId(item.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                        {item.images[0] ? (
                          <img src={item.images[0]} alt="" className="size-9 rounded-lg object-cover" />
                        ) : (
                          <Icon className="size-4 text-amber-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.title}</p>
                      </div>
                      <Star className="size-3.5 shrink-0 fill-amber-500 text-amber-500" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {cat && <Badge variant="secondary" className="text-xs">{cat.name}</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={condBadge.variant} className={cn(condBadge.className)}>{item.condition}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailPanelItemId(item.id)}>
                          <Eye className="mr-2 size-4" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openItemDialog(item.categoryId, item)}>
                          <Pencil className="mr-2 size-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => toggleFavorite(item.id)}>
                          <Star className="mr-2 size-4" /> Unfavorite
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        )}
      </div>
    </Card>
  );

  return (
    <PageTransition>
    <div className={cn('flex gap-0', detailPanelItemId ? '-m-3 sm:-m-4 md:-m-6 h-[calc(100vh-4rem)]' : '')}>
      {/* Main content */}
      <div className={cn(
        'min-w-0 flex-1',
        detailPanelItemId ? 'overflow-y-auto p-3 sm:p-4 md:p-6 scrollbar-thin' : '',
      )}>
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      <PageHeader
        title="Favorites"
        description="Your starred collection items"
      >
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="icon"
            className="size-8"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="icon"
            className="size-8"
            onClick={() => setViewMode('list')}
          >
            <List className="size-4" />
          </Button>
        </div>
      </PageHeader>

      {shouldShowLoadingState ? (
        <div className="space-y-4">
          <LoadingSkeleton variant="list" count={3} />
          <LoadingSkeleton variant="card" count={6} />
        </div>
      ) : (
        <>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          title="Favorite Items"
          value={formatNumber(stats.count)}
          icon={Star}
          subtitle="starred items"
        />
        <StatCard
          title="Total Value"
          value={formatCurrency(stats.totalValue, displayCurrency)}
          icon={Star}
          subtitle="combined value"
        />
        <StatCard
          title="Categories"
          value={formatNumber(stats.categories)}
          icon={Package}
          subtitle="with favorites"
        />
      </div>

      {/* Search & Sort row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search favorites..."
          className="sm:w-72"
        />
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowUpDown className="mr-1.5 size-3.5" />
                {SORT_OPTIONS.find((o) => o.value === sortKey)?.label ?? 'Sort'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setSortKey(opt.value)}
                  className={cn(sortKey === opt.value && 'bg-accent')}
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
            onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
          >
            {sortDir === 'asc' ? <SortAsc className="size-3.5" /> : <SortDesc className="size-3.5" />}
          </Button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        <AdvancedFilters
          filters={advFilters}
          onChange={setAdvFilters}
          maxPrice={filterMeta.maxPrice}
          maxValue={filterMeta.maxValue}
          availableTags={filterMeta.tags}
          currencySymbol={currencyService.getCurrencySymbol(displayCurrency)}
        />
      </div>

      {/* Results count */}
      {favorites.length > 0 && filtered.length !== favorites.length && (
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} of {favorites.length} favorites
        </p>
      )}

      {/* Content */}
      {filtered.length === 0 ? (
        favorites.length === 0 ? (
          <EmptyState
            icon={Star}
            eyebrow="Favorites"
            title="No favorites yet"
            description="Star the items you care about most from any collection and they will appear here for quick access."
            action={{ label: 'Browse Collections', onClick: () => navigate('/collections') }}
            secondaryAction={{ label: 'Open Wishlist', onClick: () => navigate('/wishlist') }}
            hint="Favorites are great for shortlists, insurance picks, or items you want to monitor more closely."
          />
        ) : (
          <EmptyState
            icon={Star}
            eyebrow="Favorites"
            title="No matching favorites"
            description="Your starred items are still here, but none match the current search or filter combination."
            action={{
              label: 'Clear Filters',
              onClick: () => {
                setSearch('');
                setAdvFilters({ ...DEFAULT_FILTERS, priceRange: [0, filterMeta.maxPrice], valueRange: [0, filterMeta.maxValue] });
              },
            }}
            secondaryAction={{ label: 'Browse Collections', onClick: () => navigate('/collections') }}
            hint="Try a broader search term or widen the price and value ranges."
          />
        )
      ) : viewMode === 'grid' ? renderGridView() : renderListView()}
        </>
      )}
    </div>
    </div>

    {/* Inline Detail Side Panel */}
    {detailPanelItemId && (
      <ItemDetailPanel
        itemId={detailPanelItemId}
        onClose={() => setDetailPanelItemId(null)}
      />
    )}
    </div>
    </PageTransition>
  );
}
