import { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  ExternalLink,
  Filter,
  Heart,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Star,
  Tag,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import type { WishlistItem } from '@/types';
import {
  PageHeader,
  EmptyState,
  SearchBar,
  LoadingSkeleton,
  StatCard,
  ConfirmDialog,
} from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { useT } from '@/i18n';
import { ITEM_FORM_CURRENCIES } from '@/lib/itemForm';
import { cn, formatCurrency, formatNumber, formatRelativeDate } from '@/lib/utils';
import { currencyService } from '@/services/currencyService';
import { useAuthStore } from '@/store/useAuthStore';
import { useCollectionStore } from '@/store/useCollectionStore';
import { selectIsColdLoading } from '@/store/collectionStore.selectors';

type Priority = WishlistItem['priority'];

const PRIORITIES: Priority[] = ['must-have', 'high', 'medium', 'low'];

function getPriorityStyles(priority: Priority) {
  switch (priority) {
    case 'must-have':
      return 'border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-400';
    case 'high':
      return 'border-orange-500/30 bg-orange-500/15 text-orange-700 dark:text-orange-400';
    case 'medium':
      return 'border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-400';
    default:
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400';
  }
}

interface FormState {
  title: string;
  description: string;
  categoryId: string;
  targetPrice: string;
  targetCurrency: string;
  priority: Priority;
  source: string;
  sourceUrl: string;
  notes: string;
  tags: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  categoryId: '',
  targetPrice: '',
  targetCurrency: 'USD',
  priority: 'medium',
  source: '',
  sourceUrl: '',
  notes: '',
  tags: '',
};

export default function Wishlist() {
  const t = useT();
  const navigate = useNavigate();
  const {
    wishlist,
    categories,
    items,
    addWishlistItem,
    updateWishlistItem,
    deleteWishlistItem,
    getCategoryById,
    openItemDialog,
    ownerUserId,
    isRemoteDataLoading,
  } = useCollectionStore();
  const user = useAuthStore((state) => state.user);
  const displayCurrency = useCollectionStore((s) => s.displayCurrency);
  const shouldShowLoadingState = selectIsColdLoading(
    { ownerUserId, isRemoteDataLoading },
    [wishlist.length, categories.length],
  );
  const currencies = ITEM_FORM_CURRENCIES as readonly string[];

  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [showAcquired, setShowAcquired] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const [itemToAcquire, setItemToAcquire] = useState<WishlistItem | null>(null);
  const [acquireCategoryId, setAcquireCategoryId] = useState('');

  const activeItems = useMemo(() => wishlist.filter((w) => !w.isAcquired), [wishlist]);

  const stats = useMemo(() => {
    const totalValue = activeItems.reduce(
      (sum, w) =>
        sum +
        (w.targetPrice != null && w.targetPrice > 0
          ? currencyService.convert(w.targetPrice, w.targetCurrency ?? 'USD', displayCurrency)
          : 0),
      0,
    );
    const mustHaveCount = activeItems.filter((w) => w.priority === 'must-have').length;
    return { total: activeItems.length, totalValue, mustHaveCount };
  }, [activeItems, displayCurrency]);

  const filteredItems = useMemo(() => {
    let result = wishlist;

    if (!showAcquired) {
      result = result.filter((w) => !w.isAcquired);
    }

    if (priorityFilter !== 'all') {
      result = result.filter((w) => w.priority === priorityFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLocaleLowerCase();
      result = result.filter(
        (w) =>
          w.title.toLocaleLowerCase().includes(q) ||
          w.description.toLocaleLowerCase().includes(q) ||
          w.tags.some((tag) => tag.toLocaleLowerCase().includes(q)) ||
          (w.source?.toLocaleLowerCase().includes(q) ?? false),
      );
    }

    return result;
  }, [wishlist, showAcquired, priorityFilter, searchQuery]);

  const openAdd = useCallback(() => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((item: WishlistItem) => {
    setEditingItem(item);
    setForm({
      title: item.title,
      description: item.description,
      categoryId: item.categoryId,
      targetPrice: item.targetPrice?.toString() ?? '',
      targetCurrency: item.targetCurrency ?? 'USD',
      priority: item.priority,
      source: item.source ?? '',
      sourceUrl: item.sourceUrl ?? '',
      notes: item.notes ?? '',
      tags: item.tags.join(', '),
    });
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!form.title.trim()) {
      toast.error(t('wishlist.toast.titleRequired'));
      return;
    }

    const parsedTags = form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      categoryId: form.categoryId,
      targetPrice: form.targetPrice ? Number(form.targetPrice) : undefined,
      targetCurrency: form.targetPrice ? form.targetCurrency : undefined,
      priority: form.priority,
      source: form.source.trim() || undefined,
      sourceUrl: form.sourceUrl.trim() || undefined,
      notes: form.notes.trim() || undefined,
      images: editingItem?.images ?? ([] as string[]),
      tags: parsedTags,
      addedBy: editingItem?.addedBy ?? user?.uid ?? 'offline',
    };

    if (editingItem) {
      updateWishlistItem(editingItem.id, payload);
      toast.success(t('wishlist.toast.updated'));
    } else {
      addWishlistItem(payload);
      toast.success(t('wishlist.toast.added'));
    }

    setDialogOpen(false);
    setEditingItem(null);
    setForm(EMPTY_FORM);
  }, [form, editingItem, addWishlistItem, updateWishlistItem, user?.uid, t]);

  const handleDelete = useCallback(() => {
    if (itemToDelete) {
      deleteWishlistItem(itemToDelete);
      toast.success(t('wishlist.toast.removed'));
    }
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  }, [itemToDelete, deleteWishlistItem, t]);

  const openAcquire = useCallback(
    (item: WishlistItem) => {
      setItemToAcquire(item);
      const hasCategory = categories.some((category) => category.id === item.categoryId);
      setAcquireCategoryId(hasCategory ? item.categoryId : categories[0]?.id ?? '');
    },
    [categories],
  );

  const closeAcquire = useCallback(() => {
    setItemToAcquire(null);
    setAcquireCategoryId('');
  }, []);

  const handleMarkAcquired = useCallback(() => {
    if (itemToAcquire) {
      updateWishlistItem(itemToAcquire.id, { isAcquired: true });
      toast.success(t('wishlist.toast.acquired', { title: itemToAcquire.title }));
    }
    closeAcquire();
  }, [itemToAcquire, updateWishlistItem, closeAcquire, t]);

  const handleCreateItem = useCallback(() => {
    if (!itemToAcquire || !acquireCategoryId) return;
    const entry = itemToAcquire;
    closeAcquire();
    openItemDialog(acquireCategoryId, undefined, {
      prefill: {
        title: entry.title,
        description: entry.description || undefined,
        images: entry.images,
        tags: entry.tags,
        notes: entry.notes,
        purchasePrice: entry.targetPrice,
        purchaseCurrency: entry.targetCurrency,
        purchasePlace: entry.source,
      },
      wishlistId: entry.id,
    });
  }, [itemToAcquire, acquireCategoryId, closeAcquire, openItemDialog]);

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const hasFilters = Boolean(searchQuery) || priorityFilter !== 'all';

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title={t('wishlist.title')}
          description={t('wishlist.description')}
          breadcrumbs={[{ label: t('wishlist.title') }]}
        >
          <Button onClick={openAdd}>
            <Plus className="size-4" />
            {t('wishlist.addItem')}
          </Button>
        </PageHeader>

        {shouldShowLoadingState ? (
          <div className="space-y-4">
            <LoadingSkeleton variant="list" count={3} />
            <LoadingSkeleton variant="card" count={6} />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                title={t('wishlist.stats.items')}
                value={formatNumber(stats.total)}
                icon={Heart}
                subtitle={t('wishlist.stats.itemsHint')}
              />
              <StatCard
                title={t('wishlist.stats.targetValue')}
                value={formatCurrency(stats.totalValue, displayCurrency)}
                icon={Target}
                subtitle={t('wishlist.stats.targetValueHint')}
              />
              <StatCard
                title={t('wishlist.stats.mustHave')}
                value={formatNumber(stats.mustHaveCount)}
                icon={Star}
                subtitle={t('wishlist.stats.mustHaveHint')}
              />
            </div>

            {/* Filter bar */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t('wishlist.searchPlaceholder')}
                className="lg:w-80"
              />

              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="flex items-center gap-0.5 rounded-lg border p-0.5"
                  role="group"
                  aria-label={t('wishlist.priorityFilter')}
                >
                  {(['all', ...PRIORITIES] as const).map((value) => (
                    <Button
                      key={value}
                      variant={priorityFilter === value ? 'default' : 'ghost'}
                      size="sm"
                      aria-pressed={priorityFilter === value}
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setPriorityFilter(value)}
                    >
                      {value === 'all' ? t('common.all') : t(`wishlist.priority.${value}`)}
                    </Button>
                  ))}
                </div>

                <Separator orientation="vertical" className="hidden h-6 lg:block" />

                <Button
                  variant={showAcquired ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  aria-pressed={showAcquired}
                  onClick={() => setShowAcquired((prev) => !prev)}
                >
                  {showAcquired ? <X className="size-3" /> : <Filter className="size-3" />}
                  {showAcquired ? t('wishlist.hideAcquired') : t('wishlist.showAcquired')}
                </Button>
              </div>
            </div>

            {/* Grid */}
            {filteredItems.length === 0 ? (
              <EmptyState
                icon={Heart}
                eyebrow={t('wishlist.empty.eyebrow')}
                title={t('wishlist.empty.title')}
                description={hasFilters ? t('wishlist.empty.filtered') : t('wishlist.empty.description')}
                action={
                  hasFilters
                    ? {
                        label: t('wishlist.empty.clearFilters'),
                        onClick: () => {
                          setSearchQuery('');
                          setPriorityFilter('all');
                        },
                      }
                    : { label: t('wishlist.empty.addFirst'), onClick: openAdd }
                }
                secondaryAction={
                  hasFilters ? undefined : { label: t('wishlist.empty.browse'), onClick: () => navigate('/collections') }
                }
                hint={hasFilters ? t('wishlist.empty.filteredHint') : t('wishlist.empty.hint')}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
                {filteredItems.map((item) => {
                  const category = getCategoryById(item.categoryId);
                  const acquiredItem = item.acquiredItemId
                    ? items.find((candidate) => candidate.id === item.acquiredItemId)
                    : undefined;

                  return (
                    <Card
                      key={item.id}
                      className={cn(
                        'group relative overflow-hidden transition-all duration-300',
                        'hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/5',
                      )}
                    >
                      {/* Warm gradient accent */}
                      <div
                        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-400/70 via-amber-400/50 to-orange-400/30 opacity-60 transition-opacity duration-300 group-hover:opacity-100"
                        aria-hidden="true"
                      />

                      {/* Acquired overlay (actions stay usable above it) */}
                      {item.isAcquired && (
                        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                          <div className="flex items-center gap-2 rounded-full bg-green-500/15 px-4 py-2 text-green-700 dark:text-green-400">
                            <ShoppingCart className="size-5" aria-hidden="true" />
                            <span className="text-sm font-semibold">{t('wishlist.acquired')}</span>
                          </div>
                        </div>
                      )}

                      <CardContent className="relative p-5">
                        {/* Priority badge */}
                        <div className="absolute right-4 top-4">
                          <Badge variant="outline" className={cn('text-[11px] font-semibold', getPriorityStyles(item.priority))}>
                            {t(`wishlist.priority.${item.priority}`)}
                          </Badge>
                        </div>

                        {/* Title & description */}
                        <div className="pr-20">
                          <h3 className="line-clamp-1 text-lg font-semibold leading-tight tracking-tight">{item.title}</h3>
                          {item.description && (
                            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 space-y-2.5 text-sm">
                          {category && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Package className="size-3.5 shrink-0" aria-hidden="true" />
                              <span>{category.name}</span>
                            </div>
                          )}

                          {item.targetPrice != null && item.targetPrice > 0 && (
                            <div className="flex items-center gap-2">
                              <Target className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                              <span className="sr-only">{t('wishlist.field.targetPrice')}: </span>
                              <span className="font-semibold tabular-nums">
                                {formatCurrency(
                                  currencyService.convert(item.targetPrice, item.targetCurrency ?? 'USD', displayCurrency),
                                  displayCurrency,
                                )}
                              </span>
                            </div>
                          )}

                          {item.source && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Search className="size-3.5 shrink-0" aria-hidden="true" />
                              <span className="truncate">{item.source}</span>
                              {item.sourceUrl && (
                                <a
                                  href={item.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 text-primary hover:text-primary/80"
                                  aria-label={t('wishlist.openSource', { source: item.source })}
                                >
                                  <ExternalLink className="size-3.5" aria-hidden="true" />
                                </a>
                              )}
                            </div>
                          )}

                          {item.tags.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 pt-0.5">
                              <Tag className="mr-0.5 size-3 text-muted-foreground" aria-hidden="true" />
                              {item.tags.slice(0, 4).map((tag) => (
                                <Badge key={tag} variant="outline" className="px-1.5 py-0 text-[10px]">
                                  {tag}
                                </Badge>
                              ))}
                              {item.tags.length > 4 && (
                                <Badge variant="outline" className="px-1.5 py-0 text-[10px] tabular-nums">
                                  +{item.tags.length - 4}
                                </Badge>
                              )}
                            </div>
                          )}

                          <p className="pt-0.5 text-xs text-muted-foreground/70">
                            {t('wishlist.addedWhen', { when: formatRelativeDate(item.createdAt) })}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="relative z-20 mt-4 flex items-center gap-1.5 border-t pt-3">
                          {!item.isAcquired && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs text-green-600 hover:bg-green-500/10 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                              onClick={() => openAcquire(item)}
                            >
                              <ShoppingCart className="size-3.5" />
                              {t('wishlist.acquire')}
                            </Button>
                          )}
                          {item.isAcquired && acquiredItem && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs text-primary hover:bg-primary/10 hover:text-primary"
                              asChild
                            >
                              <Link to={`/items/${acquiredItem.id}`}>
                                <ArrowUpRight className="size-3.5" aria-hidden="true" />
                                {t('wishlist.viewItem')}
                              </Link>
                            </Button>
                          )}
                          <div className="flex-1" />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            aria-label={t('wishlist.editNamed', { title: item.title })}
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            aria-label={t('wishlist.deleteNamed', { title: item.title })}
                            onClick={() => {
                              setItemToDelete(item.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Add / edit dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingItem ? t('wishlist.dialog.editTitle') : t('wishlist.dialog.addTitle')}</DialogTitle>
              <DialogDescription>
                {editingItem ? t('wishlist.dialog.editDescription') : t('wishlist.dialog.addDescription')}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="wl-title">{t('wishlist.field.title')} *</Label>
                <Input
                  id="wl-title"
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder={t('wishlist.field.titlePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wl-desc">{t('wishlist.field.description')}</Label>
                <Textarea
                  id="wl-desc"
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder={t('wishlist.field.descriptionPlaceholder')}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wl-category">{t('wishlist.field.category')}</Label>
                <Select value={form.categoryId} onValueChange={(v) => updateField('categoryId', v)}>
                  <SelectTrigger id="wl-category">
                    <SelectValue placeholder={t('wishlist.field.categoryPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="wl-price">{t('wishlist.field.targetPrice')}</Label>
                  <Input
                    id="wl-price"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    className="tabular-nums"
                    value={form.targetPrice}
                    onChange={(e) => updateField('targetPrice', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wl-currency">{t('wishlist.field.currency')}</Label>
                  <Select value={form.targetCurrency} onValueChange={(v) => updateField('targetCurrency', v)}>
                    <SelectTrigger id="wl-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(currencies.includes(form.targetCurrency) ? currencies : [form.targetCurrency, ...currencies]).map(
                        (c) => (
                          <SelectItem key={c} value={c}>
                            {currencyService.getCurrencySymbol(c)} {c}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wl-priority">{t('wishlist.field.priority')}</Label>
                <Select value={form.priority} onValueChange={(v) => updateField('priority', v as Priority)}>
                  <SelectTrigger id="wl-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {t(`wishlist.priority.${p}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="wl-source">{t('wishlist.field.source')}</Label>
                  <Input
                    id="wl-source"
                    value={form.source}
                    onChange={(e) => updateField('source', e.target.value)}
                    placeholder={t('wishlist.field.sourcePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wl-url">{t('wishlist.field.sourceUrl')}</Label>
                  <Input
                    id="wl-url"
                    type="url"
                    value={form.sourceUrl}
                    onChange={(e) => updateField('sourceUrl', e.target.value)}
                    placeholder="https://…"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wl-notes">{t('wishlist.field.notes')}</Label>
                <Textarea
                  id="wl-notes"
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder={t('wishlist.field.notesPlaceholder')}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wl-tags">{t('wishlist.field.tags')}</Label>
                <Input
                  id="wl-tags"
                  value={form.tags}
                  onChange={(e) => updateField('tags', e.target.value)}
                  placeholder={t('wishlist.field.tagsPlaceholder')}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave}>
                {editingItem ? t('wishlist.dialog.saveChanges') : t('wishlist.dialog.add')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setItemToDelete(null);
          }}
          onConfirm={handleDelete}
          title={t('wishlist.delete.title')}
          description={t('wishlist.delete.description')}
          confirmLabel={t('common.remove')}
          destructive
        />

        {/* Acquire dialog */}
        <Dialog open={itemToAcquire !== null} onOpenChange={(open) => !open && closeAcquire()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('wishlist.acquireDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('wishlist.acquireDialog.description', { title: itemToAcquire?.title ?? '' })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10" aria-hidden="true">
                  <PackagePlus className="size-5 text-primary" />
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{t('wishlist.acquireDialog.createTitle')}</p>
                  <p className="text-muted-foreground">{t('wishlist.acquireDialog.createDescription')}</p>
                </div>
              </div>
              {categories.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="acquire-category">{t('wishlist.acquireDialog.category')}</Label>
                  <Select value={acquireCategoryId} onValueChange={setAcquireCategoryId}>
                    <SelectTrigger id="acquire-category">
                      <SelectValue placeholder={t('wishlist.field.categoryPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('wishlist.acquireDialog.noCategories')}</p>
              )}
            </div>

            <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-500/15" aria-hidden="true">
                <ShoppingCart className="size-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-sm">
                <p className="font-medium">{t('wishlist.acquireDialog.title')}</p>
                <p className="text-muted-foreground">{t('wishlist.acquireDialog.markDescription')}</p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleMarkAcquired}>
                <ShoppingCart className="size-4" />
                {t('wishlist.acquireDialog.justMark')}
              </Button>
              <Button onClick={handleCreateItem} disabled={!acquireCategoryId}>
                <PackagePlus className="size-4" />
                {t('wishlist.acquireDialog.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
