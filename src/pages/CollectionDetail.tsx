import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import {
  AlignJustify,
  Archive,
  ArrowRightLeft,
  ArrowUpDown,
  Check,
  DollarSign,
  Eye,
  FolderOpen,
  Image,
  LayoutGrid,
  List,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  SearchX,
  SortAsc,
  SortDesc,
  Star,
  TrendingUp,
  X,
} from 'lucide-react';

import { PageTransition, MotionGrid, MotionItem } from '@/components/shared/motion';
import { staggerContainer, staggerItem } from '@/components/shared/motion-variants';
import {
  PageHeader,
  StatCard,
  SearchBar,
  EmptyState,
  LoadingSkeleton,
  ConfirmDialog,
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
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useT } from '@/i18n';
import { isBookCategory as isBookCategoryCheck } from '@/lib/categoryKind';
import { VIEW_PARAM, parseDraft } from '@/lib/collectionViewParams';
import { getCategoryIcon } from '@/lib/icons';
import { isItemUnassignedForCategory, libraryMatchesCategory } from '@/lib/libraries';
import type { SavedView } from '@/lib/savedViews';
import { buildSavedViewSearch } from '@/lib/savedViews';
import { cn, formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { currencyService } from '@/services/currencyService';
import { useCollectionStore } from '@/store/useCollectionStore';
import type { CollectionItem, SortField, ViewMode } from '@/types';
import {
  filterCollectionItems,
  getCollectionFilterMeta,
  getCollectionItemPurchasePrice,
  getCollectionItemValue,
  getCollectionStats,
  getConditionBadgeProps,
  getItemReference,
  getKeyFields,
  SORT_FIELDS,
  SORT_OPTIONS,
} from './collectionDetail-helpers';

const VIRTUAL_THRESHOLD = 80;
const VIEW_MODES: ViewMode[] = ['grid', 'table', 'covers', 'names'];
/** Shared column template for the virtualised and plain table layouts. */
const TABLE_COLUMNS = '48px minmax(220px, 1fr) 140px 140px 140px 56px';
const TABLE_MIN_WIDTH = '760px';

function isViewMode(value: string | null): value is ViewMode {
  return value != null && (VIEW_MODES as string[]).includes(value);
}

export default function CollectionDetail() {
  const { categorySlug = '' } = useParams<{ categorySlug: string }>();

  return <CollectionDetailContent key={categorySlug || 'unknown'} categorySlug={categorySlug} />;
}

interface CollectionDetailContentProps {
  categorySlug: string;
}

function CollectionDetailContent({ categorySlug }: CollectionDetailContentProps) {
  const t = useT();
  const navigate = useNavigate();

  const categories = useCollectionStore((s) => s.categories);
  const items = useCollectionStore((s) => s.items);
  const libraries = useCollectionStore((s) => s.libraries);
  const storeViewMode = useCollectionStore((s) => s.viewMode);
  const setViewMode = useCollectionStore((s) => s.setViewMode);
  const storeSortField = useCollectionStore((s) => s.sortField);
  const setSortField = useCollectionStore((s) => s.setSortField);
  const storeSortOrder = useCollectionStore((s) => s.sortOrder);
  const setSortOrder = useCollectionStore((s) => s.setSortOrder);
  const deleteItem = useCollectionStore((s) => s.deleteItem);
  const deleteItems = useCollectionStore((s) => s.deleteItems);
  const bulkTransferToLibrary = useCollectionStore((s) => s.bulkTransferToLibrary);
  const openItemDialog = useCollectionStore((s) => s.openItemDialog);
  const displayCurrency = useCollectionStore((s) => s.displayCurrency);
  const isRemoteDataLoading = useCollectionStore((s) => s.isRemoteDataLoading);
  const ownerUserId = useCollectionStore((s) => s.ownerUserId);

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTargetLib, setTransferTargetLib] = useState<string>('');

  const category = useMemo(
    () => categories.find((c) => c.slug === categorySlug),
    [categories, categorySlug],
  );
  const categoryId = category?.id ?? '';
  const shouldShowLoadingState =
    Boolean(ownerUserId)
    && isRemoteDataLoading
    && categories.length === 0
    && items.length === 0;

  const categoryLibraries = useMemo(
    () => (
      category
        ? libraries.filter((library) => libraryMatchesCategory(library, categoryId)).sort((left, right) => left.order - right.order)
        : []
    ),
    [category, categoryId, libraries],
  );

  const allCategoryItems = useMemo(
    () => (categoryId ? items.filter((i) => i.categoryId === categoryId && !i.isArchived) : []),
    [items, categoryId],
  );

  // Filter bounds come from the whole category so they stay stable across library tabs.
  const filterMeta = useMemo(
    () => getCollectionFilterMeta(allCategoryItems, displayCurrency),
    [allCategoryItems, displayCurrency],
  );

  const {
    searchParams,
    draft,
    search: searchQuery,
    filters: advFilters,
    setFilters: setAdvFilters,
    setSearch: setSearchQuery,
    resetDraft,
    replaceDraft,
    urlSort,
    setUrlSort,
    setParam,
  } = useUrlViewState({ maxPrice: filterMeta.maxPrice, maxValue: filterMeta.maxValue });

  const activeLibraryId = searchParams.get(VIEW_PARAM.library) ?? 'all';
  const detailPanelItemId = searchParams.get('detail');
  const urlViewMode = searchParams.get(VIEW_PARAM.view);
  const viewMode: ViewMode = isViewMode(urlViewMode) ? urlViewMode : storeViewMode;
  const sortField: SortField = urlSort && SORT_FIELDS.has(urlSort.field as SortField)
    ? urlSort.field as SortField
    : storeSortField;
  const sortOrder = urlSort ? urlSort.order : storeSortOrder;

  const libraryFilteredItems = useMemo(() => {
    if (activeLibraryId === 'all') return allCategoryItems;
    if (activeLibraryId === 'unassigned') {
      return allCategoryItems.filter((item) => isItemUnassignedForCategory(item, categoryId, libraries));
    }
    return allCategoryItems.filter((i) => i.libraryId === activeLibraryId);
  }, [activeLibraryId, allCategoryItems, categoryId, libraries]);

  const unassignedCount = useMemo(
    () => allCategoryItems.filter((item) => isItemUnassignedForCategory(item, categoryId, libraries)).length,
    [allCategoryItems, categoryId, libraries],
  );

  const filteredItems = useMemo(
    () => filterCollectionItems({
      items: libraryFilteredItems,
      searchQuery,
      advFilters,
      filterMeta,
      sortField,
      sortOrder,
      displayCurrency,
    }),
    [libraryFilteredItems, searchQuery, advFilters, filterMeta, sortField, sortOrder, displayCurrency],
  );

  const stats = useMemo(
    () => getCollectionStats(libraryFilteredItems, displayCurrency),
    [libraryFilteredItems, displayCurrency],
  );

  const toggleSelectItem = useCallback((id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedItems((prev) =>
      prev.length === filteredItems.length
        ? []
        : filteredItems.map((i) => i.id),
    );
  }, [filteredItems]);

  const handleDelete = useCallback(() => {
    if (itemToDelete) {
      deleteItem(itemToDelete);
      setItemToDelete(null);
    } else if (selectedItems.length > 0) {
      deleteItems(selectedItems);
      setSelectedItems([]);
    }
    setDeleteDialogOpen(false);
  }, [itemToDelete, selectedItems, deleteItem, deleteItems]);

  const openSingleDelete = useCallback((id: string) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  }, []);

  const handleBulkTransfer = useCallback(() => {
    if (selectedItems.length === 0 || !transferTargetLib) return;
    bulkTransferToLibrary(selectedItems, transferTargetLib);
    toast.success(t('collections.transfer.done', { count: selectedItems.length, formatted: formatNumber(selectedItems.length) }));
    setSelectedItems([]);
    setTransferDialogOpen(false);
    setTransferTargetLib('');
  }, [selectedItems, transferTargetLib, bulkTransferToLibrary, t]);

  const openDetail = useCallback((id: string) => setParam('detail', id), [setParam]);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setParam(VIEW_PARAM.view, null);
  };

  const changeSort = (field: SortField, order: 'asc' | 'desc') => {
    setSortField(field);
    setSortOrder(order);
    setUrlSort({ field, order });
  };

  const selectLibrary = (libraryId: string) => {
    setSelectedItems([]);
    setParam(VIEW_PARAM.library, libraryId === 'all' ? null : libraryId);
  };

  const applySavedView = (view: SavedView) => {
    setSelectedItems([]);
    replaceDraft(parseDraft(new URLSearchParams(buildSavedViewSearch(view))));
    if (view.viewMode && isViewMode(view.viewMode)) setViewMode(view.viewMode);
    if (view.sort && SORT_FIELDS.has(view.sort.field as SortField)) {
      setSortField(view.sort.field as SortField);
      setSortOrder(view.sort.order);
    }
    navigate({ search: buildSavedViewSearch(view) });
  };

  if (shouldShowLoadingState) {
    return (
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title={t('collections.detail.loading')}
          breadcrumbs={[{ label: t('collections.title'), href: '/collections' }]}
        />
        <LoadingSkeleton variant="detail" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title={t('collections.detail.notFoundHeading')}
          breadcrumbs={[{ label: t('collections.title'), href: '/collections' }]}
        />
        <EmptyState
          icon={FolderOpen}
          eyebrow={t('collections.detail.eyebrow')}
          title={t('collections.detail.notFoundTitle')}
          description={t('collections.detail.notFoundDescription')}
          action={{ label: t('collections.detail.browse'), onClick: () => navigate('/collections') }}
        />
      </div>
    );
  }

  const CategoryIcon = getCategoryIcon(category.icon);
  const isBookCategory = isBookCategoryCheck(category);
  const allSelected = filteredItems.length > 0 && selectedItems.length === filteredItems.length;
  const quantityOf = (item: CollectionItem) => (item.customFields?.quantity as number) || item.quantity || 1;

  const renderReference = (item: CollectionItem, className?: string) => {
    const reference = getItemReference(item);
    if (!reference) return null;
    return <span className={cn('font-mono text-xs text-muted-foreground', className)}>{reference.value}</span>;
  };

  const renderItemMenu = (item: CollectionItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
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
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => openSingleDelete(item.id)}>
          <Archive className="mr-2 size-4" /> {t('collections.item.archive')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderGridCard = (item: CollectionItem) => {
    const keyFields = getKeyFields(category, item);
    const condBadge = getConditionBadgeProps(item.condition);
    const isSelected = selectedItems.includes(item.id);
    const qty = quantityOf(item);

    return (
      <Card
        className={cn(
          'group relative flex h-full flex-col overflow-hidden transition-shadow duration-300',
          'hover:shadow-xl hover:shadow-primary/5 focus-within:ring-2 focus-within:ring-ring',
          isSelected && 'ring-2 ring-primary',
        )}
      >
        <div className="relative z-10 flex items-center gap-1.5 border-b px-2.5 py-1.5">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleSelectItem(item.id)}
            className="size-4 shrink-0"
            aria-label={t('collections.item.select', { title: item.title })}
          />
          {qty > 1 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">×{formatNumber(qty)}</Badge>
          )}
          <div className="ml-auto flex items-center gap-1">
            {item.isRead && (
              <Badge variant="outline" className="gap-0.5 border-green-500/40 bg-green-500/10 px-1.5 py-0 text-[10px] text-green-700 dark:text-green-400">
                <Check className="size-2.5" aria-hidden="true" /> {t('collections.item.read')}
              </Badge>
            )}
            <Badge variant={condBadge.variant} className={cn('px-1.5 py-0 text-[10px]', condBadge.className)}>
              {conditionLabel(t, item.condition)}
            </Badge>
          </div>
        </div>

        <div className={cn(
          'relative overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-transparent',
          isBookCategory ? 'aspect-[2/3]' : 'aspect-[4/3]',
        )}>
          {item.images.length > 0 ? (
            <img
              src={item.images[0]}
              alt=""
              loading="lazy"
              className={cn(
                'h-full w-full transition-transform duration-500 group-hover:scale-105',
                isBookCategory ? 'object-contain' : 'object-cover',
              )}
            />
          ) : (
            <CategoryIcon className="absolute inset-0 m-auto size-14 text-primary/20 transition-transform duration-500 group-hover:scale-110" aria-hidden="true" />
          )}
        </div>

        <div className="flex flex-1 flex-col space-y-1 p-2.5 pt-2">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight tracking-tight">
            <button
              type="button"
              className="text-left after:absolute after:inset-0 focus-visible:outline-none"
              onClick={() => openDetail(item.id)}
            >
              {item.title}
            </button>
          </h3>
          {keyFields.map((kf) => (
            <p key={kf.label} className="line-clamp-1 text-xs text-muted-foreground">
              {kf.value}
            </p>
          ))}
          <p className="mt-auto pt-1 text-xs font-semibold tabular-nums text-foreground">
            {formatCurrency(getCollectionItemValue(item, displayCurrency), displayCurrency)}
          </p>
        </div>
      </Card>
    );
  };

  const renderGridView = () => (
    filteredItems.length > VIRTUAL_THRESHOLD ? (
      <VirtualGrid
        items={filteredItems}
        threshold={VIRTUAL_THRESHOLD}
        minColumnWidth={isBookCategory ? 200 : 260}
        estimateRowHeight={isBookCategory ? 410 : 330}
        getItemKey={(item) => item.id}
        renderItem={renderGridCard}
        gapClassName="gap-4"
      />
    ) : (
      <MotionGrid
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${isBookCategory ? '200px' : '260px'}, 1fr))` }}
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        key={categorySlug}
      >
        {filteredItems.map((item) => (
          <MotionItem key={item.id} variants={staggerItem} className="h-full">
            {renderGridCard(item)}
          </MotionItem>
        ))}
      </MotionGrid>
    )
  );

  const renderCoverTile = (item: CollectionItem) => {
    const isSelected = selectedItems.includes(item.id);
    return (
      <div
        className={cn(
          'group relative overflow-hidden rounded-lg transition-shadow hover:shadow-lg',
          isSelected && 'ring-2 ring-primary',
        )}
      >
        <div className={cn(isBookCategory ? 'aspect-[2/3]' : 'aspect-square', 'bg-muted')}>
          {item.images.length > 0 ? (
            <img src={item.images[0]} alt="" loading="lazy" className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-2 text-center">
              <CategoryIcon className="size-8 text-muted-foreground/30" aria-hidden="true" />
              <span className="line-clamp-3 text-[11px] text-muted-foreground">{item.title}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          onClick={() => openDetail(item.id)}
          title={item.title}
        >
          <span className="sr-only">{item.title}</span>
        </button>
        <div className="absolute bottom-1.5 left-1.5 z-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleSelectItem(item.id)}
            className="size-4 border-2 border-white/60 bg-black/30 data-[state=checked]:bg-primary"
            aria-label={t('collections.item.select', { title: item.title })}
          />
        </div>
        {item.isRead && (
          <div className="pointer-events-none absolute right-1.5 top-1.5">
            <Check className="size-4 text-green-400 drop-shadow" aria-label={t('collections.item.read')} />
          </div>
        )}
      </div>
    );
  };

  const renderCoversView = () => (
    filteredItems.length > VIRTUAL_THRESHOLD ? (
      <VirtualGrid
        items={filteredItems}
        threshold={VIRTUAL_THRESHOLD}
        minColumnWidth={120}
        estimateRowHeight={isBookCategory ? 230 : 150}
        getItemKey={(item) => item.id}
        renderItem={renderCoverTile}
        gapClassName="gap-3"
      />
    ) : (
      <MotionGrid
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        key={`covers-${categorySlug}`}
      >
        {filteredItems.map((item) => (
          <MotionItem key={item.id} variants={staggerItem}>
            {renderCoverTile(item)}
          </MotionItem>
        ))}
      </MotionGrid>
    )
  );

  const renderNameRow = (item: CollectionItem) => {
    const isSelected = selectedItems.includes(item.id);
    const author = item.customFields?.author;
    return (
      <div
        className={cn(
          'relative flex items-center gap-3 border-b px-4 py-2.5 transition-colors last:border-b-0 hover:bg-muted/50',
          isSelected && 'bg-primary/5',
        )}
      >
        <Checkbox
          className="relative z-10"
          checked={isSelected}
          onCheckedChange={() => toggleSelectItem(item.id)}
          aria-label={t('collections.item.select', { title: item.title })}
        />
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-sm font-medium after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
          onClick={() => openDetail(item.id)}
        >
          {item.title}
        </button>
        {item.isRead && <Check className="size-4 shrink-0 text-green-500" aria-label={t('collections.item.read')} />}
        {author != null && author !== '' && (
          <span className="hidden max-w-[200px] truncate text-xs text-muted-foreground sm:inline">{String(author)}</span>
        )}
        {renderReference(item, 'hidden md:inline')}
        <span className="shrink-0 text-xs font-medium tabular-nums">
          {formatCurrency(getCollectionItemPurchasePrice(item, displayCurrency), displayCurrency)}
        </span>
      </div>
    );
  };

  const renderNamesView = () => (
    <Card className="overflow-hidden">
      <VirtualList
        items={filteredItems}
        threshold={VIRTUAL_THRESHOLD}
        estimateSize={46}
        getItemKey={(item) => item.id}
        renderItem={renderNameRow}
        viewportHeight="min(72vh, 720px)"
      />
    </Card>
  );

  const renderTitleCell = (item: CollectionItem) => (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
        {item.images[0] ? (
          <img src={item.images[0]} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <CategoryIcon className="size-4 text-primary" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0">
        <button
          type="button"
          className="block max-w-full truncate text-left font-medium hover:text-primary focus-visible:underline focus-visible:outline-none"
          onClick={(event) => { event.stopPropagation(); openDetail(item.id); }}
        >
          {item.title}
        </button>
        {renderReference(item, 'block truncate')}
      </div>
    </div>
  );

  const tableHeaderCells = (
    <>
      <div className="px-4 py-3">
        <Checkbox
          aria-label={t('collections.table.selectAll')}
          checked={allSelected}
          onCheckedChange={toggleSelectAll}
        />
      </div>
      <div className="px-4 py-3">{t('collections.table.title')}</div>
      <div className="px-4 py-3">{t('collections.table.condition')}</div>
      <div className="px-4 py-3">{t('collections.table.added')}</div>
      <div className="px-4 py-3 text-right">{t('collections.table.value')}</div>
      <div className="px-4 py-3"><span className="sr-only">{t('collections.table.actions')}</span></div>
    </>
  );

  const renderTableRow = (item: CollectionItem) => {
    const condBadge = getConditionBadgeProps(item.condition);
    const isSelected = selectedItems.includes(item.id);

    return (
      <div
        className={cn(
          'grid cursor-pointer items-center border-b text-sm transition-colors hover:bg-muted/30',
          isSelected && 'bg-primary/5',
        )}
        style={{ gridTemplateColumns: TABLE_COLUMNS }}
        onClick={() => openDetail(item.id)}
      >
        <div className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleSelectItem(item.id)}
            aria-label={t('collections.item.select', { title: item.title })}
          />
        </div>
        <div className="min-w-0 px-4 py-3">{renderTitleCell(item)}</div>
        <div className="px-4 py-3">
          <Badge variant={condBadge.variant} className={condBadge.className}>{conditionLabel(t, item.condition)}</Badge>
        </div>
        <div className="px-4 py-3 text-muted-foreground">{formatDate(item.createdAt)}</div>
        <div className="px-4 py-3 text-right font-medium tabular-nums">
          {formatCurrency(getCollectionItemValue(item, displayCurrency), displayCurrency)}
        </div>
        <div className="px-2 py-2" onClick={(e) => e.stopPropagation()}>{renderItemMenu(item)}</div>
      </div>
    );
  };

  const renderTableView = () => (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: TABLE_MIN_WIDTH }}>
          <div
            className="grid items-center border-b bg-muted/50 text-sm font-medium text-muted-foreground"
            style={{ gridTemplateColumns: TABLE_COLUMNS }}
          >
            {tableHeaderCells}
          </div>
          <VirtualList
            items={filteredItems}
            threshold={VIRTUAL_THRESHOLD}
            estimateSize={65}
            getItemKey={(item) => item.id}
            renderItem={renderTableRow}
            viewportHeight="min(72vh, 720px)"
          />
        </div>
      </div>
    </Card>
  );

  const viewModeButtons: { mode: ViewMode; icon: typeof LayoutGrid; labelKey: string }[] = [
    { mode: 'grid', icon: LayoutGrid, labelKey: 'collections.view.grid' },
    { mode: 'table', icon: List, labelKey: 'collections.view.list' },
    { mode: 'covers', icon: Image, labelKey: 'collections.view.covers' },
    { mode: 'names', icon: AlignJustify, labelKey: 'collections.view.names' },
  ];

  const libraryTab = (id: string, label: string, count: number) => (
    <button
      key={id}
      type="button"
      aria-pressed={activeLibraryId === id}
      onClick={() => selectLibrary(id)}
      className={cn(
        'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:py-2 sm:text-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        activeLibraryId === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}{' '}
      <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{formatNumber(count)}</Badge>
    </button>
  );

  const sortLabelKey = SORT_OPTIONS.find((o) => o.value === sortField)?.labelKey ?? 'collections.sort.label';

  return (
    <PageTransition>
      <div className={cn('flex gap-0', detailPanelItemId ? '-m-3 h-[calc(100vh-4rem)] sm:-m-4 md:-m-6' : '')}>
        <div className={cn(
          'min-w-0 flex-1',
          detailPanelItemId ? 'scrollbar-thin overflow-y-auto p-3 sm:p-4 md:p-6' : '',
        )}>
          <div className="space-y-4 sm:space-y-6 md:space-y-8">
            <PageHeader
              title={category.name}
              description={category.description}
              breadcrumbs={[
                { label: t('collections.title'), href: '/collections' },
                { label: category.name },
              ]}
            >
              <div className="flex items-center gap-1 rounded-lg border p-1" role="group" aria-label={t('collections.view.label')}>
                {viewModeButtons.map(({ mode, icon: Icon, labelKey }) => (
                  <Button
                    key={mode}
                    variant={viewMode === mode ? 'default' : 'ghost'}
                    size="icon"
                    className="size-8"
                    onClick={() => changeViewMode(mode)}
                    aria-label={t(labelKey)}
                    aria-pressed={viewMode === mode}
                    title={t(labelKey)}
                  >
                    <Icon className="size-4" />
                  </Button>
                ))}
              </div>
              <Button onClick={() => openItemDialog(category.id)}>
                <Plus className="size-4" />
                {t('collections.detail.addItem')}
              </Button>
            </PageHeader>

            {categoryLibraries.length > 0 && (
              <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
                <div className="flex w-max min-w-full items-center gap-1 rounded-lg border bg-muted/30 p-1 sm:w-auto">
                  {libraryTab('all', t('collections.library.all'), allCategoryItems.length)}
                  {categoryLibraries.map((lib) => libraryTab(
                    lib.id,
                    lib.name,
                    allCategoryItems.filter((i) => i.libraryId === lib.id).length,
                  ))}
                  {libraryTab('unassigned', t('collections.library.unassigned'), unassignedCount)}
                </div>
              </div>
            )}

            <MotionGrid
              className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              key={`stats-${categorySlug}`}
            >
              <MotionItem className="h-full" variants={staggerItem}>
                <StatCard title={t('collections.stats.items')} value={formatNumber(stats.count)} icon={Package} />
              </MotionItem>
              <MotionItem className="h-full" variants={staggerItem}>
                <StatCard title={t('collections.stats.totalValue')} value={formatCurrency(stats.totalValue, displayCurrency)} icon={DollarSign} />
              </MotionItem>
              <MotionItem className="h-full" variants={staggerItem}>
                <StatCard title={t('collections.stats.averageValue')} value={formatCurrency(stats.avgValue, displayCurrency)} icon={TrendingUp} />
              </MotionItem>
              <MotionItem className="h-full" variants={staggerItem}>
                <StatCard title={t('collections.stats.highestValue')} value={formatCurrency(stats.highestValue, displayCurrency)} icon={Star} />
              </MotionItem>
            </MotionGrid>

            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={t('collections.detail.searchPlaceholder', { name: category.name.toLocaleLowerCase() })}
                  className="sm:w-64 lg:w-80"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <ArrowUpDown className="mr-1.5 size-3.5" />
                        {t(sortLabelKey)}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>{t('collections.sort.label')}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={sortField}
                        onValueChange={(value) => changeSort(value as SortField, sortOrder)}
                      >
                        {SORT_OPTIONS.map((option) => (
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
                    className="size-8"
                    aria-label={sortOrder === 'asc' ? t('collections.sort.ascending') : t('collections.sort.descending')}
                    title={sortOrder === 'asc' ? t('collections.sort.ascending') : t('collections.sort.descending')}
                    onClick={() => changeSort(sortField, sortOrder === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortOrder === 'asc' ? <SortAsc className="size-3.5" /> : <SortDesc className="size-3.5" />}
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
                availableCurrencies={filterMeta.currencies}
                currencySymbol={currencyService.getCurrencySymbol(displayCurrency)}
                category={category}
                toolbarSlot={(
                  <SavedViewsMenu
                    categoryId={category.id}
                    current={{
                      draft,
                      sort: { field: sortField, order: sortOrder },
                      viewMode,
                      libraryId: activeLibraryId !== 'all' ? activeLibraryId : undefined,
                    }}
                    onApply={applySavedView}
                  />
                )}
              />
            </div>

            {selectedItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
                <span className="text-xs font-medium sm:text-sm">
                  {t('collections.selection.count', { count: selectedItems.length, formatted: formatNumber(selectedItems.length) })}
                </span>
                <div className="hidden h-4 w-px bg-border sm:block" />
                {categoryLibraries.length > 0 && (
                  <Button variant="outline" size="sm" className="h-7 text-xs sm:h-8 sm:text-sm" onClick={() => setTransferDialogOpen(true)}>
                    <ArrowRightLeft className="mr-1 size-3 sm:mr-1.5 sm:size-3.5" />
                    {t('collections.transfer.action')}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs sm:h-8 sm:text-sm"
                  onClick={() => { setItemToDelete(null); setDeleteDialogOpen(true); }}
                >
                  <Archive className="mr-1 size-3 sm:mr-1.5 sm:size-3.5" />
                  {t('collections.item.archive')}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs sm:h-8 sm:text-sm" onClick={() => setSelectedItems([])}>
                  <X className="mr-1 size-3 sm:mr-1.5 sm:size-3.5" />
                  {t('collections.selection.clear')}
                </Button>
              </div>
            )}

            {libraryFilteredItems.length > 0 && filteredItems.length !== libraryFilteredItems.length && (
              <p className="text-sm text-muted-foreground">
                {t('collections.detail.showing', {
                  shown: formatNumber(filteredItems.length),
                  total: formatNumber(libraryFilteredItems.length),
                })}
              </p>
            )}

            {filteredItems.length === 0 ? (
              libraryFilteredItems.length === 0 ? (
                <EmptyState
                  icon={Package}
                  eyebrow={t('collections.detail.eyebrow')}
                  title={t('collections.detail.emptyTitle')}
                  description={t('collections.detail.emptyDescriptionLong')}
                  action={{ label: t('collections.detail.addFirst'), onClick: () => openItemDialog(category.id) }}
                  secondaryAction={{ label: t('collections.detail.browseAll'), onClick: () => navigate('/collections') }}
                  hint={t('collections.detail.emptyHint')}
                />
              ) : (
                <EmptyState
                  icon={SearchX}
                  eyebrow={t('collections.detail.eyebrow')}
                  title={t('collections.detail.noMatchesTitle')}
                  description={t('collections.detail.noMatchesDescriptionLong')}
                  action={{ label: t('collections.clearFilters'), onClick: resetDraft }}
                  secondaryAction={{ label: t('collections.viewAll'), onClick: () => navigate('/collections') }}
                  hint={t('collections.detail.noMatchesHint')}
                />
              )
            ) : viewMode === 'grid' ? renderGridView()
              : viewMode === 'covers' ? renderCoversView()
                : viewMode === 'names' ? renderNamesView()
                  : renderTableView()}

            <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('collections.transfer.title')}</DialogTitle>
                  <DialogDescription>
                    {t('collections.transfer.description', { count: selectedItems.length, formatted: formatNumber(selectedItems.length) })}
                  </DialogDescription>
                </DialogHeader>
                <Select value={transferTargetLib} onValueChange={setTransferTargetLib}>
                  <SelectTrigger aria-label={t('collections.transfer.target')}>
                    <SelectValue placeholder={t('collections.transfer.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryLibraries.map((lib) => (
                      <SelectItem key={lib.id} value={lib.id}>{lib.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>{t('common.cancel')}</Button>
                  <Button disabled={!transferTargetLib} onClick={handleBulkTransfer}>{t('collections.transfer.action')}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <ConfirmDialog
              open={deleteDialogOpen}
              onClose={() => { setDeleteDialogOpen(false); setItemToDelete(null); }}
              onConfirm={handleDelete}
              title={itemToDelete ? t('collections.archive.titleOne') : t('collections.archive.titleMany')}
              description={
                itemToDelete
                  ? t('collections.archive.descriptionOne')
                  : t('collections.archive.descriptionMany', { count: selectedItems.length, formatted: formatNumber(selectedItems.length) })
              }
              confirmLabel={t('collections.item.archive')}
              destructive
            />
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
