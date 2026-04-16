import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageTransition, MotionGrid, MotionItem } from '@/components/shared/motion';
import { staggerContainer, staggerItem } from '@/components/shared/motion-variants';
import type { ViewMode } from '@/types';
import type { FilterState } from '@/components/shared';
import {
  Package,
  Plus,
  LayoutGrid,
  List,
  DollarSign,
  TrendingUp,
  ArrowUpDown,
  SortAsc,
  SortDesc,
  Star,
  Trash2,
  MoreHorizontal,
  Eye,
  Pencil,
  FolderOpen,
  Image,
  AlignJustify,
  ArrowRightLeft,
  X,
  Check,
} from 'lucide-react';
import { getCategoryIcon } from '@/lib/icons';
import { isItemUnassignedForCategory, libraryMatchesCategory } from '@/lib/libraries';

import {
  PageHeader,
  SearchBar,
  EmptyState,
  LoadingSkeleton,
  StatCard,
  ConfirmDialog,
  AdvancedFilters,
  DEFAULT_FILTERS,
  VirtualGrid,
  VirtualList,
} from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  cn,
  formatCurrency,
  formatDate,
  formatNumber,
} from '@/lib/utils';
import { currencyService } from '@/services/currencyService';
import { useCollectionStore } from '@/store/useCollectionStore';
import { ItemDetailPanel } from '@/components/shared/ItemDetailPanel';
import {
  filterCollectionItems,
  getCollectionFilterMeta,
  getCollectionItemPurchasePrice,
  getCollectionStats,
  getConditionBadgeProps,
  getKeyFields,
  SORT_OPTIONS,
} from './collectionDetail-helpers';

const VIRTUAL_THRESHOLD = 80;

export default function CollectionDetail() {
  const { categorySlug = '' } = useParams<{ categorySlug: string }>();

  return <CollectionDetailContent key={categorySlug || 'unknown'} categorySlug={categorySlug} />;
}

interface CollectionDetailContentProps {
  categorySlug: string;
}

function CollectionDetailContent({ categorySlug }: CollectionDetailContentProps) {
  const navigate = useNavigate();

  const categories = useCollectionStore((s) => s.categories);
  const items = useCollectionStore((s) => s.items);
  const libraries = useCollectionStore((s) => s.libraries);
  const viewMode = useCollectionStore((s) => s.viewMode);
  const setViewMode = useCollectionStore((s) => s.setViewMode);
  const sortField = useCollectionStore((s) => s.sortField);
  const setSortField = useCollectionStore((s) => s.setSortField);
  const sortOrder = useCollectionStore((s) => s.sortOrder);
  const setSortOrder = useCollectionStore((s) => s.setSortOrder);
  const deleteItem = useCollectionStore((s) => s.deleteItem);
  const deleteItems = useCollectionStore((s) => s.deleteItems);
  const bulkTransferToLibrary = useCollectionStore((s) => s.bulkTransferToLibrary);
  const openItemDialog = useCollectionStore((s) => s.openItemDialog);
  const displayCurrency = useCollectionStore((s) => s.displayCurrency);
  const isRemoteDataLoading = useCollectionStore((s) => s.isRemoteDataLoading);
  const ownerUserId = useCollectionStore((s) => s.ownerUserId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTargetLib, setTransferTargetLib] = useState<string>('');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeLibraryId = searchParams.get('library') ?? 'all';
  const detailPanelItemId = searchParams.get('detail');

  const category = useMemo(
    () => categories.find((c) => c.slug === categorySlug),
    [categories, categorySlug],
  );
  const categoryId = category?.id ?? '';
  const shouldShowLoadingState =
    Boolean(ownerUserId) &&
    isRemoteDataLoading &&
    categories.length === 0 &&
    items.length === 0;

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

  const filterMeta = useMemo(
    () => getCollectionFilterMeta(libraryFilteredItems, displayCurrency),
    [libraryFilteredItems, displayCurrency],
  );

  const [advFilters, setAdvFilters] = useState<FilterState>(() => ({
    ...DEFAULT_FILTERS,
    priceRange: [0, filterMeta.maxPrice],
    valueRange: [0, filterMeta.maxValue],
  }));

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
    toast.success(`Transferred ${selectedItems.length} item(s)`);
    setSelectedItems([]);
    setTransferDialogOpen(false);
    setTransferTargetLib('');
  }, [selectedItems, transferTargetLib, bulkTransferToLibrary]);

  const updateSearchParam = useCallback((key: string, value: string | null) => {
    const nextParams = new URLSearchParams(searchParams);

    if (value == null || value === '') {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }

    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  if (shouldShowLoadingState) {
    return (
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title="Loading Collection"
          breadcrumbs={[{ label: 'Collections', href: '/collections' }]}
        />
        <LoadingSkeleton variant="detail" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title="Category Not Found"
          breadcrumbs={[{ label: 'Collections', href: '/collections' }]}
        />
        <EmptyState
          icon={FolderOpen}
          title="Category not found"
          description="The collection category you're looking for doesn't exist."
          action={{ label: 'Browse Collections', onClick: () => navigate('/collections') }}
        />
      </div>
    );
  }

  const CategoryIcon = getCategoryIcon(category.icon);
  const isBookCategory = category.id === 'cat-books';

  const renderGridCard = (item: typeof filteredItems[number]) => {
    const keyFields = getKeyFields(category, item);
    const condBadge = getConditionBadgeProps(item.condition);
    const isSelected = selectedItems.includes(item.id);
    const qty = (item.customFields?.quantity as number) || item.quantity || 1;

    return (
      <Card
        className={cn(
          'group cursor-pointer overflow-hidden transition-shadow duration-300',
          'hover:shadow-xl hover:shadow-primary/5',
          isSelected && 'ring-2 ring-primary',
        )}
        onClick={() => updateSearchParam('detail', item.id)}
      >
        <div className="flex items-center gap-1.5 border-b px-2.5 py-1.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleSelectItem(item.id)}
            className="size-4 shrink-0"
          />
          {qty > 1 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">x{qty}</Badge>
          )}
          <div className="ml-auto flex items-center gap-1">
            {item.isRead && (
              <Badge variant="outline" className="text-[10px] gap-0.5 border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400 px-1.5 py-0">
                <Check className="size-2.5" /> Read
              </Badge>
            )}
            <Badge variant={condBadge.variant} className={cn('text-[10px] px-1.5 py-0', condBadge.className)}>{item.condition}</Badge>
          </div>
        </div>

        <div className={cn(
          'relative overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-transparent',
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
            <CategoryIcon className="absolute inset-0 m-auto size-14 text-primary/20 transition-transform duration-500 group-hover:scale-110" />
          )}
        </div>

        <CardContent className="space-y-1 p-2.5 pt-2">
          <h3 className="text-sm font-semibold leading-tight tracking-tight line-clamp-2">
            {item.title}
          </h3>
          {keyFields.map((kf) => (
            <p key={kf.label} className="text-xs text-muted-foreground line-clamp-1">
              {kf.value}
            </p>
          ))}
        </CardContent>
      </Card>
    );
  };

  const renderGridView = () => (
    filteredItems.length > VIRTUAL_THRESHOLD ? (
      <VirtualGrid
        items={filteredItems}
        threshold={VIRTUAL_THRESHOLD}
        minColumnWidth={isBookCategory ? 200 : 260}
        estimateRowHeight={isBookCategory ? 390 : 310}
        getItemKey={(item) => item.id}
        renderItem={renderGridCard}
        gapClassName="gap-4"
      />
    ) : (
      <MotionGrid
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${isBookCategory ? '200px' : '260px'}, 1fr))`,
        }}
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        key={categorySlug}
      >
        {filteredItems.map((item) => (
          <MotionItem key={item.id} variants={staggerItem}>
            {renderGridCard(item)}
          </MotionItem>
        ))}
      </MotionGrid>
    )
  );

  const renderCoverTile = (item: typeof filteredItems[number]) => {
    const isSelected = selectedItems.includes(item.id);
    return (
      <div
        className={cn(
          'group relative cursor-pointer overflow-hidden rounded-lg',
          'hover:shadow-lg',
          isSelected && 'ring-2 ring-primary',
        )}
        onClick={() => updateSearchParam('detail', item.id)}
      >
        <div className={cn(isBookCategory ? 'aspect-[2/3]' : 'aspect-square', 'bg-muted')}>
          {item.images.length > 0 ? (
            <img src={item.images[0]} alt={item.title} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <CategoryIcon className="size-8 text-muted-foreground/30" />
            </div>
          )}
        </div>
        <div className="absolute left-1.5 bottom-1.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleSelectItem(item.id)}
            className="size-4 border-2 border-white/60 bg-black/30 data-[state=checked]:bg-primary"
          />
        </div>
        {item.isRead && (
          <div className="absolute right-1.5 top-1.5">
            <Check className="size-4 text-green-400 drop-shadow" />
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

  const renderNameRow = (item: typeof filteredItems[number]) => {
    const isSelected = selectedItems.includes(item.id);
    return (
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-muted/50',
          isSelected && 'bg-primary/5',
        )}
        onClick={() => updateSearchParam('detail', item.id)}
      >
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleSelectItem(item.id)}
          />
        </div>
        <span className="flex-1 text-sm font-medium truncate">{item.title}</span>
        {item.isRead && <Check className="size-4 text-green-500" />}
        {item.customFields?.author != null && item.customFields.author !== '' && (
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {String(item.customFields.author)}
          </span>
        )}
        <span className="text-xs font-medium shrink-0">
          {formatCurrency(getCollectionItemPurchasePrice(item, displayCurrency), displayCurrency)}
        </span>
      </div>
    );
  };

  const renderNamesView = () => (
    <Card>
      <VirtualList
        items={filteredItems}
        threshold={VIRTUAL_THRESHOLD}
        estimateSize={46}
        getItemKey={(item) => item.id}
        renderItem={renderNameRow}
        className="divide-y"
        viewportHeight="min(72vh, 720px)"
      />
    </Card>
  );

  const renderTableRow = (item: typeof filteredItems[number]) => {
    const condBadge = getConditionBadgeProps(item.condition);
    const isSelected = selectedItems.includes(item.id);

    return (
      <div
        className={cn(
          'grid grid-cols-[48px_minmax(220px,1fr)_140px_140px_48px] border-b transition-colors hover:bg-muted/30 cursor-pointer text-sm',
          isSelected && 'bg-primary/5',
        )}
        onClick={() => updateSearchParam('detail', item.id)}
      >
        <div className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectItem(item.id)} />
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <CategoryIcon className="size-4 text-primary" />
            </div>
            <span className="font-medium">{item.title}</span>
          </div>
        </div>
        <div className="px-4 py-3"><Badge {...condBadge}>{item.condition}</Badge></div>
        <div className="px-4 py-3 text-muted-foreground">{formatDate(item.createdAt)}</div>
        <div className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => updateSearchParam('detail', item.id)}>
                <Eye className="mr-2 size-4" /> View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openItemDialog(item.categoryId, item)}>
                <Pencil className="mr-2 size-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => openSingleDelete(item.id)}>
                <Trash2 className="mr-2 size-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  const renderTableView = () => (
    <Card>
      <div className="overflow-x-auto">
        {filteredItems.length > VIRTUAL_THRESHOLD ? (
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[48px_minmax(220px,1fr)_140px_140px_48px] border-b bg-muted/50 text-sm">
              <div className="px-4 py-3">
                <Checkbox
                  aria-label="Select all items"
                  checked={filteredItems.length > 0 && selectedItems.length === filteredItems.length}
                  onCheckedChange={toggleSelectAll}
                />
              </div>
              <div className="px-4 py-3 font-medium text-muted-foreground">Title</div>
              <div className="px-4 py-3 font-medium text-muted-foreground">Condition</div>
              <div className="px-4 py-3 font-medium text-muted-foreground">Date Added</div>
              <div className="px-4 py-3" />
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
        ) : (
          <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-12 px-4 py-3 text-left">
                <Checkbox
                  aria-label="Select all items"
                  checked={filteredItems.length > 0 && selectedItems.length === filteredItems.length}
                  onCheckedChange={toggleSelectAll}
                />
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Condition</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date Added</th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const condBadge = getConditionBadgeProps(item.condition);
              const isSelected = selectedItems.includes(item.id);

              return (
                <tr
                  key={item.id}
                  className={cn(
                    'border-b transition-colors hover:bg-muted/30 cursor-pointer',
                    isSelected && 'bg-primary/5',
                  )}
                      onClick={() => updateSearchParam('detail', item.id)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectItem(item.id)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <CategoryIcon className="size-4 text-primary" />
                      </div>
                      <span className="font-medium">{item.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge {...condBadge}>{item.condition}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => updateSearchParam('detail', item.id)}>
                          <Eye className="mr-2 size-4" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openItemDialog(item.categoryId, item)}>
                          <Pencil className="mr-2 size-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => openSingleDelete(item.id)}>
                          <Trash2 className="mr-2 size-4" /> Delete
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
        title={category.name}
        description={category.description}
        breadcrumbs={[
          { label: 'Collections', href: '/collections' },
          { label: category.name },
        ]}
      >
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {([
            { mode: 'grid' as ViewMode, icon: LayoutGrid, label: 'Grid' },
            { mode: 'table' as ViewMode, icon: List, label: 'List' },
            { mode: 'covers' as ViewMode, icon: Image, label: 'Covers' },
            { mode: 'names' as ViewMode, icon: AlignJustify, label: 'Names' },
          ]).map(({ mode, icon: Icon, label }) => (
            <Button
              key={mode}
              variant={viewMode === mode ? 'default' : 'ghost'}
              size="icon"
              className="size-8"
              onClick={() => setViewMode(mode)}
              title={label}
            >
              <Icon className="size-4" />
            </Button>
          ))}
        </div>
        <Button onClick={() => category && openItemDialog(category.id)}>
          <Plus className="size-4" />
          Add Item
        </Button>
      </PageHeader>

      {/* Library Tabs */}
      {categoryLibraries.length > 0 && (
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 w-max min-w-full sm:w-auto">
          <button
            onClick={() => { setSelectedItems([]); updateSearchParam('library', 'all'); }}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:py-2 sm:text-sm',
              activeLibraryId === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            All
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{allCategoryItems.length}</Badge>
          </button>
          {categoryLibraries.map((lib) => {
            const libCount = allCategoryItems.filter((i) => i.libraryId === lib.id).length;
            return (
              <button
                key={lib.id}
                onClick={() => { setSelectedItems([]); updateSearchParam('library', lib.id); }}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:py-2 sm:text-sm',
                  activeLibraryId === lib.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {lib.name}
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{libCount}</Badge>
              </button>
            );
          })}
          <button
            onClick={() => { setSelectedItems([]); updateSearchParam('library', 'unassigned'); }}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:py-2 sm:text-sm',
              activeLibraryId === 'unassigned' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Unassigned
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {unassignedCount}
            </Badge>
          </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <MotionGrid
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        key={`stats-${categorySlug}`}
      >
        <MotionItem className="h-full" variants={staggerItem}><StatCard title="Items" value={formatNumber(stats.count)} icon={Package} /></MotionItem>
        <MotionItem className="h-full" variants={staggerItem}><StatCard title="Total Value" value={formatCurrency(stats.totalValue, displayCurrency)} icon={DollarSign} /></MotionItem>
        <MotionItem className="h-full" variants={staggerItem}><StatCard title="Average Value" value={formatCurrency(stats.avgValue, displayCurrency)} icon={TrendingUp} /></MotionItem>
        <MotionItem className="h-full" variants={staggerItem}><StatCard title="Highest Value" value={formatCurrency(stats.highestValue, displayCurrency)} icon={Star} /></MotionItem>
      </MotionGrid>

      {/* Filter / Sort Bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={`Search ${category.name.toLowerCase()}...`}
            className="sm:w-64 lg:w-80"
          />
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowUpDown className="mr-1.5 size-3.5" />
                  {SORT_OPTIONS.find((o) => o.value === sortField)?.label ?? 'Sort'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setSortField(option.value)}
                    className={cn(sortField === option.value && 'bg-accent')}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="icon" className="size-8" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
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
          availableCurrencies={filterMeta.currencies}
          currencySymbol={currencyService.getCurrencySymbol(displayCurrency)}
          category={category}
        />
      </div>

      {/* Bulk Actions Bar */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <span className="text-xs font-medium sm:text-sm">
            {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected
          </span>
          <div className="hidden h-4 w-px bg-border sm:block" />
          {categoryLibraries.length > 0 && (
            <Button variant="outline" size="sm" className="h-7 text-xs sm:h-8 sm:text-sm" onClick={() => setTransferDialogOpen(true)}>
              <ArrowRightLeft className="mr-1 size-3 sm:mr-1.5 sm:size-3.5" />
              Transfer
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs sm:h-8 sm:text-sm"
            onClick={() => { setItemToDelete(null); setDeleteDialogOpen(true); }}
          >
            <Trash2 className="mr-1 size-3 sm:mr-1.5 sm:size-3.5" />
            Delete
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs sm:h-8 sm:text-sm" onClick={() => setSelectedItems([])}>
            <X className="mr-1 size-3 sm:mr-1.5 sm:size-3.5" />
            Clear
          </Button>
        </div>
      )}

      {/* Results count */}
      {libraryFilteredItems.length > 0 && filteredItems.length !== libraryFilteredItems.length && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredItems.length} of {libraryFilteredItems.length} items
        </p>
      )}

      {/* Content */}
      {filteredItems.length === 0 ? (
        libraryFilteredItems.length === 0 ? (
          <EmptyState
            icon={Package}
            eyebrow="Collection"
            title="No items yet"
            description="This collection is ready, but it does not contain any items yet. Add your first item to start tracking value, notes, and history here."
            action={{ label: 'Add First Item', onClick: () => category && openItemDialog(category.id) }}
            secondaryAction={{ label: 'Browse All Collections', onClick: () => navigate('/collections') }}
            hint="Items added here inherit this category automatically, and you can move them between libraries later."
          />
        ) : (
          <EmptyState
            icon={Package}
            eyebrow="Collection"
            title="No matching items"
            description="Items exist in this collection, but none match the current search, library selection, or advanced filters."
            action={{
              label: 'Clear Filters',
              onClick: () => {
                setSearchQuery('');
                setAdvFilters({ ...DEFAULT_FILTERS, priceRange: [0, filterMeta.maxPrice], valueRange: [0, filterMeta.maxValue] });
              },
            }}
            secondaryAction={{ label: 'View All Collections', onClick: () => navigate('/collections') }}
            hint="Clearing the search first is usually the fastest way to confirm whether the library filter is narrowing the list too much."
          />
        )
      ) : viewMode === 'grid' ? renderGridView()
        : viewMode === 'covers' ? renderCoversView()
        : viewMode === 'names' ? renderNamesView()
        : renderTableView()
      }

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer to Library</DialogTitle>
            <DialogDescription>
              Move {selectedItems.length} selected item(s) to another library.
            </DialogDescription>
          </DialogHeader>
          <Select value={transferTargetLib} onValueChange={setTransferTargetLib}>
            <SelectTrigger>
              <SelectValue placeholder="Select target library..." />
            </SelectTrigger>
            <SelectContent>
              {categoryLibraries.map((lib) => (
                <SelectItem key={lib.id} value={lib.id}>{lib.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Cancel</Button>
            <Button disabled={!transferTargetLib} onClick={handleBulkTransfer}>Transfer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setItemToDelete(null); }}
        onConfirm={handleDelete}
        title={itemToDelete ? 'Archive Item' : 'Archive Selected Items'}
        description={
          itemToDelete
            ? 'This item will be moved to the archive. You can recover it from Admin > Archive.'
            : `${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''} will be moved to the archive. You can recover them from Admin > Archive.`
        }
        confirmLabel="Archive"
        destructive
      />
    </div>
    </div>

    {/* Inline Detail Side Panel */}
    {detailPanelItemId && (
      <ItemDetailPanel
        itemId={detailPanelItemId}
        onClose={() => {
          updateSearchParam('detail', null);
        }}
      />
    )}
    </div>
    </PageTransition>
  );
}
