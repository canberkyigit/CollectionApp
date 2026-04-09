import { useState, type Dispatch, type SetStateAction } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
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
import { formatDate } from '@/lib/utils';
import { useCollectionStore } from '@/store/useCollectionStore';

export function AdminPanelSection() {
  const navigate = useNavigate();
  const location = useLocation();
  const adminSourceSearch = location.pathname.startsWith('/settings')
    ? '?from=settings'
    : location.search;
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

  const quickActions = [
    {
      title: 'Manage Categories',
      description: 'View, edit, and organize your collection categories',
      icon: FolderCog,
      href: '/admin/categories',
    },
    {
      title: 'Create New Category',
      description: 'Define a new collection type with custom fields',
      icon: Plus,
      href: '/admin/categories/new',
    },
    {
      title: 'Bulk Actions',
      description: 'Manage multiple items at once across categories',
      icon: ListChecks,
      href: '/admin/bulk',
    },
    {
      title: 'Data & Storage',
      description: 'Monitor data usage and manage storage',
      icon: Database,
      href: '/admin/storage',
    },
    {
      title: 'Archive',
      description: 'Recover or permanently delete archived items',
      icon: Archive,
      href: '/admin/archive',
    },
    {
      title: 'Find Duplicates',
      description: 'Detect items with duplicate titles or ISBNs',
      icon: AlertTriangle,
      href: '/admin/duplicates',
    },
    {
      title: 'Print Labels',
      description: 'Generate and print QR code labels for your items',
      icon: Printer,
      href: '/admin/print-labels',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card
                key={action.title}
                className="group cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/5"
                onClick={() => navigate(withAdminSource(action.href, adminSourceSearch))}
              >
                <CardHeader className="pb-2">
                  <div className="w-fit rounded-xl bg-primary/10 p-3 transition-colors group-hover:bg-primary/15">
                    <Icon className="size-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{action.title}</h3>
                    <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </div>
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">All Categories</h2>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Slug</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Fields</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Items</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => {
                  const itemCount = items.filter((item) => item.categoryId === category.id).length;
                  return (
                    <tr
                      key={category.id}
                      className="cursor-pointer border-b transition-colors hover:bg-muted/30"
                      onClick={() => navigate(withAdminSource(`/admin/categories/${category.id}/edit`, adminSourceSearch))}
                    >
                      <td className="px-4 py-3 font-medium">{category.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {category.slug}
                      </td>
                      <td className="px-4 py-3 text-center">{category.fields?.length ?? 0}</td>
                      <td className="px-4 py-3 text-center">{itemCount}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(category.createdAt)}
                      </td>
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => navigate(withAdminSource(`/admin/categories/${category.id}/edit`, adminSourceSearch))}
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
                {categories.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      No categories yet. Create your first category to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Libraries</h2>
          <Button size="sm" onClick={() => setLibDialogOpen(true)}>
            <Plus className="mr-1.5 size-3.5" /> Add Library
          </Button>
        </div>

        {libraries.length > 0 ? (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Items</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
                    <th className="w-24 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {libraries.map((library) => {
                    const linkedCategories = getLibraryCategoryIds(library)
                      .map((categoryId) => categories.find((category) => category.id === categoryId))
                      .filter(Boolean);
                    const libraryItemCount = items.filter((item) => item.libraryId === library.id && !item.isArchived).length;

                    return (
                      <tr key={library.id} className="border-b transition-colors hover:bg-muted/30">
                        <td className="flex items-center gap-2 px-4 py-3 font-medium">
                          <Library className="size-4 text-primary" />
                          {library.name}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div className="flex flex-wrap gap-1">
                            {linkedCategories.length > 0 ? linkedCategories.map((category) => (
                              <Badge key={category!.id} variant="secondary" className="text-xs">
                                {category!.name}
                              </Badge>
                            )) : (
                              <Badge variant="outline" className="text-xs">
                                Unassigned
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">{libraryItemCount}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(library.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Edit library ${library.name}`}
                              onClick={() => {
                                setEditLibId(library.id);
                                setEditLibName(library.name);
                                setEditLibCategoryIds(getLibraryCategoryIds(library));
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              aria-label={`Delete library ${library.name}`}
                              onClick={() => setDeleteLibId(library.id)}
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
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Library className="mx-auto size-10 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">
                No libraries yet. Create one to organize your items.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

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
            <DialogTitle>Add Library</DialogTitle>
            <DialogDescription>
              Create a new library and assign it to one or more categories now or later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-library-name">Library Name</Label>
              <Input
                id="new-library-name"
                value={newLibName}
                onChange={(event) => setNewLibName(event.target.value)}
                placeholder="e.g. Main Shelf, Office..."
              />
            </div>
            <div className="space-y-2">
              <Label>Categories</Label>
              <div className="space-y-2 rounded-lg border p-3">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={newLibCategoryIds.includes(category.id)}
                      onCheckedChange={() => toggleCategorySelection(category.id, setNewLibCategoryIds)}
                    />
                    <span>{category.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to create the library first and assign categories later.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLibDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!newLibName.trim()}
                onClick={() => {
                  addLibrary({ name: newLibName.trim(), categoryIds: newLibCategoryIds });
                  toast.success(`Library "${newLibName.trim()}" created`);
                  setNewLibName('');
                  setNewLibCategoryIds([]);
                  setLibDialogOpen(false);
                }}
              >
                Create Library
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
            <DialogTitle>Edit Library</DialogTitle>
            <DialogDescription>
              Rename this library and change which categories can use it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-library-name">Library Name</Label>
              <Input
                id="edit-library-name"
                value={editLibName}
                onChange={(event) => setEditLibName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Categories</Label>
              <div className="space-y-2 rounded-lg border p-3">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={editLibCategoryIds.includes(category.id)}
                      onCheckedChange={() => toggleCategorySelection(category.id, setEditLibCategoryIds)}
                    />
                    <span>{category.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditLibId(null);
                  setEditLibCategoryIds([]);
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!editLibName.trim()}
                onClick={() => {
                  if (editLibId) {
                    updateLibrary(editLibId, {
                      name: editLibName.trim(),
                      categoryIds: editLibCategoryIds,
                    });
                    toast.success('Library updated');
                  }
                  setEditLibId(null);
                  setEditLibCategoryIds([]);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Category"
        description="This will permanently delete the category and all items within it. This action cannot be undone."
        confirmLabel="Delete"
        destructive
      />

      <ConfirmDialog
        open={deleteLibId !== null}
        onClose={() => setDeleteLibId(null)}
        onConfirm={() => {
          if (!deleteLibId) return;
          deleteLibrary(deleteLibId);
          toast.success('Library deleted');
          setDeleteLibId(null);
        }}
        title="Delete Library"
        description="Items in this library will become unassigned. This action cannot be undone."
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}
