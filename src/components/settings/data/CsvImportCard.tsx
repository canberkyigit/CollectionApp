import { useCallback, useMemo, useRef, useState } from 'react';

import { AlertCircle, Columns3, FileSpreadsheet, FileUp, Table2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { cn, formatNumber } from '@/lib/utils';
import { detectCsvDelimiter, parseCSV, type CsvDelimiter } from '@/services/csvService';
import {
  IMPORT_BUILT_IN_FIELDS,
  applyMappingOverrides,
  buildAutoCsvMapping,
  buildCsvImportPreview,
  buildItemFromCsvPreviewRow,
} from '@/services/importPreviewService';
import { useCollectionStore } from '@/store/useCollectionStore';

import { PanelCardHeader } from './PanelCardHeader';

const NOT_MAPPED = '__none__';
const AUTO_DELIMITER = 'auto';
const PREVIEW_ROWS = 5;

type DelimiterChoice = CsvDelimiter | typeof AUTO_DELIMITER;

interface MappingOverrides {
  builtInFields?: Record<string, string>;
  customFields?: Record<string, string>;
}

const DELIMITER_KEYS: Record<CsvDelimiter, string> = {
  ',': 'data.csv.delimiter.comma',
  ';': 'data.csv.delimiter.semicolon',
  '\t': 'data.csv.delimiter.tab',
};

function formatPreviewValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? '✓' : '—';
  return String(value);
}

interface CsvImportCardProps {
  contributorId: string;
}

export function CsvImportCard({ contributorId }: CsvImportCardProps) {
  const t = useT();
  const categories = useCollectionStore((s) => s.categories);
  const bulkAddItems = useCollectionStore((s) => s.bulkAddItems);
  const inputRef = useRef<HTMLInputElement>(null);

  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [delimiterChoice, setDelimiterChoice] = useState<DelimiterChoice>(AUTO_DELIMITER);
  const [categoryId, setCategoryId] = useState('');
  const [overrides, setOverrides] = useState<MappingOverrides>({});

  const csvData = useMemo(
    () => (csvText === null
      ? null
      : parseCSV(csvText, delimiterChoice === AUTO_DELIMITER ? undefined : delimiterChoice)),
    [csvText, delimiterChoice],
  );
  const detectedDelimiter = useMemo(() => (csvText === null ? ',' : detectCsvDelimiter(csvText)), [csvText]);
  const category = categories.find((entry) => entry.id === categoryId);

  const mappingPreview = useMemo(() => {
    if (!csvData || !category) return null;
    const auto = buildAutoCsvMapping(csvData.headers, category);
    const mapping = applyMappingOverrides(auto, overrides, csvData.headers);
    const preview = buildCsvImportPreview(csvData.headers, csvData.rows, category, mapping);
    return { mapping, preview };
  }, [csvData, category, overrides]);

  const importableCount = mappingPreview?.preview.filter((row) => row.canImport).length ?? 0;
  const issues = useMemo(
    () => mappingPreview?.preview.flatMap((row) => row.issues.map((issue) => ({ ...issue, rowNumber: row.rowIndex + 2 }))) ?? [],
    [mappingPreview],
  );

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = typeof event.target?.result === 'string' ? event.target.result : '';
      const parsed = parseCSV(text);
      if (parsed.headers.length === 0) {
        toast.error(t('data.csv.emptyFile'));
        return;
      }
      setFileName(file.name);
      setCsvText(text);
      setDelimiterChoice(AUTO_DELIMITER);
      setOverrides({});
    };
    reader.onerror = () => toast.error(t('data.csv.readError'));
    reader.readAsText(file);
  }, [t]);

  const reset = () => {
    setCsvText(null);
    setFileName('');
    setCategoryId('');
    setOverrides({});
    setDelimiterChoice(AUTO_DELIMITER);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleImport = () => {
    if (!csvData || !category || !mappingPreview) return;
    if (!mappingPreview.mapping.builtInFields.title) {
      toast.error(t('data.csv.noTitleColumn'), { description: t('data.csv.noTitleColumnHint') });
      return;
    }

    const importable = mappingPreview.preview.filter((row) => row.canImport);
    const payload = importable.map((row) => buildItemFromCsvPreviewRow(
      row,
      csvData.headers,
      csvData.rows[row.rowIndex],
      mappingPreview.mapping,
      contributorId,
    ));
    const count = bulkAddItems(payload);
    const skipped = mappingPreview.preview.length - count;
    toast.success(t('data.import.success', { count }), {
      description: skipped > 0
        ? t('data.csv.skippedRows', { count: skipped })
        : t('data.import.successHint'),
    });
    reset();
  };

  const setBuiltIn = (field: string, value: string) => {
    setOverrides((prev) => ({ ...prev, builtInFields: { ...prev.builtInFields, [field]: value } }));
  };
  const setCustom = (field: string, value: string) => {
    setOverrides((prev) => ({ ...prev, customFields: { ...prev.customFields, [field]: value } }));
  };

  const headerOptions = csvData?.headers ?? [];
  const firstRow = csvData?.rows[0] ?? [];
  const sampleFor = (header: string) => {
    if (!header || !csvData) return '';
    const index = csvData.headers.indexOf(header);
    return index === -1 ? '' : firstRow[index] ?? '';
  };

  const renderColumnSelect = (
    id: string,
    label: string,
    current: string,
    onChange: (header: string) => void,
  ) => {
    const index = current ? headerOptions.indexOf(current) : -1;
    return (
      <Select
        value={index === -1 ? NOT_MAPPED : String(index)}
        onValueChange={(next) => onChange(next === NOT_MAPPED ? '' : headerOptions[Number(next)] ?? '')}
      >
        <SelectTrigger id={id} aria-label={t('data.csv.columnFor', { field: label })} className="h-8 rounded-lg text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NOT_MAPPED}>{t('data.csv.notImported')}</SelectItem>
          {headerOptions.map((header, headerIndex) => (
            <SelectItem key={`${header}-${headerIndex}`} value={String(headerIndex)}>
              {header || t('data.csv.columnNumber', { index: headerIndex + 1 })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const mappedCustomFields = category?.fields.filter((field) => mappingPreview?.mapping.customFields[field.key]) ?? [];
  const previewBuiltIns = (['condition', 'purchasePrice', 'location'] as const)
    .filter((field) => mappingPreview?.mapping.builtInFields[field]);
  const thClass = 'whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground';

  return (
    <Card>
      <PanelCardHeader
        icon={FileSpreadsheet}
        title={t('data.csv.cardTitle')}
        description={t('data.csv.cardDescription')}
      />
      <CardContent className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          aria-label={t('data.csv.chooseFile')}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        <button
          type="button"
          className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
          onClick={() => inputRef.current?.click()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragEnter={(event) => event.preventDefault()}
        >
          <FileUp className="size-8 text-muted-foreground" aria-hidden="true" />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">{fileName || t('data.csv.drop')}</span>
            <span className="block text-xs text-muted-foreground">{t('data.csv.dropHint')}</span>
          </span>
        </button>

        {csvData && (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{t('data.json.preview')}</span>
              <Badge variant="secondary" className="tabular-nums">
                {t('data.csv.summary', {
                  rows: formatNumber(csvData.rows.length),
                  columns: formatNumber(csvData.headers.length),
                })}
              </Badge>
            </div>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="csv-import-delimiter">{t('data.csv.separator')}</Label>
                <Select
                  value={delimiterChoice === '\t' ? 'tab' : delimiterChoice}
                  onValueChange={(next) => {
                    setDelimiterChoice(next === 'tab' ? '\t' : next as DelimiterChoice);
                    setOverrides({});
                  }}
                >
                  <SelectTrigger id="csv-import-delimiter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO_DELIMITER}>
                      {t('data.csv.delimiter.auto', { delimiter: t(DELIMITER_KEYS[detectedDelimiter]) })}
                    </SelectItem>
                    <SelectItem value=",">{t('data.csv.delimiter.comma')}</SelectItem>
                    <SelectItem value=";">{t('data.csv.delimiter.semicolon')}</SelectItem>
                    <SelectItem value="tab">{t('data.csv.delimiter.tab')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="csv-import-category">{t('data.csv.assignCategory')}</Label>
                <Select
                  value={categoryId}
                  onValueChange={(next) => {
                    setCategoryId(next);
                    setOverrides({});
                  }}
                >
                  <SelectTrigger id="csv-import-category" aria-label={t('data.csv.assignCategory')}>
                    <SelectValue placeholder={t('data.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {mappingPreview && category && (
              <>
                <Separator />

                <section className="space-y-3 rounded-md border bg-background p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <h3 className="flex items-center gap-2 text-sm font-medium">
                        <Columns3 className="size-4 text-primary" aria-hidden="true" />
                        {t('data.csv.mappingTitle')}
                      </h3>
                      <p className="text-xs text-muted-foreground">{t('data.csv.mappingHint')}</p>
                    </div>
                  </div>

                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-md bg-muted/40 px-3 py-2">
                      <span className="text-muted-foreground">{t('data.csv.titleColumn')}</span>
                      <p className={cn('mt-1 font-medium', !mappingPreview.mapping.builtInFields.title && 'text-destructive')}>
                        {mappingPreview.mapping.builtInFields.title || t('data.csv.notDetected')}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/40 px-3 py-2">
                      <span className="text-muted-foreground">{t('data.csv.customFields')}</span>
                      <p className="mt-1 font-medium tabular-nums">
                        {t('data.csv.mappedCount', { count: mappedCustomFields.length })}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className={thClass}>{t('data.csv.field')}</th>
                          <th className={thClass}>{t('data.csv.column')}</th>
                          <th className={cn(thClass, 'hidden sm:table-cell')}>{t('data.csv.sample')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {IMPORT_BUILT_IN_FIELDS.map((field) => {
                          const label = t(`data.field.${field}`);
                          const current = mappingPreview.mapping.builtInFields[field] ?? '';
                          return (
                            <tr key={field} className="border-b transition-colors last:border-0 hover:bg-muted/30">
                              <td className="px-3 py-1.5 font-medium">
                                <label htmlFor={`csv-map-${field}`}>{label}</label>
                                {field === 'title' && <span className="text-destructive"> *</span>}
                              </td>
                              <td className="w-48 px-3 py-1.5">
                                {renderColumnSelect(`csv-map-${field}`, label, current, (header) => setBuiltIn(field, header))}
                              </td>
                              <td className="hidden max-w-48 truncate px-3 py-1.5 text-xs text-muted-foreground sm:table-cell">
                                {sampleFor(current) || '—'}
                              </td>
                            </tr>
                          );
                        })}
                        {category.fields.length > 0 && (
                          <tr className="border-b bg-primary/5">
                            <td colSpan={3} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                              {t('data.csv.categoryFields', { category: category.name })}
                            </td>
                          </tr>
                        )}
                        {category.fields.map((field) => {
                          const current = mappingPreview.mapping.customFields[field.key] ?? '';
                          return (
                            <tr key={field.id} className="border-b transition-colors last:border-0 hover:bg-muted/30">
                              <td className="px-3 py-1.5 font-medium">
                                <label htmlFor={`csv-map-custom-${field.key}`}>{field.label}</label>
                                {field.required && <span className="text-destructive"> *</span>}
                              </td>
                              <td className="w-48 px-3 py-1.5">
                                {renderColumnSelect(`csv-map-custom-${field.key}`, field.label, current, (header) => setCustom(field.key, header))}
                              </td>
                              <td className="hidden max-w-48 truncate px-3 py-1.5 text-xs text-muted-foreground sm:table-cell">
                                {sampleFor(current) || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="space-y-3 rounded-md border bg-background p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <h3 className="flex items-center gap-2 text-sm font-medium">
                        <Table2 className="size-4 text-primary" aria-hidden="true" />
                        {t('data.csv.previewTitle')}
                      </h3>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {t('data.csv.readySkipped', {
                          ready: importableCount,
                          skipped: csvData.rows.length - importableCount,
                        })}
                      </p>
                    </div>
                    <Badge variant={issues.length > 0 ? 'outline' : 'secondary'} className="tabular-nums">
                      {t('data.csv.issueCount', { count: issues.length })}
                    </Badge>
                  </div>

                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className={thClass}>{t('data.csv.rowNumber')}</th>
                          <th className={thClass}>{t('data.field.title')}</th>
                          {previewBuiltIns.map((field) => (
                            <th key={field} className={thClass}>{t(`data.field.${field}`)}</th>
                          ))}
                          {mappedCustomFields.slice(0, 4).map((field) => (
                            <th key={field.id} className={thClass}>{field.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mappingPreview.preview.slice(0, PREVIEW_ROWS).map((row) => {
                          const raw = csvData.rows[row.rowIndex] ?? [];
                          return (
                            <tr key={row.rowIndex} className={cn('border-b last:border-0', !row.canImport && 'bg-destructive/5 text-muted-foreground')}>
                              <td className="px-3 py-1.5 tabular-nums">
                                <span className="inline-flex items-center gap-1">
                                  {row.rowIndex + 2}
                                  {!row.canImport && (
                                    <AlertCircle className="size-3 text-destructive" aria-label={t('data.csv.rowSkipped')} />
                                  )}
                                </span>
                              </td>
                              <td className="max-w-48 truncate whitespace-nowrap px-3 py-1.5 font-medium">{row.title || '—'}</td>
                              {previewBuiltIns.map((field) => {
                                const header = mappingPreview.mapping.builtInFields[field];
                                const index = csvData.headers.indexOf(header);
                                return (
                                  <td key={field} className="max-w-40 truncate whitespace-nowrap px-3 py-1.5">{index === -1 ? '—' : raw[index] || '—'}</td>
                                );
                              })}
                              {mappedCustomFields.slice(0, 4).map((field) => (
                                <td key={field.id} className="max-w-40 truncate whitespace-nowrap px-3 py-1.5">{formatPreviewValue(row.values[field.key])}</td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {issues.length > 0 && (
                    <ul className="space-y-1">
                      {issues.slice(0, 4).map((issue) => (
                        <li key={`${issue.rowNumber}-${issue.field}-${issue.message}`} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <AlertCircle
                            className={cn('mt-0.5 size-3.5 shrink-0', issue.severity === 'error' ? 'text-destructive' : 'text-amber-500')}
                            aria-hidden="true"
                          />
                          <span>{t('data.csv.rowIssue', { row: issue.rowNumber, message: issue.message })}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        )}

        <Button
          className="w-full"
          disabled={!csvData || !categoryId || importableCount === 0}
          onClick={handleImport}
        >
          <Upload className="size-4" />
          {importableCount > 0 ? t('data.import.importCount', { count: importableCount }) : t('data.import.import')}
        </Button>
      </CardContent>
    </Card>
  );
}
