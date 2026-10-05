import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Check, ClipboardList, FileText, PackageSearch, Printer, QrCode, Search } from 'lucide-react';

import { InventoryReportView } from '@/components/reports/InventoryReportView';
import { ItemSheet, StickerSheets, type SheetDetail } from '@/components/reports/ItemLabels';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageTransition } from '@/components/shared/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useT } from '@/i18n';
import { getAdminBreadcrumbs } from '@/lib/adminNavigation';
import { cn } from '@/lib/utils';
import { useCollectionStore } from '@/store/useCollectionStore';

type LabelMode = 'sheets' | 'stickers' | 'report';

function parseMode(value: string | null): LabelMode {
  return value === 'stickers' || value === 'report' ? value : 'sheets';
}

export default function AdminPrintLabels() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQueryString = searchParams.toString();
  const mode = parseMode(searchParams.get('mode'));
  const items = useCollectionStore((s) => s.items);
  const categories = useCollectionStore((s) => s.categories);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<SheetDetail>('compact');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [categories],
  );

  const activeItems = useMemo(() => items.filter((item) => !item.isArchived), [items]);

  const filtered = useMemo(() => {
    const scoped = categoryFilter === 'all'
      ? activeItems
      : activeItems.filter((item) => item.categoryId === categoryFilter);
    const q = search.trim().toLocaleLowerCase();
    if (!q) return scoped;
    return scoped.filter((item) => (
      item.title.toLocaleLowerCase().includes(q)
      || (categoryNameById.get(item.categoryId)?.toLocaleLowerCase().includes(q) ?? false)
      || (item.location?.toLocaleLowerCase().includes(q) ?? false)
    ));
  }, [activeItems, search, categoryFilter, categoryNameById]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((item) => selected.has(item.id));
  const toggleAll = () => {
    setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((item) => item.id)));
  };

  const selectedItems = useMemo(() => activeItems.filter((item) => selected.has(item.id)), [activeItems, selected]);

  const setMode = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'sheets') params.delete('mode');
    else params.set('mode', next);
    setSearchParams(params, { replace: true });
  };

  const description = mode === 'report'
    ? t('labels.descriptionReport')
    : mode === 'stickers' ? t('labels.descriptionStickers') : t('labels.descriptionSheets');

  const eyebrowClass = 'text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground';

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <div className="print:hidden">
          <PageHeader
            title={t('labels.title')}
            description={description}
            breadcrumbs={getAdminBreadcrumbs(searchQueryString ? `?${searchQueryString}` : '', [{ label: t('labels.title') }])}
          >
            {mode !== 'report' && (
              <Button onClick={() => window.print()} disabled={selected.size === 0} className="gap-2">
                <Printer className="size-4" />
                {selected.size > 0 ? t('labels.printCount', { count: selected.size }) : t('labels.print')}
              </Button>
            )}
          </PageHeader>

          <div className="mt-4 flex flex-col gap-2">
            <p className={eyebrowClass}>{t('labels.modeLabel')}</p>
            <Tabs value={mode} onValueChange={setMode} className="w-full">
              <TabsList aria-label={t('labels.modeLabel')} className="h-auto w-full max-w-xl justify-start rounded-xl p-1">
                <TabsTrigger value="sheets" className="flex-1 gap-2 rounded-lg">
                  <FileText className="size-4" aria-hidden="true" />
                  {t('labels.mode.sheets')}
                </TabsTrigger>
                <TabsTrigger value="stickers" className="flex-1 gap-2 rounded-lg">
                  <QrCode className="size-4" aria-hidden="true" />
                  {t('labels.mode.stickers')}
                </TabsTrigger>
                <TabsTrigger value="report" className="flex-1 gap-2 rounded-lg">
                  <ClipboardList className="size-4" aria-hidden="true" />
                  {t('labels.mode.report')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {mode !== 'report' && (
            <>
              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="w-full lg:w-[240px]">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger aria-label={t('labels.filterCategory')}>
                      <SelectValue placeholder={t('labels.allCategories')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('labels.allCategories')}</SelectItem>
                      {sortedCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="relative max-w-sm flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('labels.search')}
                    aria-label={t('labels.search')}
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={toggleAll} className="shrink-0 gap-1.5" disabled={filtered.length === 0}>
                  <Check className="size-3.5" />
                  {allFilteredSelected ? t('labels.deselectAll') : t('labels.selectAll')}
                </Button>
                <Badge variant={selected.size > 0 ? 'secondary' : 'outline'} className="w-fit tabular-nums lg:ml-auto">
                  {t('labels.selectedCount', { count: selected.size })}
                </Badge>
              </div>

              {mode === 'sheets' ? (
                <div className="mt-4 flex flex-col gap-2">
                  <p className={eyebrowClass}>{t('labels.detail')}</p>
                  <Tabs value={detail} onValueChange={(next) => setDetail(next as SheetDetail)} className="w-full">
                    <TabsList aria-label={t('labels.detail')} className="h-auto w-full max-w-md justify-start rounded-xl p-1">
                      <TabsTrigger value="compact" className="flex-1 rounded-lg">{t('labels.detail.compact')}</TabsTrigger>
                      <TabsTrigger value="full" className="flex-1 rounded-lg">{t('labels.detail.full')}</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <p className="text-sm text-muted-foreground">
                    {detail === 'compact' ? t('labels.detail.compactHint') : t('labels.detail.fullHint')}
                  </p>
                </div>
              ) : (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <QrCode className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">{t('labels.stickersHint')}</p>
                </div>
              )}

              {filtered.length === 0 ? (
                <div className="mt-4 flex flex-col items-center gap-2 py-8 text-center">
                  <PackageSearch className="size-8 text-muted-foreground/40" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">{t('labels.noItems')}</p>
                  <p className="text-xs text-muted-foreground">{t('labels.noItemsHint')}</p>
                </div>
              ) : (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((item) => {
                    const categoryName = categoryNameById.get(item.categoryId);
                    const isSelected = selected.has(item.id);
                    const checkboxId = `label-item-${item.id}`;
                    return (
                      <li key={item.id}>
                        <label
                          htmlFor={checkboxId}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                            isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                          )}
                        >
                          <Checkbox id={checkboxId} checked={isSelected} onCheckedChange={() => toggleSelect(item.id)} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{item.title}</span>
                            <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                              {categoryName && (
                                <Badge variant="secondary" className="shrink-0 text-[10px]">{categoryName}</Badge>
                              )}
                              {item.location && (
                                <span className="truncate text-[11px] text-muted-foreground">{item.location}</span>
                              )}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        {mode === 'report' && <InventoryReportView />}

        {mode !== 'report' && selectedItems.length > 0 && (
          <>
            <div className="hidden print:block">
              {mode === 'stickers' ? (
                <StickerSheets items={selectedItems} categoryNameById={categoryNameById} />
              ) : (
                selectedItems.map((item) => {
                  const category = categoryById.get(item.categoryId);
                  return (
                    <div key={item.id} className="curio-page-break last:break-after-auto">
                      <ItemSheet
                        item={item}
                        categoryName={category?.name}
                        categoryFields={category?.fields ?? []}
                        detail={detail}
                      />
                    </div>
                  );
                })
              )}
            </div>

            <section className="print:hidden">
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                {t('labels.preview', { count: selectedItems.length })}
              </h2>
              <Card>
                <CardContent className="p-4">
                  {mode === 'stickers' ? (
                    <StickerSheets items={selectedItems} categoryNameById={categoryNameById} />
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {selectedItems.map((item) => {
                        const category = categoryById.get(item.categoryId);
                        return (
                          <ItemSheet
                            key={item.id}
                            item={item}
                            categoryName={category?.name}
                            categoryFields={category?.fields ?? []}
                            detail={detail}
                          />
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>
    </PageTransition>
  );
}
