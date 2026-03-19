import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Search, Trash2, FolderInput, Tag, Star, StarOff, Filter, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, ConfirmDialog } from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, formatCurrency } from '@/lib/utils';
import { currencyService } from '@/services/currencyService';
import { useCollectionStore } from '@/store/useCollectionStore';

const CONDITIONS = ['Mint', 'Near Mint', 'Very Good', 'Good', 'Fair', 'Poor'] as const;

export default function AdminBulkActions() {
  const navigate = useNavigate();
  const displayCurrency = useCollectionStore((s) => s.displayCurrency);
  const {
    items,
    categories,
    deleteItems,
    bulkMoveItems,
    bulkUpdateCondition,
    bulkAddTag,
    bulkToggleFavorite,
    getCategoryById,
  } = useCollectionStore();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

  const filteredItems = useMemo(() => {
    let result = items;
    if (categoryFilter !== 'all') {
      result = result.filter((item) => item.categoryId === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => item.title.toLowerCase().includes(q));
    }
    return result;
  }, [items, categoryFilter, searchQuery]);

  const allSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((item) => item.id)));
    }
  };

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const hasSelection = selectedIds.size > 0;

  const handleMove = (targetCategoryId: string) => {
    bulkMoveItems(selectedArray, targetCategoryId);
    const cat = getCategoryById(targetCategoryId);
    toast.success(`Moved ${selectedArray.length} items to ${cat?.name ?? 'category'}`, { icon: <CheckCircle2 className="size-4" /> });
    setSelectedIds(new Set());
  };

  const handleCondition = (condition: string) => {
    bulkUpdateCondition(selectedArray, condition);
    toast.success(`Updated condition to "${condition}" for ${selectedArray.length} items`, { icon: <CheckCircle2 className="size-4" /> });
    setSelectedIds(new Set());
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    bulkAddTag(selectedArray, tag);
    toast.success(`Added tag "${tag}" to ${selectedArray.length} items`, { icon: <CheckCircle2 className="size-4" /> });
    setTagInput('');
    setTagPopoverOpen(false);
    setSelectedIds(new Set());
  };

  const handleToggleFavorite = () => {
    const anyUnfavorited = selectedArray.some((id) => {
      const item = items.find((i) => i.id === id);
      return item && !item.isFavorite;
    });
    bulkToggleFavorite(selectedArray, anyUnfavorited);
    toast.success(
      anyUnfavorited
        ? `Favorited ${selectedArray.length} items`
        : `Unfavorited ${selectedArray.length} items`,
      { icon: anyUnfavorited ? <Star className="size-4" /> : <StarOff className="size-4" /> },
    );
    setSelectedIds(new Set());
  };

  const handleDelete = () => {
    const count = selectedArray.length;
    deleteItems(selectedArray);
    toast.success(`Deleted ${count} items`);
    setSelectedIds(new Set());
    setShowDeleteDialog(false);
  };

  return (
    <PageTransition>
      <div className="space-y-6">
      <PageHeader
        title="Bulk Actions"
        description="Manage multiple items at once"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Bulk Actions' },
        ]}
      />

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search items by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Action Bar - always visible */}
      <Card className={cn(
        'transition-colors',
        hasSelection ? 'border-primary/30 bg-primary/5' : '',
      )}>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Badge variant={hasSelection ? 'secondary' : 'outline'} className="text-sm">
            {selectedIds.size} selected
          </Badge>

          <div className="h-5 w-px bg-border" />

          {/* Move to */}
          <Select onValueChange={handleMove} disabled={!hasSelection}>
            <SelectTrigger className="h-9 w-auto gap-2" disabled={!hasSelection}>
              <FolderInput className="size-4" />
              <span>Move to...</span>
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Set Condition */}
          <Select onValueChange={handleCondition} disabled={!hasSelection}>
            <SelectTrigger className="h-9 w-auto gap-2" disabled={!hasSelection}>
              <Package className="size-4" />
              <span>Set Condition</span>
            </SelectTrigger>
            <SelectContent>
              {CONDITIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Add Tag */}
          <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" disabled={!hasSelection}>
                <Tag className="size-4" />
                Add Tag
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-3" align="start">
              <p className="text-sm font-medium">Add tag to selected items</p>
              <Input
                placeholder="Enter tag name..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <Button size="sm" className="w-full" onClick={handleAddTag} disabled={!tagInput.trim()}>
                Add Tag
              </Button>
            </PopoverContent>
          </Popover>

          {/* Toggle Favorite */}
          <Button variant="outline" size="sm" className="gap-2" onClick={handleToggleFavorite} disabled={!hasSelection}>
            <Star className="size-4" />
            Toggle Favorite
          </Button>

          <div className="h-5 w-px bg-border" />

          {/* Delete */}
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={() => setShowDeleteDialog(true)}
            disabled={!hasSelection}
          >
            <Trash2 className="size-4" />
            Delete Selected
          </Button>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-12 px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Condition</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Value</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tags</th>
                <th className="w-20 px-4 py-3 text-center font-medium text-muted-foreground">
                  <Star className="mx-auto size-4" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const category = getCategoryById(item.categoryId);
                const value = currencyService.convert(
                  item.valuationInfo.currentEstimatedValue,
                  item.valuationInfo.currentValueCurrency,
                  displayCurrency,
                );
                const isSelected = selectedIds.has(item.id);

                return (
                  <tr
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={cn(
                      'cursor-pointer border-b transition-colors hover:bg-muted/30',
                      isSelected && 'bg-primary/5',
                    )}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleItem(item.id)}
                        aria-label={`Select ${item.title}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{item.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {category?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {item.condition}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {formatCurrency(value, displayCurrency)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {item.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{item.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.isFavorite ? (
                        <Star className="mx-auto size-4 fill-yellow-400 text-yellow-400" />
                      ) : (
                        <StarOff className="mx-auto size-4 text-muted-foreground/40" />
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="size-8 text-muted-foreground/40" />
                      <p>No items found matching your filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Selected Items"
        description={`This will permanently delete ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}. This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
      />
    </div>
    </PageTransition>
  );
}
