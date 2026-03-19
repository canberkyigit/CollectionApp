import { useState, useMemo, useCallback } from 'react';

import type { WishlistItem } from '@/types';
import {
  Heart,
  Plus,
  Star,
  ExternalLink,
  ShoppingCart,
  Trash2,
  Pencil,
  Target,
  Tag,
  Filter,
  X,
  Package,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  PageHeader,
  EmptyState,
  SearchBar,
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
import { cn, formatCurrency, formatRelativeDate, generateId } from '@/lib/utils';
import { currencyService } from '@/services/currencyService';
import { useCollectionStore } from '@/store/useCollectionStore';

type Priority = WishlistItem['priority'];

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'must-have', label: 'Must-Have' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const CURRENCIES = ['USD', 'EUR', 'TRY', 'GBP'] as const;

function getPriorityStyles(priority: Priority) {
  switch (priority) {
    case 'must-have':
      return 'border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-400';
    case 'high':
      return 'border-orange-500/30 bg-orange-500/15 text-orange-700 dark:text-orange-400';
    case 'medium':
      return 'border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-400';
    case 'low':
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400';
  }
}

function getPriorityLabel(priority: Priority) {
  return PRIORITIES.find((p) => p.value === priority)?.label ?? priority;
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
  const {
    wishlist,
    categories,
    addWishlistItem,
    updateWishlistItem,
    deleteWishlistItem,
    getCategoryById,
  } = useCollectionStore();
  const displayCurrency = useCollectionStore((s) => s.displayCurrency);

  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [showAcquired, setShowAcquired] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const [acquireDialogOpen, setAcquireDialogOpen] = useState(false);
  const [itemToAcquire, setItemToAcquire] = useState<WishlistItem | null>(null);

  const activeItems = useMemo(
    () => wishlist.filter((w) => !w.isAcquired),
    [wishlist],
  );

  const stats = useMemo(() => {
    const totalValue = activeItems.reduce(
      (sum, w) =>
        sum +
        (w.targetPrice != null && w.targetPrice > 0
          ? currencyService.convert(
              w.targetPrice,
              w.targetCurrency ?? 'USD',
              displayCurrency,
            )
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
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (w) =>
          w.title.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q) ||
          w.tags.some((t) => t.toLowerCase().includes(q)) ||
          (w.source?.toLowerCase().includes(q) ?? false),
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
      toast.error('Title is required');
      return;
    }

    const parsedTags = form.tags
      .split(',')
      .map((t) => t.trim())
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
      images: [] as string[],
      tags: parsedTags,
      addedBy: 'contrib-1',
    };

    if (editingItem) {
      updateWishlistItem(editingItem.id, payload);
      toast.success('Wishlist item updated');
    } else {
      addWishlistItem(payload);
      toast.success('Added to wishlist');
    }

    setDialogOpen(false);
    setEditingItem(null);
    setForm(EMPTY_FORM);
  }, [form, editingItem, addWishlistItem, updateWishlistItem]);

  const handleDelete = useCallback(() => {
    if (itemToDelete) {
      deleteWishlistItem(itemToDelete);
      toast.success('Removed from wishlist');
    }
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  }, [itemToDelete, deleteWishlistItem]);

  const handleAcquire = useCallback(() => {
    if (itemToAcquire) {
      updateWishlistItem(itemToAcquire.id, { isAcquired: true });
      toast.success(`"${itemToAcquire.title}" marked as acquired!`);
    }
    setAcquireDialogOpen(false);
    setItemToAcquire(null);
  }, [itemToAcquire, updateWishlistItem]);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
      <PageHeader
        title="Wishlist"
        description="Items you're looking to acquire"
        breadcrumbs={[{ label: 'Wishlist' }]}
      >
        <Button onClick={openAdd}>
          <Plus className="size-4" />
          Add Item
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Wishlist Items"
          value={stats.total}
          icon={Heart}
          subtitle="waiting to acquire"
        />
        <StatCard
          title="Target Value"
          value={formatCurrency(stats.totalValue, displayCurrency)}
          icon={Target}
          subtitle="total estimated cost"
        />
        <StatCard
          title="Must-Have"
          value={stats.mustHaveCount}
          icon={Star}
          subtitle="top priority items"
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search wishlist..."
          className="lg:w-80"
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
            {[{ value: 'all' as const, label: 'All' }, ...PRIORITIES].map(
              (opt) => (
                <Button
                  key={opt.value}
                  variant={priorityFilter === opt.value ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setPriorityFilter(opt.value)}
                >
                  {opt.label}
                </Button>
              ),
            )}
          </div>

          <Separator orientation="vertical" className="hidden h-6 lg:block" />

          <Button
            variant={showAcquired ? 'secondary' : 'outline'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setShowAcquired((prev) => !prev)}
          >
            {showAcquired ? (
              <>
                <X className="mr-1 size-3" />
                Hide Acquired
              </>
            ) : (
              <>
                <Filter className="mr-1 size-3" />
                Show Acquired
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No wishlist items"
          description={
            searchQuery || priorityFilter !== 'all'
              ? 'No items match your current filters. Try adjusting your search or priority filter.'
              : 'Start building your wishlist by adding items you want to acquire.'
          }
          action={
            !searchQuery && priorityFilter === 'all'
              ? { label: 'Add First Item', onClick: openAdd }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const category = getCategoryById(item.categoryId);

            return (
              <Card
                key={item.id}
                className={cn(
                  'group relative overflow-hidden transition-all duration-300',
                  'hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/5',
                  item.isAcquired && 'opacity-60',
                )}
              >
                {/* Warm gradient accent */}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-400/70 via-amber-400/50 to-orange-400/30 opacity-60 transition-opacity duration-300 group-hover:opacity-100" />

                {/* Acquired overlay */}
                {item.isAcquired && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                    <div className="flex items-center gap-2 rounded-full bg-green-500/15 px-4 py-2 text-green-700 dark:text-green-400">
                      <ShoppingCart className="size-5" />
                      <span className="text-sm font-semibold">Acquired</span>
                    </div>
                  </div>
                )}

                <CardContent className="relative p-5">
                  {/* Priority badge */}
                  <div className="absolute right-4 top-4">
                    <Badge
                      variant="outline"
                      className={cn('text-[11px] font-semibold', getPriorityStyles(item.priority))}
                    >
                      {getPriorityLabel(item.priority)}
                    </Badge>
                  </div>

                  {/* Title & description */}
                  <div className="pr-20">
                    <h3 className="text-lg font-semibold leading-tight tracking-tight line-clamp-1">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 space-y-2.5 text-sm">
                    {/* Category */}
                    {category && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Package className="size-3.5 shrink-0" />
                        <span>{category.name}</span>
                      </div>
                    )}

                    {/* Target price */}
                    {item.targetPrice != null && item.targetPrice > 0 && (
                      <div className="flex items-center gap-2">
                        <Target className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="font-semibold">
                          {formatCurrency(
                            currencyService.convert(
                              item.targetPrice,
                              item.targetCurrency ?? 'USD',
                              displayCurrency,
                            ),
                            displayCurrency,
                          )}
                        </span>
                      </div>
                    )}

                    {/* Source */}
                    {item.source && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Search className="size-3.5 shrink-0" />
                        <span className="truncate">{item.source}</span>
                        {item.sourceUrl && (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-primary hover:text-primary/80"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                    )}

                    {/* Tags */}
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        <Tag className="mr-0.5 size-3 text-muted-foreground" />
                        {item.tags.slice(0, 4).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {item.tags.length > 4 && (
                          <Badge
                            variant="outline"
                            className="px-1.5 py-0 text-[10px]"
                          >
                            +{item.tags.length - 4}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Date */}
                    <p className="pt-0.5 text-xs text-muted-foreground/70">
                      Added {formatRelativeDate(item.createdAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-1.5 border-t pt-3">
                    {!item.isAcquired && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-xs text-green-600 hover:bg-green-500/10 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                        onClick={() => {
                          setItemToAcquire(item);
                          setAcquireDialogOpen(true);
                        }}
                      >
                        <ShoppingCart className="size-3.5" />
                        Acquire
                      </Button>
                    )}
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
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

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Wishlist Item' : 'Add to Wishlist'}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? 'Update the details for this wishlist item.'
                : 'Add a new item you want to acquire to your wishlist.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="wl-title">Title *</Label>
              <Input
                id="wl-title"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Item name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wl-desc">Description</Label>
              <Textarea
                id="wl-desc"
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Brief description..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => updateField('categoryId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
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
                <Label htmlFor="wl-price">Target Price</Label>
                <Input
                  id="wl-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.targetPrice}
                  onChange={(e) => updateField('targetPrice', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={form.targetCurrency}
                  onValueChange={(v) => updateField('targetCurrency', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => updateField('priority', v as Priority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="wl-source">Source</Label>
                <Input
                  id="wl-source"
                  value={form.source}
                  onChange={(e) => updateField('source', e.target.value)}
                  placeholder="e.g. eBay, Amazon"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wl-url">Source URL</Label>
                <Input
                  id="wl-url"
                  value={form.sourceUrl}
                  onChange={(e) => updateField('sourceUrl', e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wl-notes">Notes</Label>
              <Textarea
                id="wl-notes"
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wl-tags">Tags</Label>
              <Input
                id="wl-tags"
                value={form.tags}
                onChange={(e) => updateField('tags', e.target.value)}
                placeholder="vintage, rare, limited (comma separated)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingItem ? 'Save Changes' : 'Add to Wishlist'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Remove from Wishlist"
        description="This item will be permanently removed from your wishlist. This action cannot be undone."
        confirmLabel="Remove"
        destructive
      />

      {/* Acquire Dialog */}
      <Dialog
        open={acquireDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAcquireDialogOpen(false);
            setItemToAcquire(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as Acquired</DialogTitle>
            <DialogDescription>
              Confirm that you've acquired{' '}
              <span className="font-medium text-foreground">
                "{itemToAcquire?.title}"
              </span>
              . This will move it out of your active wishlist.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-green-500/15">
              <ShoppingCart className="size-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-sm">
              <p className="font-medium">Mark as acquired</p>
              <p className="text-muted-foreground">
                The item will be dimmed and flagged in your wishlist.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAcquireDialogOpen(false);
                setItemToAcquire(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAcquire}>Confirm Acquisition</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageTransition>
  );
}
