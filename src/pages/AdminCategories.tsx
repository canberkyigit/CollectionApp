import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Plus,
  Pencil,
  Trash2,
  FolderOpen,
} from 'lucide-react';
import { getCategoryIcon } from '@/lib/icons';

import { PageHeader, EmptyState, ConfirmDialog } from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { useCollectionStore } from '@/store/useCollectionStore';

export default function AdminCategories() {
  const navigate = useNavigate();
  const { categories, items, deleteCategory } = useCollectionStore();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = () => {
    if (deleteId) {
      deleteCategory(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <PageTransition>
      <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Manage your collection categories and their fields"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Categories' },
        ]}
      >
        <Button onClick={() => navigate('/admin/categories/new')}>
          <Plus className="size-4" />
          New Category
        </Button>
      </PageHeader>

      {categories.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No categories yet"
          description="Create your first collection category to start organizing your items."
          action={{
            label: 'Create Category',
            onClick: () => navigate('/admin/categories/new'),
          }}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Slug</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                    Description
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Fields</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Items</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                    Created
                  </th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => {
                  const Icon = getCategoryIcon(category.icon);
                  const itemCount = items.filter((i) => i.categoryId === category.id).length;

                  return (
                    <tr
                      key={category.id}
                      className="border-b transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Icon className="size-4 text-primary" />
                          </div>
                          <span className="font-medium">{category.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {category.slug}
                        </code>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="max-w-xs truncate text-muted-foreground">
                          {category.description}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary">{category.fields.length}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline">{itemCount}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                        {formatDate(category.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => navigate(`/admin/categories/${category.id}/edit`)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(category.id)}
                          >
                            <Trash2 className="size-3.5" />
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
        title="Delete Category"
        description="This will permanently delete the category and all items within it. This action cannot be undone."
        confirmLabel="Delete"
        destructive
      />
    </div>
    </PageTransition>
  );
}
