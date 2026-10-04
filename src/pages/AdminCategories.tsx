import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, FolderOpen } from 'lucide-react';

import { getCategoryIcon } from '@/lib/icons';
import { PageHeader, EmptyState, ConfirmDialog } from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDate, formatNumber } from '@/lib/utils';
import { getAdminBreadcrumbs, withAdminSource } from '@/lib/adminNavigation';
import { useT } from '@/i18n';
import { useCollectionStore } from '@/store/useCollectionStore';

const headCell = 'px-4 py-3 font-medium text-muted-foreground';

export default function AdminCategories() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const searchSuffix = search ? `?${search}` : '';
  const { categories, items, deleteCategory } = useCollectionStore();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const newPath = withAdminSource('/admin/categories/new', searchSuffix);
  const editPath = (categoryId: string) => withAdminSource(`/admin/categories/${categoryId}/edit`, searchSuffix);

  const handleDelete = () => {
    if (deleteId) {
      deleteCategory(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title={t('admin.categories.title')}
          description={t('admin.categories.description')}
          breadcrumbs={getAdminBreadcrumbs(searchSuffix, [{ label: t('admin.categories.title') }])}
        >
          <Button onClick={() => navigate(newPath)}>
            <Plus className="size-4" aria-hidden="true" />
            {t('admin.categories.new')}
          </Button>
        </PageHeader>

        {categories.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={t('admin.categories.emptyTitle')}
            description={t('admin.categories.emptyDescription')}
            action={{
              label: t('admin.categories.create'),
              onClick: () => navigate(newPath),
            }}
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className={`${headCell} text-left`}>{t('admin.col.category')}</th>
                    <th className={`${headCell} text-left`}>{t('admin.col.slug')}</th>
                    <th className={`${headCell} hidden text-left md:table-cell`}>{t('admin.col.description')}</th>
                    <th className={`${headCell} text-center`}>{t('admin.col.fields')}</th>
                    <th className={`${headCell} text-center`}>{t('admin.col.items')}</th>
                    <th className={`${headCell} hidden text-left lg:table-cell`}>{t('admin.col.created')}</th>
                    <th className="w-24 px-4 py-3"><span className="sr-only">{t('admin.col.actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => {
                    const Icon = getCategoryIcon(category.icon);
                    const itemCount = items.filter((i) => i.categoryId === category.id).length;

                    return (
                      <tr key={category.id} className="border-b transition-colors last:border-b-0 hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10" aria-hidden="true">
                              <Icon className="size-4 text-primary" />
                            </div>
                            <Link
                              to={editPath(category.id)}
                              className="rounded-sm font-medium transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {category.name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{category.slug}</code>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <p className="max-w-xs truncate text-muted-foreground">{category.description}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="secondary" className="tabular-nums">{formatNumber(category.fields.length)}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className="tabular-nums">{formatNumber(itemCount)}</Badge>
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                          {formatDate(category.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={t('admin.category.editAria', { name: category.name })}
                              onClick={() => navigate(editPath(category.id))}
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
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
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <ConfirmDialog
          open={deleteId !== null}
          onClose={() => setDeleteId(null)}
          onConfirm={handleDelete}
          title={t('admin.category.deleteTitle')}
          description={t('admin.category.deleteDescription')}
          confirmLabel={t('common.delete')}
          destructive
        />
      </div>
    </PageTransition>
  );
}
