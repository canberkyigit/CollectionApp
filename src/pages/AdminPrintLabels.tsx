import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, Search, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageTransition } from '@/components/shared/motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAdminBreadcrumbs } from '@/lib/adminNavigation';
import { useCollectionStore } from '@/store/useCollectionStore';
import { cn } from '@/lib/utils';
import type { CategoryField, CollectionItem } from '@/types';

type PrintMode = 'compact' | 'full';

function formatDate(value?: string) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function formatCurrency(value?: number, currency?: string) {
  if (typeof value !== 'number' || Number.isNaN(value) || !currency) return 'N/A';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function hasCustomFieldValue(field: CategoryField, value: unknown) {
  if (field.type === 'boolean') return value != null;
  if (Array.isArray(value)) return value.length > 0;
  return value != null && value !== '';
}

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars).trimEnd()}...`;
}

function formatCustomFieldValue(field: CategoryField, value: unknown, mode: PrintMode) {
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  if (field.type === 'date' && typeof value === 'string') return formatDate(value);
  if (field.type === 'currency' && typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    const joined = value.join(', ');
    return mode === 'compact' ? truncateText(joined, 90) : joined;
  }

  const rendered = String(value);
  return mode === 'compact' ? truncateText(rendered, 120) : rendered;
}

function ItemPrintCard({
  item,
  categoryName,
  categoryFields,
  mode,
}: {
  item: CollectionItem;
  categoryName?: string;
  categoryFields: CategoryField[];
  mode: PrintMode;
}) {
  const coverImage = item.images[0];
  const visibleCustomFields = categoryFields.filter((field) => {
    if (
      field.key === 'title' ||
      field.key === 'notes' ||
      field.key === 'condition' ||
      field.key === 'quantity' ||
      field.type === 'image'
    ) {
      return false;
    }
    return hasCustomFieldValue(field, item.customFields[field.key]);
  });
  const customFieldsToShow = mode === 'compact' ? visibleCustomFields.slice(0, 6) : visibleCustomFields;
  const compactDescription = mode === 'compact'
    ? truncateText(item.description || 'No description provided.', 280)
    : (item.description || 'No description provided.');
  const compactNotes = mode === 'compact'
    ? truncateText(item.notes || 'No notes yet.', 320)
    : (item.notes || 'No notes yet.');
  const tagsToShow = mode === 'compact' ? item.tags.slice(0, 8) : item.tags;
  const hiddenTagCount = item.tags.length - tagsToShow.length;

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-300 bg-white text-slate-950 shadow-none print:rounded-none print:border-0 print:shadow-none',
        mode === 'compact' ? 'print:break-inside-avoid' : 'print:break-inside-auto',
      )}
    >
      <div className="grid gap-6 p-6 print:grid-cols-[220px_minmax(0,1fr)] print:gap-8 print:p-0">
        <div className="space-y-4 print:break-inside-avoid">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {coverImage ? (
              <img
                src={coverImage}
                alt={item.title}
                className="h-[300px] w-full object-cover print:h-[320px]"
              />
            ) : (
              <div className="flex h-[300px] items-center justify-center px-6 text-center text-sm text-slate-500 print:h-[320px]">
                No image available
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 text-center">
            <div className="mx-auto flex w-fit rounded-xl bg-white p-2">
              <QRCodeSVG
                value={`${window.location.origin}/items/${item.id}`}
                size={112}
                includeMargin={false}
              />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">QR Code</p>
            <p className="mt-1 text-xs text-slate-600">Scan to open this item in ESC</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="border-b border-slate-200 pb-4 print:break-inside-avoid">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{categoryName ?? 'Collection Item'}</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight">{item.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-300 px-3 py-1 font-medium">
                Condition: {item.condition || 'N/A'}
              </span>
              <span className="rounded-full border border-slate-300 px-3 py-1 font-medium">
                Quantity: {item.quantity ?? 1}
              </span>
              {item.location && (
                <span className="rounded-full border border-slate-300 px-3 py-1 font-medium">
                  Location: {item.location}
                </span>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2 print:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 p-4 print:break-inside-avoid">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Summary</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Created</dt>
                  <dd className="mt-1 font-medium">{formatDate(item.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Updated</dt>
                  <dd className="mt-1 font-medium">{formatDate(item.updatedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Purchase Date</dt>
                  <dd className="mt-1 font-medium">{formatDate(item.purchaseInfo.purchasedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Purchase Price</dt>
                  <dd className="mt-1 font-medium">
                    {formatCurrency(item.purchaseInfo.purchasePrice, item.purchaseInfo.purchaseCurrency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Current Value</dt>
                  <dd className="mt-1 font-medium">
                    {formatCurrency(item.valuationInfo.currentEstimatedValue, item.valuationInfo.currentValueCurrency)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className={cn('rounded-2xl border border-slate-200 p-4', mode === 'compact' ? 'print:break-inside-avoid' : 'print:break-inside-auto')}>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Description</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {compactDescription}
              </p>
            </section>
          </div>

          {customFieldsToShow.length > 0 && (
            <section className="mt-5 rounded-2xl border border-slate-200 p-4 print:break-inside-avoid">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Item Details</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2 print:grid-cols-2">
                {customFieldsToShow.map((field) => (
                  <div key={field.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{field.label}</p>
                    <p className="mt-1 text-sm font-medium leading-5 text-slate-900">
                      {formatCustomFieldValue(field, item.customFields[field.key], mode)}
                    </p>
                  </div>
                ))}
              </div>
              {mode === 'compact' && visibleCustomFields.length > customFieldsToShow.length && (
                <p className="mt-3 text-xs text-slate-500">
                  {visibleCustomFields.length - customFieldsToShow.length} more detail field{visibleCustomFields.length - customFieldsToShow.length > 1 ? 's' : ''} available in Full Detail mode.
                </p>
              )}
            </section>
          )}

          {(item.notes || item.tags.length > 0) && (
            <div className="mt-5 grid gap-5 md:grid-cols-2 print:grid-cols-2">
              <section className={cn('rounded-2xl border border-slate-200 p-4', mode === 'compact' ? 'print:break-inside-avoid' : 'print:break-inside-auto')}>
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Notes</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {compactNotes}
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 print:break-inside-avoid">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Tags</h2>
                {tagsToShow.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tagsToShow.map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700">
                        {tag}
                      </span>
                    ))}
                    {hiddenTagCount > 0 && (
                      <span className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-medium text-slate-500">
                        +{hiddenTagCount} more
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No tags assigned.</p>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function AdminPrintLabels() {
  const [searchParams] = useSearchParams();
  const searchQueryString = searchParams.toString();
  const { items, categories } = useCollectionStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printMode, setPrintMode] = useState<PrintMode>('compact');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const activeItems = useMemo(
    () => items.filter((i) => !i.isArchived),
    [items],
  );

  const filtered = useMemo(() => {
    const categoryScopedItems = categoryFilter === 'all'
      ? activeItems
      : activeItems.filter((item) => item.categoryId === categoryFilter);
    if (!search.trim()) return categoryScopedItems;
    const q = search.toLowerCase();
    return categoryScopedItems.filter(
      (i) => i.title.toLowerCase().includes(q) || (categoryNameById.get(i.categoryId)?.toLowerCase().includes(q) ?? false),
    );
  }, [activeItems, search, categoryFilter, categoryNameById]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  };

  const selectedItems = useMemo(
    () => activeItems.filter((i) => selected.has(i.id)),
    [activeItems, selected],
  );

  const handlePrint = () => window.print();

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <div className="print:hidden">
          <PageHeader
            title="Print Labels"
            description="Select items and print QR code labels for your collection"
            breadcrumbs={getAdminBreadcrumbs(searchQueryString ? `?${searchQueryString}` : '', [{ label: 'Print Labels' }])}
          >
            <Button onClick={handlePrint} disabled={selected.size === 0} className="gap-2">
              <Printer className="size-4" />
              Print {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          </PageHeader>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="w-full lg:w-[240px]">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories
                    .slice()
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={toggleAll} className="gap-1.5 shrink-0">
              <Check className="size-3.5" />
              {selected.size === filtered.length && filtered.length > 0 ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Print Mode</p>
            <Tabs value={printMode} onValueChange={(next) => setPrintMode(next as PrintMode)} className="w-full">
              <TabsList className="h-auto w-full max-w-md justify-start rounded-xl p-1">
                <TabsTrigger value="compact" className="flex-1 rounded-lg">Compact</TabsTrigger>
                <TabsTrigger value="full" className="flex-1 rounded-lg">Full Detail</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-sm text-muted-foreground">
              {printMode === 'compact'
                ? 'Compact trims long notes, descriptions, tags, and extra fields to help each item stay neat on one page.'
                : 'Full Detail prints all available content and allows long sections to flow across pages with cleaner page breaks.'}
            </p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => {
              const cat = categoryNameById.get(item.categoryId);
              const isSelected = selected.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                    isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(item.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    {cat && <Badge variant="secondary" className="mt-0.5 text-[10px]">{cat}</Badge>}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No items found</p>
            )}
          </div>
        </div>

        {selectedItems.length > 0 && (
          <div className="hidden bg-white text-black print:block">
            <div className="space-y-6 print:space-y-0">
              {selectedItems.map((item) => {
                const category = categoryById.get(item.categoryId);
                return (
                  <div
                    key={item.id}
                    className="print:break-after-page last:print:break-after-auto"
                  >
                    <ItemPrintCard
                      item={item}
                      categoryName={category?.name}
                      categoryFields={category?.fields ?? []}
                      mode={printMode}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {selectedItems.length > 0 && (
          <div className="print:hidden">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Preview ({selectedItems.length} items)</h3>
            <Card>
              <CardContent className="p-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  {selectedItems.map((item) => {
                    const category = categoryById.get(item.categoryId);
                    return (
                      <ItemPrintCard
                        key={item.id}
                        item={item}
                        categoryName={category?.name}
                        categoryFields={category?.fields ?? []}
                        mode={printMode}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
