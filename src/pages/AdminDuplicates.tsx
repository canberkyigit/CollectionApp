import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronRight, CopyCheck, Eye, GitMerge, Trash2 } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { PageTransition } from '@/components/shared/motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useT } from '@/i18n';
import { getAdminBreadcrumbs } from '@/lib/adminNavigation';
import { mergeDuplicateItems } from '@/lib/duplicates';
import { useCollectionStore } from '@/store/useCollectionStore';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { findDuplicateGroups, type DuplicateGroup } from './adminDuplicates-helpers';

export default function AdminDuplicates() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const items = useCollectionStore((s) => s.items);
  const categories = useCollectionStore((s) => s.categories);
  const deleteItem = useCollectionStore((s) => s.deleteItem);
  const updateItem = useCollectionStore((s) => s.updateItem);
  const archiveItems = useCollectionStore((s) => s.archiveItems);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [mergeGroup, setMergeGroup] = useState<DuplicateGroup | null>(null);
  const [primaryId, setPrimaryId] = useState<string>('');
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const duplicateGroups = useMemo(
    () => findDuplicateGroups(items, categoryNameById),
    [items, categoryNameById],
  );

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openMergeDialog = (group: DuplicateGroup) => {
    const newest = [...group.items].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    )[0];
    setMergeGroup(group);
    setPrimaryId(newest.id);
  };

  const confirmMerge = () => {
    if (!mergeGroup || !primaryId) return;
    const primary = mergeGroup.items.find((item) => item.id === primaryId);
    if (!primary) return;

    const duplicates = mergeGroup.items.filter((item) => item.id !== primaryId);
    updateItem(primary.id, mergeDuplicateItems(primary, duplicates));
    archiveItems(duplicates.map((item) => item.id));
    setMergeGroup(null);
    setPrimaryId('');
  };

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title={t('duplicates.title')}
          description={t('duplicates.description')}
          breadcrumbs={getAdminBreadcrumbs(search ? `?${search}` : '', [{ label: t('duplicates.breadcrumb') }])}
        />

        {duplicateGroups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
                <CopyCheck className="size-7 text-emerald-500" aria-hidden="true" />
              </div>
              <p className="text-lg font-semibold">{t('duplicates.emptyTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('duplicates.emptyDescription')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('duplicates.found', { count: duplicateGroups.length, formatted: formatNumber(duplicateGroups.length) })}
            </p>
            {duplicateGroups.map((group) => {
              const isExpanded = expandedKeys.has(group.key);
              const panelId = `duplicate-${group.key}`;
              return (
                <Card key={group.key} className="overflow-hidden">
                  <div className="flex items-center gap-3 px-6 py-3">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 select-none items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-expanded={isExpanded}
                      aria-controls={panelId}
                      onClick={() => toggleExpand(group.key)}
                    >
                      <AlertTriangle className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold leading-none tracking-tight">{group.items[0].title}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            {t('duplicates.itemCount', { count: group.items.length, formatted: formatNumber(group.items.length) })}
                          </span>
                          <span aria-hidden="true">&middot;</span>
                          <span>{group.categoryName}</span>
                          <span aria-hidden="true">&middot;</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'px-1.5 py-0 text-[11px]',
                              group.reason === 'isbn'
                                ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                            )}
                          >
                            {group.reason === 'isbn' ? t('duplicates.reason.isbn') : t('duplicates.reason.title')}
                          </Badge>
                        </span>
                      </span>
                      {isExpanded
                        ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        : <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                    </button>
                    <Button variant="outline" size="sm" className="h-9 sm:h-8 shrink-0 gap-1.5" onClick={() => openMergeDialog(group)}>
                      <GitMerge className="size-3.5" />
                      {t('duplicates.merge')}
                    </Button>
                  </div>

                  {isExpanded && (
                    <CardContent className="pt-0">
                      <ul id={panelId} className="divide-y rounded-lg border">
                        {group.items.map((item) => {
                          const isbn = typeof item.customFields?.isbn === 'string' ? item.customFields.isbn : '';
                          return (
                            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{item.title}</p>
                                <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                                  <span>{t('duplicates.added', { date: formatDate(item.createdAt) })}</span>
                                  {isbn && <span className="font-mono">{isbn}</span>}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-9 sm:size-8"
                                  onClick={() => navigate(`/items/${item.id}`)}
                                  aria-label={t('duplicates.viewItem')}
                                  title={t('duplicates.viewItem')}
                                >
                                  <Eye className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-9 text-destructive hover:text-destructive sm:size-8"
                                  onClick={() => setDeleteId(item.id)}
                                  aria-label={t('duplicates.deleteItem')}
                                  title={t('duplicates.deleteItem')}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        <ConfirmDialog
          open={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={() => {
            if (deleteId) deleteItem(deleteId);
            setDeleteId(null);
          }}
          title={t('duplicates.archiveTitle')}
          description={t('duplicates.archiveDescription')}
          confirmLabel={t('duplicates.archiveConfirm')}
          destructive
        />

        <ConfirmDialog
          open={!!mergeGroup}
          onClose={() => {
            setMergeGroup(null);
            setPrimaryId('');
          }}
          onConfirm={confirmMerge}
          title={t('duplicates.mergeTitle')}
          description={
            mergeGroup
              ? t('duplicates.mergeDescription', { count: mergeGroup.items.length, formatted: formatNumber(mergeGroup.items.length) })
              : ''
          }
          confirmLabel={t('duplicates.mergeConfirm')}
        >
          {mergeGroup && (
            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('duplicates.primaryLegend')}</legend>
              {mergeGroup.items.map((item) => (
                <label
                  key={item.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50',
                    primaryId === item.id && 'border-primary bg-primary/5 hover:bg-primary/5',
                  )}
                >
                  <input
                    type="radio"
                    name="primary-duplicate"
                    value={item.id}
                    checked={primaryId === item.id}
                    onChange={() => setPrimaryId(item.id)}
                    className="accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t('duplicates.updated', { date: formatDate(item.updatedAt) })}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
        </ConfirmDialog>
      </div>
    </PageTransition>
  );
}
