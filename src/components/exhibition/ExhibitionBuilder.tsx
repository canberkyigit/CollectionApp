import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ImageOff, Plus, Search, Sparkles, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useT } from '@/i18n';
import { matchesQuery } from '@/lib/search';
import { useSavedExhibitionsStore, type SavedExhibition } from '@/lib/savedExhibitions';
import { cn } from '@/lib/utils';
import { useCollectionStore } from '@/store/useCollectionStore';
import type { CollectionItem } from '@/types';

interface ExhibitionBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this exhibition; omit to create a new one. */
  exhibition?: SavedExhibition | null;
  /** Starting point for a new exhibition (e.g. saving a ready-made one). */
  initialName?: string;
  initialItemIds?: string[];
  onSaved?: (exhibition: SavedExhibition) => void;
}

const EYEBROW = 'text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground';

function Thumb({ item }: { item: CollectionItem }) {
  const image = item.images?.find(Boolean);
  return image ? (
    <img src={image} alt="" className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-border/60" />
  ) : (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border/60">
      <ImageOff className="size-4" aria-hidden="true" />
    </span>
  );
}

/** Create or edit a saved exhibition: pick items on the left, order them on the right. */
export function ExhibitionBuilder({ open, onOpenChange, exhibition, initialName, initialItemIds, onSaved }: ExhibitionBuilderProps) {
  const t = useT();
  const items = useCollectionStore((state) => state.items);
  const categories = useCollectionStore((state) => state.categories);
  const ownerUserId = useCollectionStore((state) => state.ownerUserId);
  const addExhibition = useSavedExhibitionsStore((state) => state.addExhibition);
  const updateExhibition = useSavedExhibitionsStore((state) => state.updateExhibition);

  const [name, setName] = useState(exhibition?.name ?? initialName ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>(exhibition?.itemIds ?? initialItemIds ?? []);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const activeItems = useMemo(() => items.filter((item) => !item.isArchived), [items]);
  const itemById = useMemo(() => new Map(activeItems.map((item) => [item.id, item])), [activeItems]);
  const categoryName = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = selectedIds.map((id) => itemById.get(id)).filter((item): item is CollectionItem => Boolean(item));

  const candidates = useMemo(() => activeItems
    .filter((item) => categoryFilter === 'all' || item.categoryId === categoryFilter)
    .filter((item) => !query.trim() || matchesQuery(query, item.title, item.description, categoryName.get(item.categoryId)))
    // Photographed pieces first — they make better slides.
    .sort((a, b) => Number(Boolean(b.images?.some(Boolean))) - Number(Boolean(a.images?.some(Boolean))) || a.title.localeCompare(b.title)),
  [activeItems, categoryFilter, query, categoryName]);

  const toggle = (id: string) => setSelectedIds((current) => (
    current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
  ));
  const move = (index: number, delta: number) => setSelectedIds((current) => {
    const next = [...current];
    const target = index + delta;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const canSave = name.trim().length > 0 && selectedItems.length > 0;
  const save = () => {
    if (!canSave) return;
    const itemIds = selectedItems.map((item) => item.id);
    if (exhibition) {
      updateExhibition(exhibition.id, { name, itemIds });
      onSaved?.({ ...exhibition, name: name.trim(), itemIds });
    } else {
      onSaved?.(addExhibition({ name, itemIds, ownerUserId }));
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
            </span>
            {exhibition ? t('exhibition.builder.editTitle') : t('exhibition.builder.createTitle')}
          </DialogTitle>
          <DialogDescription>{t('exhibition.builder.description')}</DialogDescription>
          <div className="space-y-1.5 pt-3">
            <Label htmlFor="exhibition-name">{t('exhibition.builder.name')}</Label>
            <Input
              id="exhibition-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('exhibition.builder.namePlaceholder')}
              maxLength={80}
              autoFocus
            />
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto md:grid-cols-2 md:overflow-hidden">
          {/* Picker */}
          <section className="flex min-h-0 flex-col border-b border-border/70 md:border-b-0 md:border-r" aria-labelledby="exhibition-builder-items">
            <div className="space-y-2 px-5 pt-4 sm:px-6">
              <p id="exhibition-builder-items" className={EYEBROW}>{t('exhibition.builder.items')}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('exhibition.builder.search')}
                    aria-label={t('exhibition.builder.search')}
                    className="pl-9"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="sm:w-44" aria-label={t('exhibition.builder.category')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('exhibition.allCollections')}</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ul className="max-h-72 min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3 scrollbar-thin md:max-h-none sm:px-4">
              {candidates.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">{t('exhibition.builder.noMatches')}</li>
              )}
              {candidates.map((item) => {
                const selected = selectedSet.has(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      aria-pressed={selected}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selected ? 'bg-primary/10 ring-1 ring-primary/25' : 'hover:bg-accent',
                      )}
                    >
                      <Thumb item={item} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium" title={item.title}>{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{categoryName.get(item.categoryId)}</span>
                      </span>
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors',
                          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground',
                        )}
                        aria-hidden="true"
                      >
                        {selected ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Order */}
          <section className="flex min-h-0 flex-col" aria-labelledby="exhibition-builder-order">
            <div className="flex items-center justify-between px-5 pt-4 sm:px-6">
              <p id="exhibition-builder-order" className={EYEBROW}>{t('exhibition.builder.order')}</p>
              <Badge variant="secondary" className="rounded-full tabular-nums">{selectedItems.length}</Badge>
            </div>
            {selectedItems.length === 0 ? (
              <div className="m-5 flex flex-1 items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground sm:m-6">
                {t('exhibition.builder.empty')}
              </div>
            ) : (
              <ol className="max-h-72 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3 scrollbar-thin md:max-h-none sm:px-4">
                {selectedItems.map((item, index) => (
                  <li key={item.id} className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card px-2.5 py-2">
                    <span className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">{index + 1}</span>
                    <Thumb item={item} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium" title={item.title}>{item.title}</span>
                    <div className="flex shrink-0 items-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 sm:size-8"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        aria-label={t('exhibition.builder.moveUp', { title: item.title })}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 sm:size-8"
                        onClick={() => move(index, 1)}
                        disabled={index === selectedItems.length - 1}
                        aria-label={t('exhibition.builder.moveDown', { title: item.title })}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 text-muted-foreground hover:text-destructive sm:size-8"
                        onClick={() => toggle(item.id)}
                        aria-label={t('exhibition.builder.remove', { title: item.title })}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <DialogFooter className="gap-2 border-t border-border/70 px-5 py-4 sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={save} disabled={!canSave}>
            {exhibition ? t('exhibition.builder.saveChanges') : t('exhibition.builder.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
