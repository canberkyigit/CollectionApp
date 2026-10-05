import { useState, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Database,
  FolderCog,
  Library,
  ListChecks,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';

import { ConfirmDialog } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getLibraryCategoryIds } from '@/lib/libraries';
import { withAdminSource } from '@/lib/adminNavigation';
import { formatDate, formatNumber } from '@/lib/utils';
import { useT } from '@/i18n';
import { useCollectionStore } from '@/store/useCollectionStore';

const ADMIN_SOURCE = '?from=settings';

const QUICK_LINKS = [
  { key: 'manageCategories', href: '/admin/categories', icon: FolderCog },
  { key: 'newCategory', href: '/admin/categories/new', icon: Plus },
  { key: 'bulk', href: '/admin/bulk', icon: ListChecks },
  { key: 'storage', href: '/admin/storage', icon: Database },
  { key: 'archive', href: '/admin/archive', icon: Archive },
  { key: 'duplicates', href: '/admin/duplicates', icon: AlertTriangle },
  { key: 'printLabels', href: '/admin/print-labels', icon: Printer },
] as const;

const headCell = 'px-4 py-3 font-medium text-muted-foreground';

function CategoryChecklist({
  idPrefix,
  categories,
  selected,
  onToggle,
}: {
  idPrefix: string;
  categories: { id: string; name: string }[];
  selected: string[];
  onToggle: (categoryId: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      {categories.map((category) => {
        const id = `${idPrefix}-${category.id}`;
        return (
          <div key={category.id} className="flex items-center gap-3 text-sm">
            <Checkbox
              id={id}
              checked={selected.includes(category.id)}
              onCheckedChange={() => onToggle(category.id)}
            />
            <Label htmlFor={id} className="font-normal">{category.name}</Label>
          </div>
        );
      })}
    </div>
  );
}

export function AdminPanelSection() {
  const t = useT();
  const {
    categories,
    items,
    libraries,
    deleteCategory,
    addLibrary,
    updateLibrary,
    deleteLibrary,
  } = useCollectionStore();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [libDialogOpen, setLibDialogOpen] = useState(false);
  const [newLibName, setNewLibName] = useState('');
  const [newLibCategoryIds, setNewLibCategoryIds] = useState<string[]>([]);
  const [deleteLibId, setDeleteLibId] = useState<string | null>(null);
  const [editLibId, setEditLibId] = useState<string | null>(null);
  const [editLibName, setEditLibName] = useState('');
  const [editLibCategoryIds, setEditLibCategoryIds] = useState<string[]>([]);

  const editPath = (categoryId: string) => withAdminSource(`/admin/categories/${categoryId}/edit`, ADMIN_SOURCE);

  const handleDelete = () => {
    if (!deleteId) return;
    deleteCategory(deleteId);
    setDeleteId(null);
  };

  const toggleCategorySelection = (
    categoryId: string,
    setCategoryIds: Dispatch<SetStateAction<string[]>>,
  ) => {
    setCategoryIds((current) => (
      current.includes(categoryId)
        ? current.filter((entry) => entry !== categoryId)
        : [...current, categoryId]
    ));
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">{t('admin.quickActions.title')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.key}
                to={withAdminSource(link.href, ADMIN_SOURCE)}
                className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card className="h-full transition-all duration-200 group-hover:scale-[1.02] group-hover:shadow-lg group-hover:shadow-primary/5">
                  <CardHeader className="pb-2">
                    <div className="w-fit rounded-xl bg-primary/10 p-3 transition-colors group-hover:bg-primary/15" aria-hidden="true">
                      <Icon className="size-5 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">{t(`admin.tools.${link.key}`)}</h3>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t(`admin.tools.${link.key}.description`)}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">{t('admin.categories.allTitle')}</h2>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className={`${headCell} text-left`}>{t('admin.col.name')}</th>
                  <th className={`${headCell} text-left`}>{t('admin.col.slug')}</th>
                  <th className={`${headCell} text-center`}>{t('admin.col.fields')}</th>
                  <th className={`${headCell} text-center`}>{t('admin.col.items')}</th>
                  <th className={`${headCell} text-left`}>{t('admin.col.created')}</th>
                  <th className="w-24 px-4 py-3"><span className="sr-only">{t('admin.col.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => {
                  const itemCount = items.filter((item) => item.categoryId === category.id).length;
                  return (
                    <tr key={category.id} className="border-b transition-colors last:border-b-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">
                        <Link
                          to={editPath(category.id)}
                          className="rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {category.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{category.slug}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{formatNumber(category.fields?.length ?? 0)}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{formatNumber(itemCount)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(category.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="size-8" asChild>
                            <Link to={editPath(category.id)} aria-label={t('admin.category.editAria', { name: category.name })}>
                              <Pencil className="size-3.5" aria-hidden="true" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            aria-label={t('admin.category.deleteAria', { name: category.name })}
                            onClick={() => setDeleteId(category.id)}
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {categories.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      {t('admin.categories.emptyInline')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">{t('admin.libraries.title')}</h2>
          <Button size="sm" onClick={() => setLibDialogOpen(true)}>
            <Plus className="mr-1.5 size-3.5" aria-hidden="true" /> {t('admin.libraries.add')}
          </Button>
        </div>

        {libraries.length > 0 ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className={`${headCell} text-left`}>{t('admin.col.name')}</th>
                    <th className={`${headCell} text-left`}>{t('admin.col.categories')}</th>
                    <th className={`${headCell} text-center`}>{t('admin.col.items')}</th>
                    <th className={`${headCell} text-left`}>{t('admin.col.created')}</th>
                    <th className="w-24 px-4 py-3"><span className="sr-only">{t('admin.col.actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {libraries.map((library) => {
                    const linkedCategories = getLibraryCategoryIds(library)
                      .map((categoryId) => categories.find((category) => category.id === categoryId))
                      .filter((category): category is NonNullable<typeof category> => Boolean(category));
                    const libraryItemCount = items.filter((item) => item.libraryId === library.id && !item.isArchived).length;

                    return (
                      <tr key={library.id} className="border-b transition-colors last:border-b-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">
                          <span className="flex items-center gap-2">
                            <Library className="size-4 shrink-0 text-primary" aria-hidden="true" />
                            {library.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div className="flex flex-wrap gap-1">
                            {linkedCategories.length > 0 ? linkedCategories.map((category) => (
                              <Badge key={category.id} variant="secondary" className="text-xs">
                                {category.name}
                              </Badge>
                            )) : (
                              <Badge variant="outline" className="text-xs">
                                {t('admin.libraries.unassigned')}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums">{formatNumber(libraryItemCount)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(library.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={t('admin.libraries.editAria', { name: library.name })}
                              onClick={() => {
                                setEditLibId(library.id);
                                setEditLibName(library.name);
                                setEditLibCategoryIds(getLibraryCategoryIds(library));
                              }}
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              aria-label={t('admin.libraries.deleteAria', { name: library.name })}
                              onClick={() => setDeleteLibId(library.id)}
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Library className="mx-auto size-10 text-muted-foreground/30" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium">{t('admin.libraries.emptyTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('admin.libraries.emptyDescription')}</p>
            </CardContent>
          </Card>
        )}
      </section>

      <Dialog
        open={libDialogOpen}
        onOpenChange={(open) => {
          setLibDialogOpen(open);
          if (open) return;
          setNewLibName('');
          setNewLibCategoryIds([]);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.libraries.addTitle')}</DialogTitle>
            <DialogDescription>{t('admin.libraries.addDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-library-name">{t('admin.libraries.nameLabel')}</Label>
              <Input
                id="new-library-name"
                value={newLibName}
                onChange={(event) => setNewLibName(event.target.value)}
                placeholder={t('admin.libraries.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">{t('admin.col.categories')}</p>
              <CategoryChecklist
                idPrefix="new-library-category"
                categories={categories}
                selected={newLibCategoryIds}
                onToggle={(categoryId) => toggleCategorySelection(categoryId, setNewLibCategoryIds)}
              />
              <p className="text-xs text-muted-foreground">{t('admin.libraries.categoriesHint')}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLibDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                disabled={!newLibName.trim()}
                onClick={() => {
                  addLibrary({ name: newLibName.trim(), categoryIds: newLibCategoryIds });
                  toast.success(t('admin.libraries.created', { name: newLibName.trim() }));
                  setNewLibName('');
                  setNewLibCategoryIds([]);
                  setLibDialogOpen(false);
                }}
              >
                {t('admin.libraries.create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editLibId !== null}
        onOpenChange={(open) => {
          if (open) return;
          setEditLibId(null);
          setEditLibCategoryIds([]);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.libraries.editTitle')}</DialogTitle>
            <DialogDescription>{t('admin.libraries.editDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-library-name">{t('admin.libraries.nameLabel')}</Label>
              <Input
                id="edit-library-name"
                value={editLibName}
                onChange={(event) => setEditLibName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">{t('admin.col.categories')}</p>
              <CategoryChecklist
                idPrefix="edit-library-category"
                categories={categories}
                selected={editLibCategoryIds}
                onToggle={(categoryId) => toggleCategorySelection(categoryId, setEditLibCategoryIds)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditLibId(null);
                  setEditLibCategoryIds([]);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                disabled={!editLibName.trim()}
                onClick={() => {
                  if (editLibId) {
                    updateLibrary(editLibId, {
                      name: editLibName.trim(),
                      categoryIds: editLibCategoryIds,
                    });
                    toast.success(t('admin.libraries.updated'));
                  }
                  setEditLibId(null);
                  setEditLibCategoryIds([]);
                }}
              >
                {t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t('admin.category.deleteTitle')}
        description={t('admin.category.deleteDescription')}
        confirmLabel={t('common.delete')}
        destructive
      />

      <ConfirmDialog
        open={deleteLibId !== null}
        onClose={() => setDeleteLibId(null)}
        onConfirm={() => {
          if (!deleteLibId) return;
          deleteLibrary(deleteLibId);
          toast.success(t('admin.libraries.deleted'));
          setDeleteLibId(null);
        }}
        title={t('admin.libraries.deleteTitle')}
        description={t('admin.libraries.deleteDescription')}
        confirmLabel={t('common.delete')}
        destructive
      />
    </div>
  );
}
