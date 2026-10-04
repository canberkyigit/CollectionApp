import { AlertTriangle } from 'lucide-react';

import { useT } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Confirm discarding edits. `variant` picks page ("leave page") or dialog ("discard") wording. */
export function UnsavedChangesDialog({
  open,
  variant,
  onStay,
  onLeave,
}: {
  open: boolean;
  variant: 'page' | 'dialog';
  onStay: () => void;
  onLeave: () => void;
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onStay(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
              <AlertTriangle className="size-5 text-amber-500" aria-hidden="true" />
            </div>
            <div className="text-left">
              <DialogTitle>{t('itemForm.unsaved.title')}</DialogTitle>
              <DialogDescription className="mt-1">
                {variant === 'page' ? t('itemForm.unsaved.pageDescription') : t('itemForm.unsaved.dialogDescription')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-2 gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onStay}>
            {variant === 'page' ? t('itemForm.unsaved.stay') : t('itemForm.unsaved.keepEditing')}
          </Button>
          <Button type="button" variant="destructive" onClick={onLeave}>
            {variant === 'page' ? t('itemForm.unsaved.leave') : t('itemForm.unsaved.discard')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
