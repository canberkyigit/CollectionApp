import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageTransition, MotionGrid, MotionItem, staggerContainer, staggerItem } from '@/components/shared/motion';
import type { Category, CollectionItem, SortField, ViewMode } from '@/types';
import type { FilterState } from '@/components/shared';
import {
  Package,
  Plus,
  LayoutGrid,
  List,
  DollarSign,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  SortAsc,
  SortDesc,
  Star,
  Trash2,
  Download,
  MoreHorizontal,
  Eye,
  Pencil,
  FolderOpen,
  Image,
  AlignJustify,
  ArrowRightLeft,
  X,
  BookOpen,
  Check,
} from 'lucide-react';
import { getCategoryIcon } from '@/lib/icons';

import {
  PageHeader,
  SearchBar,
  EmptyState,
  StatCard,
  ConfirmDialog,
  AdvancedFilters,
  DEFAULT_FILTERS,
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
  calculateGainLoss,
} from '@/lib/utils';
import { currencyService } from '@/services/currencyService';
import { useCollectionStore } from '@/store/useCollectionStore';
import { ItemDetailPanel } from '@/components/shared/ItemDetailPanel';

function getConditionBadgeProps(condition: string) {
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
      return { variant: 'secondary' as const };
  }
}

function getKeyFields(category: Category, item: CollectionItem) {
  const skipKeys = new Set([
    'title', 'condition', 'purchasePrice', 'purchaseCurrency',
    'currentValue', 'estimatedValue', 'purchaseDate', 'notes',
  ]);
  return category.fields
    .filter((f) => !skipKeys.has(f.key) && item.customFields[f.key] != null && item.customFields[f.key] !== '')
    .slice(0, 2)
    .map((f) => ({ label: f.label, value: String(item.customFields[f.key]) }));
}

function itemValue(item: CollectionItem, displayCurrency: string) {
  return currencyService.convert(
    item.purchaseInfo.purchasePrice,
    item.purchaseInfo.purchaseCurrency,
    displayCurrency,
  );
}

function itemPurchasePrice(item: CollectionItem, displayCurrency: string) {
  return currencyService.convert(
    item.purchaseInfo.purchasePrice,
    item.purchaseInfo.purchaseCurrency,
    displayCurrency,
  );
}

const SORT_OPTIONS: { label: string; value: SortField }[] = [
  { label: 'Title', value: 'title' },
  { label: 'Date Added', value: 'createdAt' },
  { label: 'Last Updated', value: 'updatedAt' },
  { label: 'Condition', value: 'condition' },
  { label: 'Publisher', value: 'publisher' },
];

const CONDITION_ORDER: Record<string, number> = {
  Mint: 0, 'Near Mint': 1, 'Very Good': 2, Good: 3, Fair: 4, Poor: 5,
};

export default function CollectionDetail() {
  const navigate = useNavigate();
  const { categorySlug } = useParams<{ categorySlug: string }>();

  const {
    categories,
    items,
    libraries,
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    deleteItem,
    deleteItems,
    getLibrariesByCategory,
    bulkTransferToLibrary,
    openItemDialog,
  } = useCollectionStore();
  const displayCurrency = useCollectionStore((s) => s.displayCurrency);

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [activeLibraryId, setActiveLibraryId] = useState<string>('all');
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTargetLib, setTransferTargetLib] = useState<string>('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [detailPanelItemId, setDetailPanelItemId] = useState<string | null>(
    searchParams.get('detail'),
  );

  useEffect(() => {
    const paramId = searchParams.get('detail');
    if (paramId && paramId !== detailPanelItemId) {
      setDetailPanelItemId(paramId);
    }
  }, [searchParams]);

  useEffect(() => {
    const libParam = searchParams.get('library');
    if (libParam) {
      setActiveLibraryId(libParam);
    }
  }, [searchParams]);

  useEffect(() => {
    setSearchQuery('');
    setSelectedItems([]);
    if (!searchParams.get('library')) {
      setActiveLibraryId('all');
    }
  }, [categorySlug]);

  const category = useMemo(
    () => categories.find((c) => c.slug === categorySlug),
    [categories, categorySlug],
  );

  const categoryLibraries = useMemo(
    () => (category ? getLibrariesByCategory(category.id) : []),
    [category, libraries, getLibrariesByCategory],
  );

  const allCategoryItems = useMemo(
    () => (category ? items.filter((i) => i.categoryId === category.id && !i.isArchived) : []),
    [items, category],
  );

  const libraryFilteredItems = useMemo(() => {
    if (activeLibraryId === 'all') return allCategoryItems;
    if (activeLibraryId === 'unassigned') return allCategoryItems.filter((i) => !i.libraryId);
    return allCategoryItems.filter((i) => i.libraryId === activeLibraryId);
  }, [allCategoryItems, activeLibraryId]);

  const filterMeta = useMemo(() => {
    let maxP = 0;
    let maxV = 0;
    const tagSet = new Set<string>();
    const currencySet = new Set<string>();
    libraryFilteredItems.forEach((i) => {
      const pp = itemPurchasePrice(i, displayCurrency);
      const cv = itemValue(i, displayCurrency);
      if (pp > maxP) maxP = pp;
      if (cv > maxV) maxV = cv;
      i.tags.forEach((t) => tagSet.add(t));
      if (i.purchaseInfo?.purchaseCurrency) currencySet.add(i.purchaseInfo.purchaseCurrency);
    });
    return {
      maxPrice: Math.ceil(maxP),
      maxValue: Math.ceil(maxV),
      tags: [...tagSet].sort(),
      currencies: [...currencySet].sort(),
    };
  }, [libraryFilteredItems, displayCurrency]);

  const [advFilters, setAdvFilters] = useState<FilterState>(() => ({
    ...DEFAULT_FILTERS,
    priceRange: [0, filterMeta.maxPrice],
    valueRange: [0, filterMeta.maxValue],
  }));

  useEffect(() => {
    setAdvFilters({
      ...DEFAULT_FILTERS,
      priceRange: [0, filterMeta.maxPrice],
      valueRange: [0, filterMeta.maxValue],
    });
  }, [categorySlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredItems = useMemo(() => {
    let result = libraryFilteredItems;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => {
        if (item.title.toLowerCase().includes(q)) return true;
        if (item.description.toLowerCase().includes(q)) return true;
        if (item.tags.some((t) => t.toLowerCase().includes(q))) return true;
        if (item.condition.toLowerCase().includes(q)) return true;
        if (item.notes && item.notes.toLowerCase().includes(q)) return true;
        if (item.customFields) {
          for (const val of Object.values(item.customFields)) {
            if (val != null && String(val).toLowerCase().includes(q)) return true;
          }
        }
        return false;
      });
    }

    // Advanced filters
    if (advFilters.conditions.length > 0) {
      result = result.filter((item) => advFilters.conditions.includes(item.condition));
    }

    if (advFilters.priceRange[0] > 0 || (advFilters.priceRange[1] > 0 && advFilters.priceRange[1] < filterMeta.maxPrice)) {
      result = result.filter((item) => {
        const p = itemPurchasePrice(item, displayCurrency);
        return p >= advFilters.priceRange[0] && p <= advFilters.priceRange[1];
      });
    }

    if (advFilters.valueRange[0] > 0 || (advFilters.valueRange[1] > 0 && advFilters.valueRange[1] < filterMeta.maxValue)) {
      result = result.filter((item) => {
        const v = itemValue(item, displayCurrency);
        return v >= advFilters.valueRange[0] && v <= advFilters.valueRange[1];
      });
    }

    if (advFilters.dateFrom) {
      const from = new Date(advFilters.dateFrom).getTime();
      result = result.filter((item) => new Date(item.createdAt).getTime() >= from);
    }
    if (advFilters.dateTo) {
      const to = new Date(advFilters.dateTo).getTime() + 86400000;
      result = result.filter((item) => new Date(item.createdAt).getTime() <= to);
    }

    if (advFilters.tags.length > 0) {
      result = result.filter((item) => advFilters.tags.some((t) => item.tags.includes(t)));
    }

    if (advFilters.favoritesOnly) {
      result = result.filter((item) => item.isFavorite);
    }

    if (advFilters.hasImages === true) {
      result = result.filter((item) => item.images.length > 0);
    } else if (advFilters.hasImages === false) {
      result = result.filter((item) => item.images.length === 0);
    }

    if (advFilters.currencies.length > 0) {
      result = result.filter((item) => advFilters.currencies.includes(item.purchaseInfo?.purchaseCurrency));
    }

    if (advFilters.readStatus === 'read') {
      result = result.filter((item) => item.isRead);
    } else if (advFilters.readStatus === 'unread') {
      result = result.filter((item) => !item.isRead);
    }

    for (const [key, selectedValues] of Object.entries(advFilters.customSelects)) {
      if (selectedValues.length > 0) {
        result = result.filter((item) => {
          const val = item.customFields?.[key];
          return typeof val === 'string' && selectedValues.includes(val);
        });
      }
    }

    for (const [key, val] of Object.entries(advFilters.customBooleans)) {
      if (val !== null) {
        result = result.filter((item) => {
          const fieldVal = item.customFields?.[key];
          return val ? !!fieldVal : !fieldVal;
        });
      }
    }

    return [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'purchasePrice':
          cmp = itemPurchasePrice(a, displayCurrency) - itemPurchasePrice(b, displayCurrency);
          break;
        case 'currentValue':
          cmp = itemValue(a, displayCurrency) - itemValue(b, displayCurrency);
          break;
        case 'condition':
          cmp = (CONDITION_ORDER[a.condition] ?? 99) - (CONDITION_ORDER[b.condition] ?? 99);
          break;
        case 'publisher':
          cmp = String(a.customFields?.publisher ?? '').localeCompare(String(b.customFields?.publisher ?? ''));
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [libraryFilteredItems, searchQuery, advFilters, filterMeta, sortField, sortOrder, displayCurrency]);

  const stats = useMemo(() => {
    const totalValue = libraryFilteredItems.reduce((sum, i) => sum + itemValue(i, displayCurrency), 0);
    const avgValue = libraryFilteredItems.length > 0 ? totalValue / libraryFilteredItems.length : 0;
    const highestValue = libraryFilteredItems.reduce(
      (max, i) => Math.max(max, itemValue(i, displayCurrency)),
      0,
    );
    return { count: libraryFilteredItems.length, totalValue, avgValue, highestValue };
  }, [libraryFilteredItems, displayCurrency]);

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

  if (!category) {
    return (
      <div className="space-y-6">
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

  const renderGridView = () => (
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
      {filteredItems.map((item) => {
        const gainLoss = calculateGainLoss(
          itemPurchasePrice(item, displayCurrency),
          itemValue(item, displayCurrency),
        );
        const keyFields = getKeyFields(category, item);
        const condBadge = getConditionBadgeProps(item.condition);
        const isSelected = selectedItems.includes(item.id);
        const qty = (item.customFields?.quantity as number) || item.quantity || 1;

        return (
          <MotionItem key={item.id} variants={staggerItem}>
            <Card
              className={cn(
                'group cursor-pointer overflow-hidden transition-shadow duration-300',
                'hover:shadow-xl hover:shadow-primary/5',
                isSelected && 'ring-2 ring-primary',
              )}
              onClick={() => setDetailPanelItemId(item.id)}
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
          </MotionItem>
        );
      })}
    </MotionGrid>
  );

  const renderCoversView = () => (
    <MotionGrid
      className="grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      key={`covers-${categorySlug}`}
    >
      {filteredItems.map((item) => {
        const isSelected = selectedItems.includes(item.id);
        return (
          <MotionItem
            key={item.id}
            variants={staggerItem}
            className={cn(
              'group relative cursor-pointer overflow-hidden rounded-lg',
              'hover:shadow-lg',
              isSelected && 'ring-2 ring-primary',
            )}
            onClick={() => setDetailPanelItemId(item.id)}
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
          </MotionItem>
        );
      })}
    </MotionGrid>
  );

  const renderNamesView = () => (
    <Card>
      <div className="divide-y">
        {filteredItems.map((item) => {
          const isSelected = selectedItems.includes(item.id);
          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-muted/50',
                isSelected && 'bg-primary/5',
              )}
              onClick={() => setDetailPanelItemId(item.id)}
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
                {formatCurrency(itemPurchasePrice(item, displayCurrency), displayCurrency)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );

  const renderTableView = () => (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-12 px-4 py-3 text-left">
                <Checkbox
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
                      onClick={() => setDetailPanelItemId(item.id)}
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
                        <DropdownMenuItem onClick={() => setDetailPanelItemId(item.id)}>
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
      <div className="space-y-4 sm:space-y-6">
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
            onClick={() => { setActiveLibraryId('all'); setSelectedItems([]); setSearchParams((p) => { p.set('library', 'all'); return p; }, { replace: true }); }}
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
                onClick={() => { setActiveLibraryId(lib.id); setSelectedItems([]); setSearchParams((p) => { p.set('library', lib.id); return p; }, { replace: true }); }}
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
            onClick={() => { setActiveLibraryId('unassigned'); setSelectedItems([]); setSearchParams((p) => { p.set('library', 'unassigned'); return p; }, { replace: true }); }}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:py-2 sm:text-sm',
              activeLibraryId === 'unassigned' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Unassigned
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {allCategoryItems.filter((i) => !i.libraryId).length}
            </Badge>
          </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <MotionGrid className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))' }} variants={staggerContainer} initial="hidden" animate="visible" key={`stats-${categorySlug}`}>
        <MotionItem variants={staggerItem}><StatCard title="Items" value={formatNumber(stats.count)} icon={Package} /></MotionItem>
        <MotionItem variants={staggerItem}><StatCard title="Total Value" value={formatCurrency(stats.totalValue, displayCurrency)} icon={DollarSign} /></MotionItem>
        <MotionItem variants={staggerItem}><StatCard title="Average Value" value={formatCurrency(stats.avgValue, displayCurrency)} icon={TrendingUp} /></MotionItem>
        <MotionItem variants={staggerItem}><StatCard title="Highest Value" value={formatCurrency(stats.highestValue, displayCurrency)} icon={Star} /></MotionItem>
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
            title="No items yet"
            description="Start adding items to your collection"
            action={{ label: 'Add First Item', onClick: () => category && openItemDialog(category.id) }}
          />
        ) : (
          <EmptyState
            icon={Package}
            title="No matching items"
            description="Try adjusting your search or filters"
            action={{
              label: 'Clear Filters',
              onClick: () => {
                setSearchQuery('');
                setAdvFilters({ ...DEFAULT_FILTERS, priceRange: [0, filterMeta.maxPrice], valueRange: [0, filterMeta.maxValue] });
              },
            }}
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
          setDetailPanelItemId(null);
          setSearchParams((p) => { p.delete('detail'); return p; }, { replace: true });
        }}
      />
    )}
    </div>
    </PageTransition>
  );
}
