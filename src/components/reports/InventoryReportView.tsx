import { useMemo, useState } from 'react';

import { Eye, FileText, Info, Printer, SlidersHorizontal } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useT } from '@/i18n';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useCollectionStore } from '@/store/useCollectionStore';

import { InventoryReport } from './InventoryReport';
import { DEFAULT_REPORT_FILTERS, buildReportTotals, filterReportItems, type ReportFilters } from './reportData';

/** Filters + "Save as PDF" controls (hidden in print) and the printable report itself. */
export function InventoryReportView() {
  const t = useT();
  const items = useCollectionStore((s) => s.items);
  const categories = useCollectionStore((s) => s.categories);
  const libraries = useCollectionStore((s) => s.libraries);
  const displayCurrency = useCollectionStore((s) => s.displayCurrency);
  const user = useAuthStore((s) => s.user);

  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_REPORT_FILTERS);
  const [minValueInput, setMinValueInput] = useState('');
  const [ownerName, setOwnerName] = useState(user?.displayName ?? '');
  const [generatedAt] = useState(() => new Date().toISOString());

  const sortedCategories = useMemo(
    () => [...categories].sort((left, right) => (left.order ?? 0) - (right.order ?? 0)),
    [categories],
  );
  const availableLibraries = useMemo(
    () => libraries.filter((library) => {
      if (filters.categoryId === 'all') return true;
      const ids = library.categoryIds ?? (library.categoryId ? [library.categoryId] : []);
      return ids.length === 0 || ids.includes(filters.categoryId);
    }),
    [libraries, filters.categoryId],
  );

  const reportItems = useMemo(
    () => filterReportItems(items, filters, displayCurrency),
    [items, filters, displayCurrency],
  );
  const totals = useMemo(
    () => buildReportTotals(reportItems, categories, displayCurrency),
    [reportItems, categories, displayCurrency],
  );

  const scopeLabel = useMemo(() => {
    const parts: string[] = [];
    if (filters.categoryId !== 'all') {
      parts.push(categories.find((category) => category.id === filters.categoryId)?.name ?? '');
    }
    if (filters.libraryId !== 'all') {
      parts.push(libraries.find((library) => library.id === filters.libraryId)?.name ?? '');
    }
    if (filters.minValue !== null) {
      parts.push(t('report.scopeMinValue', { value: formatCurrency(filters.minValue, displayCurrency) }));
    }
    return parts.filter(Boolean).length > 0
      ? t('report.scopeFiltered', { filters: parts.filter(Boolean).join(' · ') })
      : t('report.scopeAll');
  }, [filters, categories, libraries, displayCurrency, t]);

  const updateMinValue = (raw: string) => {
    setMinValueInput(raw);
    const parsed = Number(raw.replace(',', '.'));
    setFilters((prev) => ({ ...prev, minValue: raw.trim() === '' || !Number.isFinite(parsed) ? null : parsed }));
  };

  const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground';

  return (
    <div className="space-y-6">
      <Card className="print:hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-primary/10 p-3">
              <SlidersHorizontal className="size-6 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle>{t('report.controlsTitle')}</CardTitle>
              <CardDescription>{t('report.controlsDescription')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="report-category" className={labelClass}>{t('report.filterCategory')}</Label>
              <Select
                value={filters.categoryId}
                onValueChange={(categoryId) => setFilters((prev) => ({ ...prev, categoryId, libraryId: 'all' }))}
              >
                <SelectTrigger id="report-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('report.allCategories')}</SelectItem>
                  {sortedCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-library" className={labelClass}>{t('report.filterLibrary')}</Label>
              <Select
                value={filters.libraryId}
                onValueChange={(libraryId) => setFilters((prev) => ({ ...prev, libraryId }))}
                disabled={availableLibraries.length === 0}
              >
                <SelectTrigger id="report-library"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('report.allLibraries')}</SelectItem>
                  {availableLibraries.map((library) => (
                    <SelectItem key={library.id} value={library.id}>{library.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-min-value" className={labelClass}>
                {t('report.filterMinValue', { currency: displayCurrency })}
              </Label>
              <Input
                id="report-min-value"
                inputMode="decimal"
                value={minValueInput}
                placeholder="0"
                onChange={(event) => updateMinValue(event.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-owner" className={labelClass}>{t('report.owner')}</Label>
              <Input id="report-owner" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="report-archived"
              checked={filters.includeArchived}
              onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, includeArchived: checked === true }))}
            />
            <Label htmlFor="report-archived" className="text-sm font-normal">{t('report.includeArchived')}</Label>
          </div>

          <Separator />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Badge variant="secondary" className="w-fit px-3 py-1 text-sm tabular-nums">
              {t('report.selectionSummary', {
                count: totals.count,
                value: formatCurrency(totals.currentTotal, displayCurrency),
              })}
            </Badge>
            <Button onClick={() => window.print()} disabled={totals.count === 0} className="gap-2">
              <Printer className="size-4" />
              {t('report.print')}
            </Button>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">{t('report.pdfHint')}</p>
          </div>
        </CardContent>
      </Card>

      {totals.count === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-12 text-center print:hidden">
          <div className="rounded-full bg-primary/10 p-4">
            <FileText className="size-8 text-primary" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium">{t('report.emptyTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('report.emptyDescription')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
          <p className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground print:hidden">
            <Eye className="size-3.5" aria-hidden="true" />
            {t('report.previewLabel', { count: formatNumber(totals.count) })}
          </p>
          <InventoryReport
            items={reportItems}
            categories={categories}
            displayCurrency={displayCurrency}
            ownerName={ownerName}
            scopeLabel={scopeLabel}
            generatedAt={generatedAt}
          />
        </div>
      )}
    </div>
  );
}
