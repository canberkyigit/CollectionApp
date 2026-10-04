import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Package, Plus } from 'lucide-react';

import { useCollectionStore } from '@/store/useCollectionStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useT } from '@/i18n';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageTransition } from '@/components/shared/motion';
import { Button } from '@/components/ui/button';
import { getCategoryIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { canManageCatalog } from '@/lib/permissions';
import { ItemEditor, type ItemEditorSaveResult } from '@/components/items/ItemEditor';
import { UnsavedChangesDialog } from '@/components/items/UnsavedChangesDialog';
import { useUnsavedChangesGuard } from '@/components/items/useUnsavedChangesGuard';

/**
 * Full-page item editor (`/items/new?category=<slug>` and `/items/:itemId/edit`).
 * A thin route wrapper around the shared `ItemEditor`, which the global dialog also uses.
 */
export default function ItemForm() {
  const t = useT();
  const { itemId } = useParams<{ itemId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const categories = useCollectionStore((state) => state.categories);
  const items = useCollectionStore((state) => state.items);
  const getCategoryById = useCollectionStore((state) => state.getCategoryById);
  const getCategoryBySlug = useCollectionStore((state) => state.getCategoryBySlug);

  const isEditMode = !!itemId;
  const existingItem = useMemo(
    () => (itemId ? items.find((entry) => entry.id === itemId) : undefined),
    [itemId, items],
  );
  const canCreateCategory = canManageCatalog(user?.role ?? 'viewer');

  const category = useMemo(() => {
    if (existingItem) return getCategoryById(existingItem.categoryId);
    if (isEditMode) return undefined;
    const slug = searchParams.get('category');
    return slug ? getCategoryBySlug(slug) ?? getCategoryById(slug) : undefined;
  }, [existingItem, isEditMode, searchParams, getCategoryById, getCategoryBySlug]);

  const [dirty, setDirty] = useState(false);
  const guard = useUnsavedChangesGuard(dirty);

  const handleSaved = useCallback((result: ItemEditorSaveResult) => {
    if (result.addAnother) {
      setDirty(false);
      guard.rearm();
      if (typeof window.scrollTo === 'function') {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
          // jsdom / old browsers
        }
      }
      return;
    }
    guard.allowNavigation();
    setDirty(false);
    if (result.item.id) navigate(`/items/${result.item.id}`);
    else navigate(-1);
  }, [guard, navigate]);

  const handleCancel = useCallback(() => {
    guard.requestLeave(() => navigate(-1));
  }, [guard, navigate]);

  if (isEditMode && !category) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-lg text-muted-foreground">{t('itemForm.page.notFound')}</p>
        <Button variant="outline" asChild>
          <Link to="/collections">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('itemForm.page.backToCollections')}
          </Link>
        </Button>
      </div>
    );
  }

  if (!category) {
    return (
      <PageTransition>
        <div className="space-y-4 sm:space-y-6 md:space-y-8">
          <PageHeader
            title={t('itemForm.page.addTitle')}
            description={t('itemForm.page.chooseCollection')}
            breadcrumbs={[
              { label: t('itemForm.page.collections'), href: '/collections' },
              { label: t('itemForm.page.newItem') },
            ]}
          />

          {categories.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((entry) => {
                const Icon = getCategoryIcon(entry.icon);
                const count = items.filter((item) => item.categoryId === entry.id && !item.isArchived).length;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSearchParams({ category: entry.slug })}
                    className={cn(
                      'group relative flex items-start gap-4 rounded-xl border bg-card p-5 text-left',
                      'transition-all duration-200',
                      'hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    )}
                  >
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                      <Icon className="size-6 text-primary" aria-hidden="true" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold">{entry.name}</h3>
                        <ChevronRight
                          className="size-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100"
                          aria-hidden="true"
                        />
                      </div>
                      {entry.description && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">{entry.description}</p>
                      )}
                      <div className="flex items-center gap-3 pt-1.5">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {t('itemForm.page.itemCount', { count })}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {t('itemForm.page.fieldCount', { count: entry.fields.length })}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {categories.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center">
              <Package className="size-12 text-muted-foreground/50" aria-hidden="true" />
              <div>
                <p className="text-lg font-medium">{t('itemForm.page.noCategoriesTitle')}</p>
                <p className="text-sm text-muted-foreground">{t('itemForm.page.noCategoriesDescription')}</p>
              </div>
              {canCreateCategory && (
                <Button variant="outline" asChild>
                  <Link to="/admin/categories/new">
                    <Plus className="size-4" aria-hidden="true" />
                    {t('itemForm.page.createCategory')}
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title={isEditMode ? t('itemForm.title.edit') : t('itemForm.page.addTitle')}
          description={isEditMode
            ? t('itemForm.page.editDescription', { name: existingItem?.title ?? category.name })
            : t('itemForm.page.addDescription', { name: category.name })}
          breadcrumbs={[
            { label: t('itemForm.page.collections'), href: '/collections' },
            { label: category.name, href: `/collections/${category.slug}` },
            { label: isEditMode ? t('itemForm.title.edit') : t('itemForm.page.newItem') },
          ]}
        />

        <ItemEditor
          key={`${category.id}:${existingItem?.id ?? 'new'}`}
          variant="page"
          category={category}
          existingItem={existingItem}
          onSaved={handleSaved}
          onCancel={handleCancel}
          onDirtyChange={setDirty}
        />
      </div>

      <UnsavedChangesDialog
        open={guard.open}
        variant="page"
        onStay={guard.cancelLeave}
        onLeave={guard.confirmLeave}
      />
    </PageTransition>
  );
}
