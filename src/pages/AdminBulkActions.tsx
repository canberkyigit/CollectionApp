import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  AlertTriangle,
  Banknote,
  Filter,
  FolderInput,
  Library as LibraryIcon,
  MapPin,
  Package,
  Search,
  Star,
  StarOff,
  Tag,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { BulkFieldPopover } from '@/components/bulk/BulkFieldPopover';
import { TagManager } from '@/components/settings/TagManager';
import { ConfirmDialog, PageHeader, VirtualList } from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useT } from '@/i18n';
import { getAdminBreadcrumbs } from '@/lib/adminNavigation';
import { libraryMatchesCategory } from '@/lib/libraries';
import { cn, formatCurrency } from '@/lib/utils';
import { currencyService } from '@/services/currencyService';
import { useCollectionStore } from '@/store/useCollectionStore';
import type { CollectionItem } from '@/types';
import { getConditionScale } from '@/lib/conditionScales';
import { conditionLabel } from '@/components/collections/conditionLabel';

const VIRTUAL_THRESHOLD = 80;
const NO_LIBRARY = '__none__';
const GRID_COLUMNS = 'grid grid-cols-12';

export default function AdminBulkActions() {
  const t = useT();
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const displayCurrency = useCollectionStore((s) => s.displayCurrency);
  const items = useCollectionStore((s) => s.items);
  const categories = useCollectionStore((s) => s.categories);
  const libraries = useCollectionStore((s) => s.libraries);
  const deleteItems = useCollectionStore((s) => s.deleteItems);
  const bulkMoveItems = useCollectionStore((s) => s.bulkMoveItems);
  const bulkUpdateCondition = useCollectionStore((s) => s.bulkUpdateCondition);
  const bulkAddTag = useCollectionStore((s) => s.bulkAddTag);
  const bulkToggleFavorite = useCollectionStore((s) => s.bulkToggleFavorite);
  const bulkTransferToLibrary = useCollectionStore((s) => s.bulkTransferToLibrary);
  const bulkUpdateItems = useCollectionStore((s) => s.bulkUpdateItems);
  const bulkSetCustomField = useCollectionStore((s) => s.bulkSetCustomField);
  const bulkRemoveTag = useCollectionStore((s) => s.bulkRemoveTag);
  const bulkSetCurrentValue = useCollectionStore((s) => s.bulkSetCurrentValue);
  const getCategoryById = useCollectionStore((s) => s.getCategoryById);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [locationInput, setLocationInput] = useState('');
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
  const [valueInput, setValueInput] = useState('');
  const [valueCurrency, setValueCurrency] = useState(displayCurrency);
  const [valuePopoverOpen, setValuePopoverOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  const filteredItems = useMemo(() => {
    let result = items;
    if (categoryFilter !== 'all') {
      result = result.filter((item) => item.categoryId === categoryFilter);
    }
    const q = searchQuery.trim().toLocaleLowerCase();
    if (q) {
      result = result.filter((item) => item.title.toLocaleLowerCase().includes(q));
    }
    return result;
  }, [items, categoryFilter, searchQuery]);

  const allSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));
  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const selectedItems = useMemo(() => items.filter((item) => selectedIds.has(item.id)), [items, selectedIds]);
  const hasSelection = selectedIds.size > 0;
  const count = selectedArray.length;
  const filterCategory = categoryFilter === 'all' ? undefined : getCategoryById(categoryFilter);

  const selectedTags = useMemo(
    () => [...new Set(selectedItems.flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b)),
    [selectedItems],
  );
  const selectableLibraries = useMemo(() => {
    const categoryIds = new Set(selectedItems.map((item) => item.categoryId));
    if (categoryIds.size === 0) return libraries;
    return libraries.filter((library) => [...categoryIds].every((id) => libraryMatchesCategory(library, id)));
  }, [libraries, selectedItems]);

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(filteredItems.map((item) => item.id)));
  };

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const done = (message: string) => {
    toast.success(message);
    setSelectedIds(new Set());
  };

  const handleMove = (targetCategoryId: string) => {
    bulkMoveItems(selectedArray, targetCategoryId);
    done(t('bulk.toast.moved', { count, category: getCategoryById(targetCategoryId)?.name ?? '' }));
  };

  const handleCondition = (condition: string) => {
    bulkUpdateCondition(selectedArray, condition);
    done(t('bulk.toast.condition', { count, condition }));
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    bulkAddTag(selectedArray, tag);
    setTagInput('');
    setTagPopoverOpen(false);
    done(t('bulk.toast.tagAdded', { count, tag }));
  };

  const handleRemoveTag = (tag: string) => {
    bulkRemoveTag(selectedArray, tag);
    done(t('bulk.toast.tagRemoved', { count, tag }));
  };

  const handleLibrary = (libraryId: string) => {
    if (libraryId === NO_LIBRARY) {
      bulkUpdateItems(selectedArray, { libraryId: undefined }, 'Bulk removed from library');
      done(t('bulk.toast.libraryCleared', { count }));
      return;
    }
    bulkTransferToLibrary(selectedArray, libraryId);
    done(t('bulk.toast.library', { count, library: libraries.find((entry) => entry.id === libraryId)?.name ?? '' }));
  };

  const handleLocation = () => {
    const location = locationInput.trim();
    bulkUpdateItems(
      selectedArray,
      { location: location || undefined },
      location ? `Bulk location set to "${location}"` : 'Bulk location cleared',
    );
    setLocationInput('');
    setLocationPopoverOpen(false);
    done(location ? t('bulk.toast.location', { count, location }) : t('bulk.toast.locationCleared', { count }));
  };

  const parsedValue = Number(valueInput.replace(',', '.'));
  const valueIsValid = valueInput.trim() !== '' && Number.isFinite(parsedValue) && parsedValue >= 0;
  const handleValue = () => {
    if (!valueIsValid) return;
    bulkSetCurrentValue(selectedArray, parsedValue, valueCurrency);
    setValueInput('');
    setValuePopoverOpen(false);
    done(t('bulk.toast.value', { count, value: formatCurrency(parsedValue, valueCurrency) }));
  };

  const handleToggleFavorite = () => {
    const anyUnfavorited = selectedItems.some((item) => !item.isFavorite);
    bulkToggleFavorite(selectedArray, anyUnfavorited);
    done(t(anyUnfavorited ? 'bulk.toast.favorited' : 'bulk.toast.unfavorited', { count }));
  };

  const handleDelete = () => {
    deleteItems(selectedArray);
    setShowDeleteDialog(false);
    done(t('bulk.toast.deleted', { count }));
  };

  const columnHeaders = (
    <>
      <div className="col-span-5 px-3 py-3 sm:col-span-4 md:col-span-3">{t('bulk.col.title')}</div>
      <div className="col-span-2 hidden px-3 py-3 sm:block">{t('bulk.col.category')}</div>
      <div className="col-span-2 hidden px-3 py-3 md:block">{t('bulk.col.condition')}</div>
      <div className="col-span-3 px-3 py-3 text-right sm:col-span-2 md:col-span-1">{t('bulk.col.value')}</div>
      <div className="col-span-3 hidden px-3 py-3 md:col-span-4 md:block">{t('bulk.col.tags')}</div>
    </>
  );

  const renderCells = (item: CollectionItem) => {
    const category = getCategoryById(item.categoryId);
    const value = currencyService.convert(
      item.valuationInfo.currentEstimatedValue,
      item.valuationInfo.currentValueCurrency,
      displayCurrency,
    );
    const checkboxId = `bulk-item-${item.id}`;
    return (
      <>
        <div className="col-span-5 min-w-0 px-3 py-3 sm:col-span-4 md:col-span-3">
          <label htmlFor={checkboxId} className="block cursor-pointer truncate font-medium">{item.title}</label>
          {item.location && <span className="block truncate text-xs text-muted-foreground">{item.location}</span>}
        </div>
        <div className="col-span-2 hidden truncate px-3 py-3 text-muted-foreground sm:block">{category?.name ?? '—'}</div>
        <div className="col-span-2 hidden min-w-0 px-3 py-3 md:block">
          <Badge variant="outline" className="max-w-full truncate text-xs">{conditionLabel(t, item.condition)}</Badge>
        </div>
        <div className="col-span-3 px-3 py-3 text-right font-mono text-xs tabular-nums sm:col-span-2 md:col-span-1">
          {formatCurrency(value, displayCurrency)}
        </div>
        <div className="col-span-3 hidden min-w-0 px-3 py-3 md:col-span-4 md:block">
          <div className="flex min-w-0 flex-nowrap gap-1 overflow-hidden">
            {item.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="min-w-0 max-w-[9rem] text-xs" title={tag}>
                <span className="truncate">{tag}</span>
              </Badge>
            ))}
            {item.tags.length > 3 && (
              <Badge variant="secondary" className="shrink-0 text-xs">+{item.tags.length - 3}</Badge>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderRow = (item: CollectionItem) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <div
        className={cn(
          'flex items-stretch border-b text-sm transition-colors hover:bg-muted/30',
          isSelected && 'bg-primary/5 hover:bg-primary/5',
        )}
      >
        <div className="flex w-12 shrink-0 items-center justify-center">
          <Checkbox
            id={`bulk-item-${item.id}`}
            checked={isSelected}
            onCheckedChange={() => toggleItem(item.id)}
            aria-label={t('bulk.selectItem', { title: item.title })}
          />
        </div>
        <div className={cn(GRID_COLUMNS, 'min-w-0 flex-1 items-center')}>{renderCells(item)}</div>
        <div className="flex w-14 shrink-0 items-center justify-center">
          {item.isFavorite ? (
            <Star className="size-4 fill-yellow-400 text-yellow-400" aria-label={t('bulk.favorite')} />
          ) : (
            <StarOff className="size-4 text-muted-foreground/40" aria-hidden="true" />
          )}
        </div>
      </div>
    );
  };

  const actionTriggerClass = 'h-9 w-auto gap-2';

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title={t('bulk.title')}
          description={t('bulk.description')}
          breadcrumbs={getAdminBreadcrumbs(search ? `?${search}` : '', [{ label: t('bulk.title') }])}
        >
          <Button variant="outline" className="gap-2" onClick={() => setTagManagerOpen(true)}>
            <Tags className="size-4" />
            {t('bulk.manageTags')}
          </Button>
        </PageHeader>

        <Card>
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder={t('bulk.search')}
                aria-label={t('bulk.search')}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <Select value={categoryFilter} onValueChange={(next) => { setCategoryFilter(next); setSelectedIds(new Set()); }}>
                <SelectTrigger className="w-full sm:w-[200px]" aria-label={t('bulk.filterCategory')}>
                  <SelectValue placeholder={t('bulk.allCategories')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('bulk.allCategories')}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className={cn('transition-colors', hasSelection && 'border-primary/30 bg-primary/5')}>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={hasSelection ? 'secondary' : 'outline'} className="text-sm tabular-nums">
                {t('bulk.selected', { count: selectedIds.size })}
              </Badge>
              {hasSelection && (
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setSelectedIds(new Set())}>
                  <X className="size-4" />
                  {t('bulk.clearSelection')}
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Select value="" onValueChange={handleMove} disabled={!hasSelection}>
                <SelectTrigger className={actionTriggerClass} disabled={!hasSelection} aria-label={t('bulk.moveTo')}>
                  <FolderInput className="size-4" />
                  <span>{t('bulk.moveTo')}</span>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value="" onValueChange={handleCondition} disabled={!hasSelection}>
                <SelectTrigger className={actionTriggerClass} disabled={!hasSelection} aria-label={t('bulk.setCondition')}>
                  <Package className="size-4" />
                  <span>{t('bulk.setCondition')}</span>
                </SelectTrigger>
                <SelectContent>
                  {getConditionScale(filterCategory).map(({ value: condition }) => (
                    <SelectItem key={condition} value={condition}>{conditionLabel(t, condition)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value="" onValueChange={handleLibrary} disabled={!hasSelection}>
                <SelectTrigger className={actionTriggerClass} disabled={!hasSelection} aria-label={t('bulk.setLibrary')}>
                  <LibraryIcon className="size-4" />
                  <span>{t('bulk.setLibrary')}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LIBRARY}>{t('bulk.noLibrary')}</SelectItem>
                  {selectableLibraries.map((library) => (
                    <SelectItem key={library.id} value={library.id}>{library.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />

              <Popover open={locationPopoverOpen} onOpenChange={setLocationPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" disabled={!hasSelection}>
                    <MapPin className="size-4" />
                    {t('bulk.setLocation')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 space-y-3" align="start">
                  <Label htmlFor="bulk-location" className="text-sm font-medium">{t('bulk.locationTitle')}</Label>
                  <Input
                    id="bulk-location"
                    placeholder={t('bulk.locationPlaceholder')}
                    value={locationInput}
                    onChange={(event) => setLocationInput(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && handleLocation()}
                  />
                  <p className="text-xs text-muted-foreground">{t('bulk.locationHint')}</p>
                  <Button size="sm" className="w-full" onClick={handleLocation}>{t('bulk.apply')}</Button>
                </PopoverContent>
              </Popover>

              <Popover open={valuePopoverOpen} onOpenChange={setValuePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" disabled={!hasSelection}>
                    <Banknote className="size-4" />
                    {t('bulk.setValue')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 space-y-3" align="start">
                  <p className="text-sm font-medium">{t('bulk.valueTitle')}</p>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="bulk-value" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t('bulk.valueAmount')}</Label>
                      <Input
                        id="bulk-value"
                        inputMode="decimal"
                        value={valueInput}
                        onChange={(event) => setValueInput(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && handleValue()}
                        className="tabular-nums"
                      />
                    </div>
                    <div className="w-24 space-y-1.5">
                      <Label htmlFor="bulk-value-currency" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t('bulk.valueCurrency')}</Label>
                      <Select value={valueCurrency} onValueChange={setValueCurrency}>
                        <SelectTrigger id="bulk-value-currency"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {currencyService.getSupportedCurrencies().map((currency) => (
                            <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('bulk.valueHint')}</p>
                  <Button size="sm" className="w-full" onClick={handleValue} disabled={!valueIsValid}>{t('bulk.apply')}</Button>
                </PopoverContent>
              </Popover>

              <BulkFieldPopover
                fields={filterCategory?.fields ?? []}
                disabled={!hasSelection || !filterCategory}
                disabledReason={t('bulk.field.needsCategory')}
                onApply={(field, value) => {
                  bulkSetCustomField(selectedArray, field.key, value);
                  done(value === undefined
                    ? t('bulk.toast.fieldCleared', { count, field: field.label })
                    : t('bulk.toast.field', { count, field: field.label }));
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t pt-3">
              <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" disabled={!hasSelection}>
                    <Tag className="size-4" />
                    {t('bulk.addTag')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 space-y-3" align="start">
                  <Label htmlFor="bulk-add-tag" className="text-sm font-medium">{t('bulk.addTagTitle')}</Label>
                  <Input
                    id="bulk-add-tag"
                    placeholder={t('bulk.tagPlaceholder')}
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && handleAddTag()}
                  />
                  <Button size="sm" className="w-full" onClick={handleAddTag} disabled={!tagInput.trim()}>
                    {t('bulk.addTag')}
                  </Button>
                </PopoverContent>
              </Popover>

              <Select value="" onValueChange={handleRemoveTag} disabled={!hasSelection || selectedTags.length === 0}>
                <SelectTrigger
                  className={actionTriggerClass}
                  disabled={!hasSelection || selectedTags.length === 0}
                  aria-label={t('bulk.removeTag')}
                >
                  <X className="size-4" />
                  <span>{t('bulk.removeTag')}</span>
                </SelectTrigger>
                <SelectContent>
                  {selectedTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" className="gap-2" onClick={handleToggleFavorite} disabled={!hasSelection}>
                <Star className="size-4" />
                {t('bulk.toggleFavorite')}
              </Button>

              <div className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />

              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={() => setShowDeleteDialog(true)}
                disabled={!hasSelection}
              >
                <Trash2 className="size-4" />
                {t('bulk.deleteSelected')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-stretch border-b bg-muted/50 text-sm font-medium text-muted-foreground">
            <div className="flex w-12 shrink-0 items-center justify-center">
              <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label={t('bulk.selectAll')} />
            </div>
            <div className={cn(GRID_COLUMNS, 'min-w-0 flex-1')}>{columnHeaders}</div>
            <div className="flex w-14 shrink-0 items-center justify-center">
              <Star className="size-4" aria-hidden="true" />
              <span className="sr-only">{t('bulk.favorite')}</span>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-muted-foreground">
              <AlertTriangle className="size-8 text-muted-foreground/40" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">{t('bulk.emptyTitle')}</p>
              <p className="text-sm">{t('bulk.emptyDescription')}</p>
            </div>
          ) : filteredItems.length > VIRTUAL_THRESHOLD ? (
            <VirtualList
              items={filteredItems}
              threshold={VIRTUAL_THRESHOLD}
              estimateSize={57}
              getItemKey={(item) => item.id}
              renderItem={renderRow}
              viewportHeight="min(72vh, 720px)"
            />
          ) : (
            <div role="list">
              {filteredItems.map((item) => (
                <div key={item.id} role="listitem">{renderRow(item)}</div>
              ))}
            </div>
          )}
        </Card>

        <ConfirmDialog
          open={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDelete}
          title={t('bulk.deleteTitle')}
          description={t('bulk.deleteBody', { count: selectedIds.size })}
          confirmLabel={t('common.delete')}
          destructive
        />

        <Dialog open={tagManagerOpen} onOpenChange={setTagManagerOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
              <Tags className="size-5 text-primary" aria-hidden="true" />
              {t('data.tags.title')}
            </DialogTitle>
              <DialogDescription>{t('data.tags.description')}</DialogDescription>
            </DialogHeader>
            <TagManager />
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
