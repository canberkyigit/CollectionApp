import { useCallback, useMemo, useState } from 'react';

import { useCollectionStore } from '@/store/useCollectionStore';
import { useT } from '@/i18n';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ItemEditor, type ItemEditorSaveResult } from '@/components/items/ItemEditor';
import { UnsavedChangesDialog } from '@/components/items/UnsavedChangesDialog';

/**
 * Global add/edit dialog, opened via `openItemDialog(categoryId, item?, options?)`.
 * A thin shell around the shared `ItemEditor` (same editor as the full page).
 */
export function AddEditItemDialog() {
  const t = useT();
  const open = useCollectionStore((state) => state.itemDialogOpen);
  const categoryId = useCollectionStore((state) => state.itemDialogCategoryId);
  const existingItem = useCollectionStore((state) => state.itemDialogItem);
  const options = useCollectionStore((state) => state.itemDialogOptions);
  const closeItemDialog = useCollectionStore((state) => state.closeItemDialog);
  const getCategoryById = useCollectionStore((state) => state.getCategoryById);

  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const category = useMemo(
    () => (categoryId ? getCategoryById(categoryId) : undefined),
    [categoryId, getCategoryById],
  );

  const close = useCallback(() => {
    setDirty(false);
    setConfirmOpen(false);
    closeItemDialog();
  }, [closeItemDialog]);

  const requestClose = useCallback(() => {
    if (dirty) setConfirmOpen(true);
    else close();
  }, [close, dirty]);

  const handleSaved = useCallback((result: ItemEditorSaveResult) => {
    if (result.addAnother) {
      setDirty(false);
      return;
    }
    close();
  }, [close]);

  if (!open) return null;

  const isEditMode = !!existingItem;
  const title = isEditMode
    ? t('itemForm.title.edit')
    : t('itemForm.title.addTo', { name: category?.name ?? t('itemForm.title.collectionFallback') });
  const description = isEditMode
    ? t('itemForm.dialog.editDescription')
    : options?.wishlistId
      ? t('itemForm.dialog.fromWishlistDescription')
      : t('itemForm.dialog.addDescription', { name: category?.name ?? t('itemForm.title.collectionFallback') });

  return (
    <>
      <Dialog open onOpenChange={(next) => { if (!next) requestClose(); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {category ? (
            <ItemEditor
              key={`${category.id}:${existingItem?.id ?? 'new'}`}
              variant="dialog"
              category={category}
              existingItem={existingItem ?? undefined}
              prefill={existingItem ? undefined : options?.prefill}
              wishlistId={existingItem ? undefined : options?.wishlistId}
              onSaved={handleSaved}
              onCancel={requestClose}
              onDirtyChange={setDirty}
            />
          ) : (
            <p className="py-6 text-sm text-muted-foreground">{t('itemForm.dialog.categoryMissing')}</p>
          )}
        </DialogContent>
      </Dialog>

      <UnsavedChangesDialog
        open={confirmOpen}
        variant="dialog"
        onStay={() => setConfirmOpen(false)}
        onLeave={close}
      />
    </>
  );
}
