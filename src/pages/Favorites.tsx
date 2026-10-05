import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  ArrowUpDown,
  Check,
  DollarSign,
  Eye,
  LayoutGrid,
  List,
  MoreHorizontal,
  Package,
  Pencil,
  SearchX,
  SortAsc,
  SortDesc,
  Star,
  StarOff,
} from 'lucide-react';

import { PageTransition, MotionGrid, MotionItem } from '@/components/shared/motion';
import { staggerContainer, staggerItem } from '@/components/shared/motion-variants';
import {
  PageHeader,
  StatCard,
  SearchBar,
  EmptyState,
  LoadingSkeleton,
  AdvancedFilters,
  VirtualGrid,
  VirtualList,
} from '@/components/shared';
import { ItemDetailPanel } from '@/components/shared/ItemDetailPanel';
import { SavedViewsMenu } from '@/components/collections/SavedViewsMenu';
import { conditionLabel } from '@/components/collections/conditionLabel';
import { useUrlViewState } from '@/components/collections/useUrlViewState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/i18n';
import { isBookCategory } from '@/lib/categoryKind';
import { VIEW_PARAM, parseDraft } from '@/lib/collectionViewParams';
import { getCategoryIcon } from '@/lib/icons';
import { buildSavedViewSearch, type SavedView } from '@/lib/savedViews';
import { cn, formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { getItemCurrentValue } from '@/lib/valuation';
import { currencyService } from '@/services/currencyService';
import { useCollectionStore } from '@/store/useCollectionStore';
import { selectIsColdLoading } from '@/store/collectionStore.selectors';
import type { CollectionItem } from '@/types';
import { getItemReference } from '@/pages/collectionDetail-helpers';
import {
  FAVORITES_SORT_OPTIONS,
  filterFavoriteItems,
  getConditionBadgeProps,
  getFavoriteFilterMeta,
  getFavoriteItems,
  getFavoriteStats,
  getKeyFields,
  isFavoritesSortKey,
  type FavoritesSortKey,
} from '@/pages/favorites-helpers';

const VIRTUAL_THRESHOLD = 80;
const LIST_COLUMNS = 'minmax(260px, 1fr) 160px 140px 120px 130px 56px';
const LIST_MIN_WIDTH = '866px';
const DEFAULT_SORT: { field: FavoritesSortKey; order: 'asc' | 'desc' } = { field: 'createdAt', order: 'desc' };

export default function Favorites() {
  const t = useT();
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

  const favorites = useMemo(() => getFavoriteItems(items), [items]);

  const filterMeta = useMemo(
    () => getFavoriteFilterMeta(favorites, displayCurrency),
    [favorites, displayCurrency],
  );

  const {
    searchParams,
    draft,
    search,
    filters: advFilters,
    setFilters: setAdvFilters,
    setSearch,
    resetDraft,
    replaceDraft,
    urlSort,
    setUrlSort,
    setParam,
  } = useUrlViewState({ maxPrice: filterMeta.maxPrice, maxValue: filterMeta.maxValue });

  const viewMode: 'grid' | 'list' = searchParams.get(VIEW_PARAM.view) === 'list' ? 'list' : 'grid';
  const detailPanelItemId = searchParams.get('detail');
  const sortKey: FavoritesSortKey = urlSort && isFavoritesSortKey(urlSort.field) ? urlSort.field : DEFAULT_SORT.field;
  const sortDir = urlSort ? urlSort.order : DEFAULT_SORT.order;

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

  const openDetail = useCallback((id: string) => setParam('detail', id), [setParam]);
  const setViewMode = (mode: 'grid' | 'list') => setParam(VIEW_PARAM.view, mode === 'list' ? 'list' : null);
  const changeSort = (field: FavoritesSortKey, order: 'asc' | 'desc') => setUrlSort({ field, order });

  const applySavedView = (view: SavedView) => {
    const query = buildSavedViewSearch({ ...view, libraryId: undefined });
    replaceDraft(parseDraft(new URLSearchParams(query)));
    navigate({ search: query });
  };

  const valueLabel = (item: CollectionItem) => formatCurrency(getItemCurrentValue(item, displayCurrency), displayCurrency);

  const renderItemMenu = (item: CollectionItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 sm:size-8"
          aria-label={t('collections.item.moreActions', { title: item.title })}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openDetail(item.id)}>
          <Eye className="mr-2 size-4" /> {t('collections.item.view')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openItemDialog(item.categoryId, item)}>
          <Pencil className="mr-2 size-4" /> {t('collections.item.edit')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => toggleFavorite(item.id)}>
          <StarOff className="mr-2 size-4" /> {t('collections.favorites.unfavorite')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderFavoriteCard = (item: CollectionItem) => {
    const cat = getCategoryById(item.categoryId);
    const Icon = cat ? getCategoryIcon(cat.icon) : Package;
    const condBadge = getConditionBadgeProps(item.condition);
    const keyFields = getKeyFields(cat, item);
    const isBook = isBookCategory(cat);
    const qty = (item.customFields?.quantity as number) || item.quantity || 1;

    return (
      <Card
        className={cn(
          'group relative flex h-full flex-col overflow-hidden transition-all duration-300',
          'hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/5 focus-within:ring-2 focus-within:ring-ring',
        )}
      >
        <div className={cn(
          'relative overflow-hidden bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent',
          isBook ? 'aspect-[2/3]' : 'aspect-[4/3]',
        )}>
          {item.images.length > 0 ? (
            <img
              src={item.images[0]}
              alt=""
              loading="lazy"
              className={cn(
                'h-full w-full transition-transform duration-500 group-hover:scale-105',
                isBook ? 'object-contain' : 'object-cover',
              )}
            />
          ) : (
            <Icon className="absolute inset-0 m-auto size-14 text-amber-500/20 transition-transform duration-500 group-hover:scale-110" aria-hidden="true" />
          )}
          <div className="pointer-events-none absolute right-2 top-2 flex flex-col items-end gap-1">
            <Badge variant={condBadge.variant} className={cn('text-[10px]', condBadge.className)}>
              {conditionLabel(t, item.condition)}
            </Badge>
            {item.isRead && (
              <Badge variant="success" className="gap-0.5 text-[10px]">
                <Check className="size-2.5" aria-hidden="true" /> {t('collections.item.read')}
              </Badge>
            )}
          </div>
        </div>
        <div className="absolute left-2 top-2 z-10 flex items-center gap-1.5">
          <button
            type="button"
            className="rounded-full bg-background/80 p-1.5 backdrop-blur-sm transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t('collections.favorites.removeNamed', { title: item.title })}
            title={t('collections.favorites.unfavorite')}
            onClick={() => toggleFavorite(item.id)}
          >
            <Star className="size-4 fill-amber-500 text-amber-500" aria-hidden="true" />
          </button>
          {qty > 1 && (
            <Badge variant="secondary" className="text-[10px]">×{formatNumber(qty)}</Badge>
          )}
        </div>

        <div className="relative flex flex-1 flex-col space-y-2 p-3">
          <div>
            <h3 className="line-clamp-2 text-sm font-semibold leading-tight tracking-tight">
              <button title={item.title}
                type="button"
                className="text-left after:absolute after:inset-0 focus-visible:outline-none"
                onClick={() => openDetail(item.id)}
              >
                {item.title}
              </button>
            </h3>
            {keyFields.map((kf) => (
              <p key={kf.label} className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{kf.value}</p>
            ))}
          </div>
          <p className="mt-auto text-xs font-semibold tabular-nums text-foreground">{valueLabel(item)}</p>
        </div>
      </Card>
    );
  };

  const renderGridView = () => (
    <VirtualGrid
      items={filtered}
      threshold={VIRTUAL_THRESHOLD}
      minColumnWidth={170}
      estimateRowHeight={360}
      getItemKey={(item) => item.id}
      renderItem={renderFavoriteCard}
      className="gap-3 sm:gap-4"
      gapClassName="gap-3 sm:gap-4"
    />
  );

  const renderFavoriteListRow = (item: CollectionItem) => {
    const cat = getCategoryById(item.categoryId);
    const Icon = cat ? getCategoryIcon(cat.icon) : Package;
    const condBadge = getConditionBadgeProps(item.condition);
    const reference = getItemReference(item);

    return (
      <div
        className="grid cursor-pointer items-center border-b text-sm transition-colors hover:bg-muted/30"
        style={{ gridTemplateColumns: LIST_COLUMNS }}
        onClick={() => openDetail(item.id)}
      >
        <div className="flex min-w-0 items-center gap-3 px-4 py-3">
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-amber-500/10">
            {item.images[0] ? (
              <img src={item.images[0]} alt="" loading="lazy" className="size-9 rounded-lg object-cover" />
            ) : (
              <Icon className="size-4 text-amber-500" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <button title={item.title}
              type="button"
              className="block max-w-full truncate text-left font-medium hover:text-primary focus-visible:underline focus-visible:outline-none"
              onClick={(event) => { event.stopPropagation(); openDetail(item.id); }}
            >
              {item.title}
            </button>
            {reference && <span className="block truncate font-mono text-xs text-muted-foreground">{reference.value}</span>}
          </div>
          <Star className="size-3.5 shrink-0 fill-amber-500 text-amber-500" aria-hidden="true" />
        </div>
        <div className="min-w-0 px-4 py-3">
          {cat && <Badge variant="secondary" className="max-w-full truncate text-xs">{cat.name}</Badge>}
        </div>
        <div className="px-4 py-3">
          <Badge variant={condBadge.variant} className={condBadge.className}>{conditionLabel(t, item.condition)}</Badge>
        </div>
        <div className="px-4 py-3 text-muted-foreground">{formatDate(item.createdAt)}</div>
        <div className="px-4 py-3 text-right font-medium tabular-nums">{valueLabel(item)}</div>
        <div className="px-2 py-2" onClick={(event) => event.stopPropagation()}>{renderItemMenu(item)}</div>
      </div>
    );
  };

  const renderListView = () => (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: LIST_MIN_WIDTH }}>
          <div
            className="grid items-center border-b bg-muted/50 text-sm font-medium text-muted-foreground"
            style={{ gridTemplateColumns: LIST_COLUMNS }}
          >
            <div className="px-4 py-3">{t('collections.table.item')}</div>
            <div className="px-4 py-3">{t('collections.table.category')}</div>
            <div className="px-4 py-3">{t('collections.table.condition')}</div>
            <div className="px-4 py-3">{t('collections.table.added')}</div>
            <div className="px-4 py-3 text-right">{t('collections.table.value')}</div>
            <div className="px-4 py-3"><span className="sr-only">{t('collections.table.actions')}</span></div>
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
      </div>
    </Card>
  );

  return (
    <PageTransition>
      <div className={cn('flex gap-0', detailPanelItemId ? '-m-3 h-[calc(100vh-4rem)] sm:-m-4 md:-m-6' : '')}>
        <div className={cn(
          'min-w-0 flex-1',
          detailPanelItemId ? 'scrollbar-thin overflow-y-auto p-3 sm:p-4 md:p-6' : '',
        )}>
          <div className="space-y-4 sm:space-y-6 md:space-y-8">
            <PageHeader
              title={t('collections.favorites.title')}
              description={t('collections.favorites.descriptionShort')}
            >
              <div className="flex items-center gap-1 rounded-lg border p-1" role="group" aria-label={t('collections.view.label')}>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="icon"
                  className="size-9 sm:size-8"
                  aria-label={t('collections.view.grid')}
                  aria-pressed={viewMode === 'grid'}
                  title={t('collections.view.grid')}
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="size-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="icon"
                  className="size-9 sm:size-8"
                  aria-label={t('collections.view.list')}
                  aria-pressed={viewMode === 'list'}
                  title={t('collections.view.list')}
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
                <MotionGrid
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  <MotionItem className="h-full" variants={staggerItem}>
                    <StatCard
                      title={t('collections.favorites.statItems')}
                      value={formatNumber(stats.count)}
                      icon={Star}
                      subtitle={t('collections.favorites.statItemsHint')}
                    />
                  </MotionItem>
                  <MotionItem className="h-full" variants={staggerItem}>
                    <StatCard
                      title={t('collections.stats.portfolioValue')}
                      value={formatCurrency(stats.totalValue, displayCurrency)}
                      icon={DollarSign}
                      subtitle={t('collections.favorites.statValueHint')}
                    />
                  </MotionItem>
                  <MotionItem className="col-span-2 h-full sm:col-span-1" variants={staggerItem}>
                    <StatCard
                      title={t('collections.favorites.statCategories')}
                      value={formatNumber(stats.categories)}
                      icon={Package}
                      subtitle={t('collections.favorites.statCategoriesHint')}
                    />
                  </MotionItem>
                </MotionGrid>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <SearchBar
                    value={search}
                    onChange={setSearch}
                    placeholder={t('collections.favorites.searchPlaceholder')}
                    className="sm:w-72"
                  />
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="max-sm:h-9">
                          <ArrowUpDown className="mr-1.5 size-3.5" />
                          {t(FAVORITES_SORT_OPTIONS.find((o) => o.value === sortKey)?.labelKey ?? 'collections.sort.label')}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{t('collections.sort.label')}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                          value={sortKey}
                          onValueChange={(value) => changeSort(value as FavoritesSortKey, sortDir)}
                        >
                          {FAVORITES_SORT_OPTIONS.map((option) => (
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
                      aria-label={sortDir === 'asc' ? t('collections.sort.ascending') : t('collections.sort.descending')}
                      title={sortDir === 'asc' ? t('collections.sort.ascending') : t('collections.sort.descending')}
                      onClick={() => changeSort(sortKey, sortDir === 'asc' ? 'desc' : 'asc')}
                    >
                      {sortDir === 'asc' ? <SortAsc className="size-3.5" /> : <SortDesc className="size-3.5" />}
                    </Button>
                  </div>
                </div>

                <AdvancedFilters
                  filters={advFilters}
                  onChange={setAdvFilters}
                  maxPrice={filterMeta.maxPrice}
                  maxValue={filterMeta.maxValue}
                  availableTags={filterMeta.tags}
                  availableConditions={filterMeta.conditions}
                  currencySymbol={currencyService.getCurrencySymbol(displayCurrency)}
                  toolbarSlot={(
                    <SavedViewsMenu
                      categoryId={null}
                      current={{ draft, sort: { field: sortKey, order: sortDir }, viewMode }}
                      onApply={applySavedView}
                    />
                  )}
                />

                {favorites.length > 0 && filtered.length !== favorites.length && (
                  <p className="text-sm text-muted-foreground">
                    {t('collections.favorites.showing', {
                      shown: formatNumber(filtered.length),
                      total: formatNumber(favorites.length),
                    })}
                  </p>
                )}

                {filtered.length === 0 ? (
                  favorites.length === 0 ? (
                    <EmptyState
                      icon={Star}
                      eyebrow={t('collections.favorites.eyebrow')}
                      title={t('collections.favorites.emptyTitle')}
                      description={t('collections.favorites.emptyDescriptionLong')}
                      action={{ label: t('collections.detail.browse'), onClick: () => navigate('/collections') }}
                      secondaryAction={{ label: t('collections.favorites.openWishlist'), onClick: () => navigate('/wishlist') }}
                      hint={t('collections.favorites.emptyHint')}
                    />
                  ) : (
                    <EmptyState
                      icon={SearchX}
                      eyebrow={t('collections.favorites.eyebrow')}
                      title={t('collections.favorites.noMatchesTitle')}
                      description={t('collections.favorites.noMatchesDescriptionLong')}
                      action={{ label: t('collections.clearFilters'), onClick: resetDraft }}
                      secondaryAction={{ label: t('collections.detail.browse'), onClick: () => navigate('/collections') }}
                      hint={t('collections.favorites.noMatchesHint')}
                    />
                  )
                ) : viewMode === 'grid' ? renderGridView() : renderListView()}
              </>
            )}
          </div>
        </div>

        {detailPanelItemId && (
          <ItemDetailPanel
            itemId={detailPanelItemId}
            onClose={() => setParam('detail', null)}
          />
        )}
      </div>
    </PageTransition>
  );
}
