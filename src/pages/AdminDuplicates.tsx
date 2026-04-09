import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Eye, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageTransition } from '@/components/shared/motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { getAdminBreadcrumbs } from '@/lib/adminNavigation';
import { useCollectionStore } from '@/store/useCollectionStore';
import { formatDate } from '@/lib/utils';

interface DuplicateGroup {
  key: string;
  reason: 'title' | 'isbn';
  items: ReturnType<typeof useCollectionStore.getState>['items'];
  categoryName: string;
}

export default function AdminDuplicates() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const { items, categories, deleteItem } = useCollectionStore();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const duplicateGroups = useMemo<DuplicateGroup[]>(() => {
    const groups: DuplicateGroup[] = [];
    const activeItems = items.filter((i) => !i.isArchived);

    // Group by categoryId
    const byCat = new Map<string, typeof activeItems>();
    for (const item of activeItems) {
      const arr = byCat.get(item.categoryId) ?? [];
      arr.push(item);
      byCat.set(item.categoryId, arr);
    }

    for (const [catId, catItems] of byCat) {
      const catName = categoryNameById.get(catId) ?? catId;

      // Title duplicates
      const byTitle = new Map<string, typeof catItems>();
      for (const item of catItems) {
        const key = item.title.trim().toLowerCase();
        const arr = byTitle.get(key) ?? [];
        arr.push(item);
        byTitle.set(key, arr);
      }
      for (const [titleKey, dupeItems] of byTitle) {
        if (dupeItems.length > 1) {
          groups.push({ key: `title-${catId}-${titleKey}`, reason: 'title', items: dupeItems, categoryName: catName });
        }
      }

      // ISBN duplicates (only items with isbn field)
      const byIsbn = new Map<string, typeof catItems>();
      for (const item of catItems) {
        const isbn = (item.customFields?.isbn as string | undefined)?.trim();
        if (!isbn) continue;
        const arr = byIsbn.get(isbn) ?? [];
        arr.push(item);
        byIsbn.set(isbn, arr);
      }
      for (const [isbnKey, dupeItems] of byIsbn) {
        if (dupeItems.length > 1) {
          // Only add if not already covered by title group
          const alreadyCovered = groups.some(
            (g) => g.reason === 'title' && dupeItems.every((d) => g.items.some((gi) => gi.id === d.id)),
          );
          if (!alreadyCovered) {
            groups.push({ key: `isbn-${catId}-${isbnKey}`, reason: 'isbn', items: dupeItems, categoryName: catName });
          }
        }
      }
    }

    return groups;
  }, [items, categoryNameById]);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Duplicate Detection"
          description="Items that may be duplicates based on title or ISBN"
          breadcrumbs={getAdminBreadcrumbs(search ? `?${search}` : '', [{ label: 'Duplicates' }])}
        />

        {duplicateGroups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
                <AlertTriangle className="size-7 text-emerald-500" />
              </div>
              <p className="text-lg font-semibold">No duplicates found</p>
              <p className="text-sm text-muted-foreground">All items have unique titles and ISBNs within their categories.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Found <span className="font-semibold text-foreground">{duplicateGroups.length}</span> potential duplicate group{duplicateGroups.length !== 1 ? 's' : ''}.
            </p>
            {duplicateGroups.map((group) => {
              const isExpanded = expandedKeys.has(group.key);
              return (
                <Card key={group.key}>
                  <CardHeader
                    className="cursor-pointer select-none py-3"
                    onClick={() => toggleExpand(group.key)}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm font-semibold">
                          {group.items[0].title}
                        </CardTitle>
                        <CardDescription className="mt-0.5 text-xs">
                          {group.items.length} items &middot; {group.categoryName} &middot;{' '}
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${group.reason === 'isbn' ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400' : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'}`}>
                            {group.reason === 'isbn' ? 'Same ISBN' : 'Same Title'}
                          </Badge>
                        </CardDescription>
                      </div>
                      {isExpanded ? <ChevronDown className="size-4 text-muted-foreground shrink-0" /> : <ChevronRight className="size-4 text-muted-foreground shrink-0" />}
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="divide-y rounded-lg border">
                        {group.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{item.title}</p>
                              <p className="text-xs text-muted-foreground">Added {formatDate(item.createdAt)}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => navigate(`/items/${item.id}`)}
                                title="View item"
                              >
                                <Eye className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(item.id)}
                                title="Delete item"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
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
          title="Archive Item"
          description="This item will be moved to the archive."
          confirmLabel="Archive"
          destructive
        />
      </div>
    </PageTransition>
  );
}
