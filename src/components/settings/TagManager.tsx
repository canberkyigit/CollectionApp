import { useMemo, useState } from 'react';

import { Check, GitMerge, Pencil, Search, Tag, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/i18n';
import { cn, formatNumber } from '@/lib/utils';
import { collectTagUsage } from '@/store/bulkEditHelpers';
import { useCollectionStore } from '@/store/useCollectionStore';

interface TagManagerProps {
  className?: string;
}

/** Lists every tag with its item count; rename (merging on collision), merge selected, delete. */
export function TagManager({ className }: TagManagerProps) {
  const t = useT();
  const items = useCollectionStore((s) => s.items);
  const renameTag = useCollectionStore((s) => s.renameTag);
  const mergeTags = useCollectionStore((s) => s.mergeTags);
  const removeTag = useCollectionStore((s) => s.removeTag);

  const usage = useMemo(() => collectTagUsage(items), [items]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const existingTags = useMemo(() => new Set(usage.map((entry) => entry.tag)), [usage]);
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return q ? usage.filter((entry) => entry.tag.toLocaleLowerCase().includes(q)) : usage;
  }, [usage, query]);
  const selectedTags = useMemo(() => usage.filter((entry) => selected.has(entry.tag)).map((entry) => entry.tag), [usage, selected]);

  const toggle = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const startEdit = (tag: string) => {
    setEditing(tag);
    setEditValue(tag);
  };

  const commitRename = () => {
    if (!editing) return;
    const target = editValue.trim();
    if (!target || target === editing) {
      setEditing(null);
      return;
    }
    const merged = existingTags.has(target);
    const count = renameTag(editing, target);
    toast.success(
      merged
        ? t('data.tags.mergedToast', { from: editing, to: target })
        : t('data.tags.renamedToast', { from: editing, to: target }),
      { description: t('data.tags.itemsUpdated', { count }) },
    );
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(editing);
      return next;
    });
    setEditing(null);
  };

  const commitMerge = () => {
    const target = mergeTarget.trim() || selectedTags[0];
    if (!target || selectedTags.length < 2) return;
    const count = mergeTags(selectedTags, target);
    toast.success(t('data.tags.mergeManyToast', { count: selectedTags.length, to: target }), {
      description: t('data.tags.itemsUpdated', { count }),
    });
    setSelected(new Set());
    setMergeTarget('');
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const count = removeTag(pendingDelete);
    toast.success(t('data.tags.deletedToast', { tag: pendingDelete }), {
      description: t('data.tags.itemsUpdated', { count }),
    });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(pendingDelete);
      return next;
    });
    setPendingDelete(null);
  };

  const pendingDeleteCount = usage.find((entry) => entry.tag === pendingDelete)?.count ?? 0;
  const renameWillMerge = editing !== null && editValue.trim() !== editing && existingTags.has(editValue.trim());

  if (usage.length === 0) {
    return (
      <div className={cn('flex flex-col items-center gap-3 py-10 text-center', className)}>
        <div className="rounded-full bg-primary/10 p-4">
          <Tag className="size-8 text-primary" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium">{t('data.tags.emptyTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('data.tags.emptyDescription')}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('data.tags.search')}
            aria-label={t('data.tags.search')}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary" className="w-fit tabular-nums">
          {t('data.tags.total', { count: usage.length })}
        </Badge>
      </div>

      {selectedTags.length >= 2 && (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="tag-merge-target" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              {t('data.tags.mergeInto', { count: selectedTags.length })}
            </Label>
            <Input
              id="tag-merge-target"
              value={mergeTarget}
              placeholder={selectedTags[0]}
              onChange={(event) => setMergeTarget(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && commitMerge()}
            />
          </div>
          <Button onClick={commitMerge}>
            <GitMerge className="size-4" />
            {t('data.tags.merge')}
          </Button>
        </div>
      )}

      <div className="max-h-96 overflow-y-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <th className="w-10 px-2 py-2.5 sm:px-3"><span className="sr-only">{t('data.tags.select')}</span></th>
              <th className="px-2 py-2.5 font-semibold sm:px-3">{t('data.tags.tag')}</th>
              <th className="px-2 py-2.5 text-right font-semibold sm:px-3">{t('data.tags.items')}</th>
              <th className="w-20 px-2 py-2.5 sm:w-24 sm:px-3"><span className="sr-only">{t('data.tags.actions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((entry) => {
              const isEditing = editing === entry.tag;
              const isSelected = selected.has(entry.tag);
              return (
                <tr key={entry.tag} className={cn('border-b transition-colors last:border-0 hover:bg-muted/30', isSelected && 'bg-primary/5 hover:bg-primary/5')}>
                  <td className="px-2 py-1.5 sm:px-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggle(entry.tag)}
                      aria-label={t('data.tags.selectTag', { tag: entry.tag })}
                    />
                  </td>
                  <td className="px-2 py-1.5 sm:px-3">
                    {isEditing ? (
                      <div className="space-y-1">
                        <Input
                          autoFocus
                          value={editValue}
                          aria-label={t('data.tags.renameLabel', { tag: entry.tag })}
                          onChange={(event) => setEditValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') commitRename();
                            if (event.key === 'Escape') setEditing(null);
                          }}
                          className="h-8"
                        />
                        {renameWillMerge && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">{t('data.tags.willMerge', { tag: editValue.trim() })}</p>
                        )}
                      </div>
                    ) : (
                      <Badge variant="secondary" className="max-w-full font-medium wrap-anywhere">{entry.tag}</Badge>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right sm:px-3">
                    <Badge variant="outline" className="text-xs tabular-nums">{formatNumber(entry.count)}</Badge>
                  </td>
                  <td className="px-2 py-1.5 sm:px-3">
                    <div className="flex justify-end gap-1">
                      {isEditing ? (
                        <>
                          <Button size="icon" variant="ghost" className="size-9 sm:size-8" onClick={commitRename} aria-label={t('common.save')}>
                            <Check className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-9 sm:size-8" onClick={() => setEditing(null)} aria-label={t('common.cancel')}>
                            <X className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-9 sm:size-8"
                            onClick={() => startEdit(entry.tag)}
                            aria-label={t('data.tags.renameLabel', { tag: entry.tag })}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-9 text-destructive hover:text-destructive sm:size-8"
                            onClick={() => setPendingDelete(entry.tag)}
                            aria-label={t('data.tags.deleteLabel', { tag: entry.tag })}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">{t('data.tags.noMatch')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={t('data.tags.deleteTitle', { tag: pendingDelete ?? '' })}
        description={t('data.tags.deleteBody', { count: pendingDeleteCount })}
        confirmLabel={t('common.delete')}
        destructive
      />
    </div>
  );
}
