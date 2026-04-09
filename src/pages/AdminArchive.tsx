import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Archive,
  RotateCcw,
  Trash2,
  Search,
  CheckSquare,
  Square,
  Package,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader, ConfirmDialog } from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, formatRelativeDate } from '@/lib/utils';
import { getAdminBreadcrumbs, getAdminRootPath } from '@/lib/adminNavigation';
import { getCategoryIcon } from '@/lib/icons';
import { useCollectionStore } from '@/store/useCollectionStore';

export default function AdminArchive() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.toString();
  const adminRootPath = getAdminRootPath(searchQuery ? `?${searchQuery}` : '');
  const {
    categories,
    getArchivedItems,
    getCategoryById,
    recoverItem,
    recoverItems,
    permanentDeleteItem,
    permanentDeleteItems,
  } = useCollectionStore();

  const archived = useMemo(() => getArchivedItems(), [getArchivedItems]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<'delete-one' | 'delete-selected' | 'delete-all' | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = archived;
    if (categoryFilter !== 'all') {
      list = list.filter((i) => i.categoryId === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.title.toLowerCase().includes(q) || i.tags.some((t) => t.toLowerCase().includes(q)));
    }
    return list.sort((a, b) => new Date(b.archivedAt ?? b.updatedAt).getTime() - new Date(a.archivedAt ?? a.updatedAt).getTime());
  }, [archived, categoryFilter, search]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  };

  const handleRecover = (id: string) => {
    recoverItem(id);
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    toast.success('Item recovered');
  };

  const handleRecoverSelected = () => {
    recoverItems([...selected]);
    toast.success(`${selected.size} item${selected.size > 1 ? 's' : ''} recovered`);
    setSelected(new Set());
  };

  const handleConfirmDelete = () => {
    if (confirmAction === 'delete-one' && targetId) {
      permanentDeleteItem(targetId);
      setSelected((prev) => { const n = new Set(prev); n.delete(targetId); return n; });
      toast.success('Permanently deleted');
    } else if (confirmAction === 'delete-selected') {
      permanentDeleteItems([...selected]);
      toast.success(`${selected.size} item${selected.size > 1 ? 's' : ''} permanently deleted`);
      setSelected(new Set());
    } else if (confirmAction === 'delete-all') {
      permanentDeleteItems(archived.map((i) => i.id));
      toast.success('Archive emptied');
      setSelected(new Set());
    }
    setConfirmAction(null);
    setTargetId(null);
  };

  const archiveCategories = useMemo(() => {
    const ids = new Set(archived.map((i) => i.categoryId));
    return categories.filter((c) => ids.has(c.id));
  }, [archived, categories]);

  return (
    <PageTransition>
      <div className="space-y-6">
      <PageHeader
        title="Archive"
        description={`${archived.length} archived item${archived.length !== 1 ? 's' : ''}`}
        breadcrumbs={getAdminBreadcrumbs(searchQuery ? `?${searchQuery}` : '', [{ label: 'Archive' }])}
      />

      {archived.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <Archive className="size-8 text-muted-foreground/50" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">Archive is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Deleted items will appear here for recovery
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate(adminRootPath)}>
              Back to Admin
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filters & Actions Bar */}
          <Card>
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center gap-3">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search archive..."
                    className="pl-9"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {archiveCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={selected.size > 0 ? 'default' : 'secondary'} className="px-2.5 py-1 text-xs">
                  {selected.size} selected
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selected.size === 0}
                  onClick={handleRecoverSelected}
                  className="gap-1.5"
                >
                  <RotateCcw className="size-3.5" />
                  Recover
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selected.size === 0}
                  onClick={() => setConfirmAction('delete-selected')}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmAction('delete-all')}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  Empty Archive
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-10 px-4 py-3">
                      <button type="button" onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                        {selected.size === filtered.length && filtered.length > 0
                          ? <CheckSquare className="size-4" />
                          : <Square className="size-4" />
                        }
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Item</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Archived</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const cat = getCategoryById(item.categoryId);
                    const Icon = cat ? getCategoryIcon(cat.icon) : Package;
                    const isSelected = selected.has(item.id);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => toggleSelect(item.id)}
                        className={cn(
                          'cursor-pointer border-b transition-colors hover:bg-muted/50',
                          isSelected && 'bg-primary/5',
                        )}
                      >
                        <td className="px-4 py-3">
                          {isSelected
                            ? <CheckSquare className="size-4 text-primary" />
                            : <Square className="size-4 text-muted-foreground" />
                          }
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {item.images[0] ? (
                              <img src={item.images[0]} alt="" className="size-9 rounded-md border object-cover" />
                            ) : (
                              <div className="flex size-9 items-center justify-center rounded-md border bg-muted">
                                <Icon className="size-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium">{item.title}</p>
                              <p className="truncate text-xs text-muted-foreground">{item.condition}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {cat && (
                            <Badge variant="secondary" className="text-xs">
                              {cat.name}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="size-3" />
                            {formatRelativeDate(item.archivedAt ?? item.updatedAt)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => handleRecover(item.id)}
                            >
                              <RotateCcw className="size-3" />
                              Recover
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                              onClick={() => {
                                setTargetId(item.id);
                                setConfirmAction('delete-one');
                              }}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length === 0 && archived.length > 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Search className="size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No items match your filters</p>
              </div>
            )}
          </Card>
        </>
      )}

      <ConfirmDialog
        open={confirmAction !== null}
        onClose={() => { setConfirmAction(null); setTargetId(null); }}
        title={
          confirmAction === 'delete-all'
            ? 'Empty Archive'
            : confirmAction === 'delete-selected'
            ? `Permanently Delete ${selected.size} Item${selected.size > 1 ? 's' : ''}`
            : 'Permanently Delete Item'
        }
        description={
          confirmAction === 'delete-all'
            ? `All ${archived.length} archived items will be permanently removed. This cannot be undone.`
            : confirmAction === 'delete-selected'
            ? `${selected.size} item${selected.size > 1 ? 's' : ''} will be permanently removed. This cannot be undone.`
            : 'This item will be permanently removed. This cannot be undone.'
        }
        confirmLabel="Delete Forever"
        destructive
        onConfirm={handleConfirmDelete}
      />
    </div>
    </PageTransition>
  );
}
