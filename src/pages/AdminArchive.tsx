import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Archive, Clock, Package, RotateCcw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader, ConfirmDialog } from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { conditionLabel } from '@/components/collections/conditionLabel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useT } from '@/i18n';
import { cn, formatNumber } from '@/lib/utils';
import { getAdminBreadcrumbs, getAdminRootPath } from '@/lib/adminNavigation';
import { getCategoryIcon } from '@/lib/icons';
import { matchesQuery } from '@/lib/search';
import { useCollectionStore } from '@/store/useCollectionStore';
import { selectArchivedItems } from '@/store/collectionStore.selectors';
import { RelativeTime } from '@/components/shared/RelativeTime';

type ConfirmAction = 'delete-one' | 'delete-selected' | 'delete-all';

export default function AdminArchive() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.toString();
  const adminRootPath = getAdminRootPath(searchQuery ? `?${searchQuery}` : '');
  const categories = useCollectionStore((s) => s.categories);
  const items = useCollectionStore((s) => s.items);
  const getCategoryById = useCollectionStore((s) => s.getCategoryById);
  const recoverItem = useCollectionStore((s) => s.recoverItem);
  const recoverItems = useCollectionStore((s) => s.recoverItems);
  const permanentDeleteItem = useCollectionStore((s) => s.permanentDeleteItem);
  const permanentDeleteItems = useCollectionStore((s) => s.permanentDeleteItems);

  const archived = useMemo(() => selectArchivedItems({ items }), [items]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = archived;
    if (categoryFilter !== 'all') {
      list = list.filter((i) => i.categoryId === categoryFilter);
    }
    if (search.trim()) {
      list = list.filter((i) => matchesQuery(search, i.title, ...i.tags));
    }
    return [...list].sort(
      (a, b) => new Date(b.archivedAt ?? b.updatedAt).getTime() - new Date(a.archivedAt ?? a.updatedAt).getTime(),
    );
  }, [archived, categoryFilter, search]);

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(filtered.map((i) => i.id)));
  };

  const removeFromSelection = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleRecover = (id: string) => {
    recoverItem(id);
    removeFromSelection(id);
    toast.success(t('archive.toast.recoveredOne'));
  };

  const handleRecoverSelected = () => {
    recoverItems([...selected]);
    toast.success(t('archive.toast.recoveredMany', { count: selected.size, formatted: formatNumber(selected.size) }));
    setSelected(new Set());
  };

  const handleConfirmDelete = () => {
    if (confirmAction === 'delete-one' && targetId) {
      permanentDeleteItem(targetId);
      removeFromSelection(targetId);
      toast.success(t('archive.toast.deletedOne'));
    } else if (confirmAction === 'delete-selected') {
      permanentDeleteItems([...selected]);
      toast.success(t('archive.toast.deletedMany', { count: selected.size, formatted: formatNumber(selected.size) }));
      setSelected(new Set());
    } else if (confirmAction === 'delete-all') {
      permanentDeleteItems(archived.map((i) => i.id));
      toast.success(t('archive.toast.emptied'));
      setSelected(new Set());
    }
    setConfirmAction(null);
    setTargetId(null);
  };

  const archiveCategories = useMemo(() => {
    const ids = new Set(archived.map((i) => i.categoryId));
    return categories.filter((c) => ids.has(c.id));
  }, [archived, categories]);

  const confirmTitle = confirmAction === 'delete-all'
    ? t('archive.confirm.emptyTitle')
    : confirmAction === 'delete-selected'
      ? t('archive.confirm.manyTitle', { count: selected.size, formatted: formatNumber(selected.size) })
      : t('archive.confirm.oneTitle');
  const confirmDescription = confirmAction === 'delete-all'
    ? t('archive.confirm.emptyDescription', { count: archived.length, formatted: formatNumber(archived.length) })
    : confirmAction === 'delete-selected'
      ? t('archive.confirm.manyDescription', { count: selected.size, formatted: formatNumber(selected.size) })
      : t('archive.confirm.oneDescription');

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title={t('archive.title')}
          description={t('archive.count', { count: archived.length, formatted: formatNumber(archived.length) })}
          breadcrumbs={getAdminBreadcrumbs(searchQuery ? `?${searchQuery}` : '', [{ label: t('archive.title') }])}
        />

        {archived.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-4 py-20">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                <Archive className="size-8 text-muted-foreground/50" aria-hidden="true" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">{t('archive.emptyTitle')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('archive.emptyDescription')}</p>
              </div>
              <Button variant="outline" onClick={() => navigate(adminRootPath)}>
                {t('archive.backToAdmin')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-3">
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('archive.searchPlaceholder')}
                      aria-label={t('archive.searchPlaceholder')}
                      className="pl-9"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-40" aria-label={t('archive.categoryFilter')}>
                      <SelectValue placeholder={t('archive.allCategories')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('archive.allCategories')}</SelectItem>
                      {archiveCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={selected.size > 0 ? 'default' : 'secondary'} className="px-2.5 py-1 text-xs">
                    {t('archive.selected', { formatted: formatNumber(selected.size) })}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selected.size === 0}
                    onClick={handleRecoverSelected}
                    className="h-9 sm:h-8 gap-1.5"
                  >
                    <RotateCcw className="size-3.5" />
                    {t('archive.recover')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selected.size === 0}
                    onClick={() => setConfirmAction('delete-selected')}
                    className="h-9 sm:h-8 gap-1.5 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                    {t('archive.delete')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmAction('delete-all')}
                    className="h-9 sm:h-8 gap-1.5 text-destructive hover:text-destructive"
                  >
                    {t('archive.empty')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="w-10 px-4 py-3 text-left">
                        <Checkbox
                          aria-label={t('archive.selectAll')}
                          checked={allSelected}
                          onCheckedChange={toggleAll}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('archive.column.item')}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('archive.column.category')}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('archive.column.archived')}</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('archive.column.actions')}</th>
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
                            'cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/50',
                            isSelected && 'bg-primary/5',
                          )}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(item.id)}
                              aria-label={t('archive.selectItem', { title: item.title })}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {item.images[0] ? (
                                <img src={item.images[0]} alt="" className="size-9 shrink-0 rounded-md border object-cover" />
                              ) : (
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted">
                                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate font-medium">{item.title}</p>
                                <p className="truncate text-xs text-muted-foreground">{conditionLabel(t, item.condition)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {cat && (
                              <Badge variant="secondary" className="text-xs">{cat.name}</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="size-3" aria-hidden="true" />
                              <RelativeTime date={item.archivedAt ?? item.updatedAt} />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 sm:h-7 gap-1 text-xs"
                                onClick={() => handleRecover(item.id)}
                              >
                                <RotateCcw className="size-3" />
                                {t('archive.recover')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 sm:h-7 gap-1 text-xs text-destructive hover:text-destructive"
                                aria-label={t('archive.deleteItem', { title: item.title })}
                                title={t('archive.deleteForever')}
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

              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <Search className="size-8 text-muted-foreground/30" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">{t('archive.noMatches')}</p>
                </div>
              )}
            </Card>
          </>
        )}

        <ConfirmDialog
          open={confirmAction !== null}
          onClose={() => { setConfirmAction(null); setTargetId(null); }}
          title={confirmTitle}
          description={confirmDescription}
          confirmLabel={t('archive.deleteForever')}
          destructive
          onConfirm={handleConfirmDelete}
        />
      </div>
    </PageTransition>
  );
}
