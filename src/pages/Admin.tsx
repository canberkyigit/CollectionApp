import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  Layers,
  Package,
  ListChecks,
  Plus,
  FolderCog,
  Database,
  Pencil,
  Trash2,
  ArrowRight,
  Archive,
  Library,
  AlertTriangle,
  Printer,
} from 'lucide-react';

import { PageHeader, StatCard, ConfirmDialog } from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
  DialogDescription,
} from '@/components/ui/dialog';
import { formatDate, formatNumber } from '@/lib/utils';
import { useCollectionStore } from '@/store/useCollectionStore';

export default function Admin() {
  const navigate = useNavigate();
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
  const [newLibCategory, setNewLibCategory] = useState('');
  const [deleteLibId, setDeleteLibId] = useState<string | null>(null);
  const [editLibId, setEditLibId] = useState<string | null>(null);
  const [editLibName, setEditLibName] = useState('');

  const totalFields = useMemo(
    () => categories.reduce((sum, c) => sum + (c.fields?.length ?? 0), 0),
    [categories],
  );

  const handleDelete = () => {
    if (deleteId) {
      deleteCategory(deleteId);
      setDeleteId(null);
    }
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
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
      <PageHeader
        title="Admin Panel"
        description="Manage categories, fields, and application settings"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Categories"
          value={formatNumber(categories.length)}
          icon={Layers}
          subtitle="collection types"
        />
        <StatCard
          title="Total Items"
          value={formatNumber(items.length)}
          icon={Package}
          subtitle="across all categories"
        />
        <StatCard
          title="Total Fields"
          value={formatNumber(totalFields)}
          icon={ListChecks}
          subtitle="custom fields defined"
        />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card
                key={action.title}
                className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.02]"
                onClick={() => navigate(action.href)}
              >
                <CardHeader className="pb-2">
                  <div className="rounded-xl bg-primary/10 p-3 w-fit transition-colors group-hover:bg-primary/15">
                    <Icon className="size-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{action.title}</h3>
                    <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {action.description}
                  </p>
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
                  const itemCount = items.filter((i) => i.categoryId === category.id).length;
                  return (
                    <tr
                      key={category.id}
                      className="border-b transition-colors hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/admin/categories/${category.id}/edit`)}
                    >
                      <td className="px-4 py-3 font-medium">{category.name}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {category.slug}
                      </td>
                      <td className="px-4 py-3 text-center">{category.fields?.length ?? 0}</td>
                      <td className="px-4 py-3 text-center">{itemCount}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(category.createdAt)}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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

      {/* Libraries Section */}
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
                  {libraries.map((lib) => {
                    const cat = categories.find((c) => c.id === lib.categoryId);
                    const libItemCount = items.filter((i) => i.libraryId === lib.id && !i.isArchived).length;
                    return (
                      <tr key={lib.id} className="border-b transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium flex items-center gap-2">
                          <Library className="size-4 text-primary" />
                          {lib.name}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {cat ? <Badge variant="secondary" className="text-xs">{cat.name}</Badge> : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">{libItemCount}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(lib.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => {
                                setEditLibId(lib.id);
                                setEditLibName(lib.name);
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteLibId(lib.id)}
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
              <p className="mt-2 text-sm text-muted-foreground">No libraries yet. Create one to organize your items.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Library Dialog */}
      <Dialog open={libDialogOpen} onOpenChange={setLibDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Library</DialogTitle>
            <DialogDescription>Create a new library to organize items within a category.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Library Name</Label>
              <Input value={newLibName} onChange={(e) => setNewLibName(e.target.value)} placeholder="e.g. Main Shelf, Office..." />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newLibCategory} onValueChange={setNewLibCategory}>
                <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLibDialogOpen(false)}>Cancel</Button>
              <Button
                disabled={!newLibName.trim() || !newLibCategory}
                onClick={() => {
                  addLibrary({ name: newLibName.trim(), categoryId: newLibCategory });
                  toast.success(`Library "${newLibName.trim()}" created`);
                  setNewLibName('');
                  setNewLibCategory('');
                  setLibDialogOpen(false);
                }}
              >
                Create Library
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Library Dialog */}
      <Dialog open={editLibId !== null} onOpenChange={(v) => !v && setEditLibId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Library</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Library Name</Label>
              <Input value={editLibName} onChange={(e) => setEditLibName(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditLibId(null)}>Cancel</Button>
              <Button
                disabled={!editLibName.trim()}
                onClick={() => {
                  if (editLibId) {
                    updateLibrary(editLibId, { name: editLibName.trim() });
                    toast.success('Library updated');
                  }
                  setEditLibId(null);
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
          if (deleteLibId) {
            deleteLibrary(deleteLibId);
            toast.success('Library deleted');
            setDeleteLibId(null);
          }
        }}
        title="Delete Library"
        description="Items in this library will become unassigned. This action cannot be undone."
        confirmLabel="Delete"
        destructive
      />
    </div>
    </PageTransition>
  );
}
