import { useId, useMemo, useState, type FormEvent } from 'react';
import { Bookmark, BookmarkPlus, Check, Pencil, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/i18n';
import type { ViewDraft, ViewSort } from '@/lib/collectionViewParams';
import {
  buildSavedViewSearch,
  useSavedViews,
  useSavedViewsStore,
  type SavedView,
  type SavedViewMode,
} from '@/lib/savedViews';
import { useCollectionStore } from '@/store/useCollectionStore';

export interface CurrentViewState {
  draft: ViewDraft;
  sort: ViewSort | null;
  viewMode: SavedViewMode | null;
  libraryId?: string;
}

interface SavedViewsMenuProps {
  /** Category the toolbar belongs to; `null` = Favorites. */
  categoryId: string | null;
  current: CurrentViewState;
  onApply: (view: SavedView) => void;
}

function toViewFields(current: CurrentViewState) {
  return {
    filters: current.draft.filters,
    search: current.draft.search,
    sort: current.sort,
    viewMode: current.viewMode,
    libraryId: current.libraryId,
  };
}

export function SavedViewsMenu({ categoryId, current, onApply }: SavedViewsMenuProps) {
  const t = useT();
  const nameInputId = useId();
  const views = useSavedViews(categoryId);
  const addSavedView = useSavedViewsStore((state) => state.addSavedView);
  const updateSavedView = useSavedViewsStore((state) => state.updateSavedView);
  const removeSavedView = useSavedViewsStore((state) => state.removeSavedView);
  const ownerUserId = useCollectionStore((state) => state.ownerUserId);

  const [saveOpen, setSaveOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const currentSearch = buildSavedViewSearch(toViewFields(current));
  const activeView = useMemo(
    () => views.find((view) => buildSavedViewSearch(view) === currentSearch) ?? null,
    [views, currentSearch],
  );

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const view = addSavedView({ name, categoryId, ownerUserId, ...toViewFields(current) });
    toast.success(t('collections.views.savedToast', { name: view.name }));
    setNewName('');
    setSaveOpen(false);
  };

  const handleUpdateActive = () => {
    if (!activeView) return;
    updateSavedView(activeView.id, toViewFields(current));
  };

  const commitRename = (view: SavedView) => {
    const name = editingName.trim();
    if (name && name !== view.name) updateSavedView(view.id, { name });
    setEditingId(null);
    setEditingName('');
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={activeView ? 'secondary' : 'outline'} size="sm" className="gap-1.5 max-sm:h-9">
            <Bookmark className={activeView ? 'size-3.5 fill-primary text-primary' : 'size-3.5'} />
            <span className="max-w-40 truncate">{activeView ? activeView.name : t('collections.views.label')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t('collections.views.title')}
          </DropdownMenuLabel>
          {views.length === 0 ? (
            <p className="px-2 pb-2 text-xs leading-5 text-muted-foreground">{t('collections.views.empty')}</p>
          ) : (
            views.map((view) => (
              <DropdownMenuItem key={view.id} onSelect={() => onApply(view)}>
                <Check
                  className={view.id === activeView?.id ? 'mr-2 size-4 text-primary opacity-100' : 'mr-2 size-4 opacity-0'}
                  aria-hidden="true"
                />
                <span className="truncate">{view.name}</span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSaveOpen(true)}>
            <BookmarkPlus className="mr-2 size-4" aria-hidden="true" />
            {t('collections.views.saveCurrent')}
          </DropdownMenuItem>
          {views.length > 0 && (
            <DropdownMenuItem onSelect={() => setManageOpen(true)}>
              <Settings2 className="mr-2 size-4" aria-hidden="true" />
              {t('collections.views.manage')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={(open) => { setSaveOpen(open); if (!open) setNewName(''); }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t('collections.views.saveTitle')}</DialogTitle>
              <DialogDescription>{t('collections.views.saveDescription')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor={nameInputId}>{t('collections.views.name')}</Label>
              <Input
                id={nameInputId}
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder={t('collections.views.namePlaceholder')}
                autoFocus
                maxLength={60}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={!newName.trim()}>
                {t('collections.views.saveAction')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={manageOpen}
        onOpenChange={(open) => { setManageOpen(open); if (!open) setEditingId(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('collections.views.manageTitle')}</DialogTitle>
            <DialogDescription>{t('collections.views.manageDescription')}</DialogDescription>
          </DialogHeader>
          {activeView && (
            <Button variant="outline" size="sm" className="self-start" onClick={handleUpdateActive}>
              {t('collections.views.updateActive', { name: activeView.name })}
            </Button>
          )}
          {views.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('collections.views.empty')}</p>
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-muted/20">
              {views.map((view) => (
                <li key={view.id} className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/40">
                  {editingId === view.id ? (
                    <form
                      className="flex flex-1 items-center gap-2"
                      onSubmit={(event) => { event.preventDefault(); commitRename(view); }}
                    >
                      <Input
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        aria-label={t('collections.views.name')}
                        className="h-8"
                        autoFocus
                        maxLength={60}
                      />
                      <Button type="submit" size="sm">{t('common.save')}</Button>
                    </form>
                  ) : (
                    <>
                      <Bookmark className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{view.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={t('collections.views.rename', { name: view.name })}
                        onClick={() => { setEditingId(view.id); setEditingName(view.name); }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        aria-label={t('collections.views.delete', { name: view.name })}
                        onClick={() => {
                          removeSavedView(view.id);
                          toast.success(t('collections.views.deletedToast', { name: view.name }));
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
