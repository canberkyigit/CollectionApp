import { useState, useMemo, useRef, useCallback } from 'react';

import {
  Download,
  FileSpreadsheet,
  FileJson,
  FolderOpen,
  Package,
  Check,
  Upload,
  FileUp,
  AlertCircle,
  Table2,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatNumber, generateId } from '@/lib/utils';
import { currencyService } from '@/services/currencyService';
import { parseCSV } from '@/services/csvService';
import { exportService } from '@/services/exportService';
import { useAuthStore } from '@/store/useAuthStore';
import { useCollectionStore } from '@/store/useCollectionStore';
import type { CollectionItem } from '@/types';

type ImportExportTab = 'export' | 'import';

function buildTimestampedExportName(slug: string): string {
  return `${slug}-export-${Date.now()}.json`;
}

function buildDefaultItem(
  overrides: Partial<CollectionItem> & { categoryId: string; title: string },
  defaultContributorId: string,
): Omit<CollectionItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    categoryId: overrides.categoryId,
    title: overrides.title,
    description: overrides.description ?? '',
    customFields: overrides.customFields ?? {},
    notes: overrides.notes ?? '',
    tags: overrides.tags ?? [],
    images: overrides.images ?? [],
    purchaseInfo: overrides.purchaseInfo ?? {
      purchasedAt: new Date().toISOString(),
      purchasePrice: 0,
      purchaseCurrency: 'USD',
      exchangeRateAtPurchase: 1,
    },
    valuationInfo: overrides.valuationInfo ?? {
      currentEstimatedValue: 0,
      currentValueCurrency: 'USD',
      currentExchangeRate: 1,
      valueHistory: [],
    },
    contributorId: overrides.contributorId ?? defaultContributorId,
    condition: overrides.condition ?? 'Good',
    isFavorite: overrides.isFavorite ?? false,
    maintenanceLog: overrides.maintenanceLog ?? [],
    lendingHistory: overrides.lendingHistory ?? [],
  };
}

interface ImportExportPanelProps {
  activeTab: ImportExportTab;
  onTabChange: (nextTab: ImportExportTab) => void;
  className?: string;
}

export function ImportExportPanel({
  activeTab,
  onTabChange,
  className,
}: ImportExportPanelProps) {
  const user = useAuthStore((state) => state.user);
  const displayCurrency = useCollectionStore((s) => s.displayCurrency);
  const { categories, items, getItemsByCategory, getCategoryById, logActivity, bulkAddItems } =
    useCollectionStore();
  const currentContributorId = user?.uid ?? 'offline';
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const [jsonPreview, setJsonPreview] = useState<{ count: number; byCategory: Record<string, number> } | null>(null);
  const [jsonItems, setJsonItems] = useState<Partial<CollectionItem>[]>([]);
  const [jsonFileName, setJsonFileName] = useState<string>('');

  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [csvCategoryId, setCsvCategoryId] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const totalValueUSD = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum +
          currencyService.convertToUSD(
            item.valuationInfo.currentEstimatedValue,
            item.valuationInfo.currentValueCurrency,
          ),
        0,
      ),
    [items],
  );

  const totalValue = useMemo(
    () => currencyService.convert(totalValueUSD, 'USD', displayCurrency),
    [totalValueUSD, displayCurrency],
  );

  const selectedCategory = selectedCategoryId
    ? getCategoryById(selectedCategoryId)
    : undefined;

  const selectedCategoryItems = selectedCategoryId
    ? getItemsByCategory(selectedCategoryId)
    : [];

  function logExportActivity(details: string) {
    logActivity({
      action: 'export_created',
      entityType: 'system',
      entityId: generateId(),
      entityTitle: 'Collection Export',
      details,
    });
  }

  function handleFullCSV() {
    exportService.exportToCSV(items, categories);
    logExportActivity('CSV export of full collection');
    toast.success('CSV export downloaded', {
      description: `Exported ${items.length} items across all categories.`,
    });
  }

  function handleFullJSON() {
    exportService.exportToJSON(items);
    logExportActivity('JSON export of full collection');
    toast.success('JSON export downloaded', {
      description: `Exported ${items.length} items across all categories.`,
    });
  }

  function handleCategoryCSV() {
    if (!selectedCategory) return;
    exportService.exportCategoryToCSV(selectedCategoryItems, selectedCategory);
    logExportActivity(`CSV export of ${selectedCategory.name}`);
    toast.success('CSV export downloaded', {
      description: `Exported ${selectedCategoryItems.length} items from ${selectedCategory.name}.`,
    });
  }

  function handleCategoryJSON() {
    if (!selectedCategory) return;
    exportService.exportToJSON(
      selectedCategoryItems,
      buildTimestampedExportName(selectedCategory.slug),
    );
    logExportActivity(`JSON export of ${selectedCategory.name}`);
    toast.success('JSON export downloaded', {
      description: `Exported ${selectedCategoryItems.length} items from ${selectedCategory.name}.`,
    });
  }

  const handleJsonFile = useCallback(
    (file: File) => {
      setJsonFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (!Array.isArray(parsed)) {
            toast.error('Invalid JSON', { description: 'Expected an array of items.' });
            return;
          }

          const validCategoryIds = new Set(categories.map((c) => c.id));
          const valid = parsed.filter(
            (entry: Record<string, unknown>) =>
              typeof entry.title === 'string' &&
              entry.title.trim() !== '' &&
              typeof entry.categoryId === 'string' &&
              validCategoryIds.has(entry.categoryId as string),
          );

          const byCategory: Record<string, number> = {};
          for (const item of valid) {
            const catName = getCategoryById(item.categoryId as string)?.name ?? 'Unknown';
            byCategory[catName] = (byCategory[catName] ?? 0) + 1;
          }

          setJsonItems(valid);
          setJsonPreview({ count: valid.length, byCategory });

          if (valid.length < parsed.length) {
            toast.warning(`${parsed.length - valid.length} entries skipped`, {
              description: 'Missing required title or invalid categoryId.',
            });
          }
        } catch {
          toast.error('Failed to parse JSON file');
        }
      };
      reader.readAsText(file);
    },
    [categories, getCategoryById],
  );

  const handleJsonImport = useCallback(() => {
    if (jsonItems.length === 0) return;
    const mapped = jsonItems.map((entry) =>
      buildDefaultItem(
        { ...entry, categoryId: entry.categoryId!, title: entry.title! },
        currentContributorId,
      ),
    );
    const count = bulkAddItems(mapped);
    toast.success(`Imported ${count} items`, { description: 'Items have been added to your collection.' });
    setJsonPreview(null);
    setJsonItems([]);
    setJsonFileName('');
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  }, [jsonItems, bulkAddItems, currentContributorId]);

  const handleCsvFile = useCallback((file: File) => {
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.headers.length === 0) {
        toast.error('Empty or invalid CSV file');
        return;
      }
      setCsvData(parsed);
    };
    reader.readAsText(file);
  }, []);

  const handleCsvImport = useCallback(() => {
    if (!csvData || !csvCategoryId) return;

    const { headers, rows } = csvData;
    const titleIdx = headers.findIndex((h) => /title|name/i.test(h));
    const descIdx = headers.findIndex((h) => /desc/i.test(h));
    const condIdx = headers.findIndex((h) => /cond/i.test(h));
    const priceIdx = headers.findIndex((h) => /price|cost|value/i.test(h));

    if (titleIdx === -1) {
      toast.error('No title column found', { description: 'CSV must have a column matching "title" or "name".' });
      return;
    }

    const mapped = rows
      .filter((row) => row[titleIdx]?.trim())
      .map((row) => {
        const price = priceIdx !== -1 ? parseFloat(row[priceIdx]) : 0;
        return buildDefaultItem({
          categoryId: csvCategoryId,
          title: row[titleIdx].trim(),
          description: descIdx !== -1 ? row[descIdx]?.trim() ?? '' : '',
          condition: condIdx !== -1 ? row[condIdx]?.trim() || 'Good' : 'Good',
          purchaseInfo: {
            purchasedAt: new Date().toISOString(),
            purchasePrice: isNaN(price) ? 0 : price,
            purchaseCurrency: 'USD',
            exchangeRateAtPurchase: 1,
          },
        }, currentContributorId);
      });

    const count = bulkAddItems(mapped);
    toast.success(`Imported ${count} items`, { description: 'Items have been added to your collection.' });
    setCsvData(null);
    setCsvCategoryId('');
    setCsvFileName('');
    if (csvInputRef.current) csvInputRef.current.value = '';
  }, [csvData, csvCategoryId, bulkAddItems, currentContributorId]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, type: 'json' | 'csv') => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (type === 'json') handleJsonFile(file);
      else handleCsvFile(file);
    },
    [handleJsonFile, handleCsvFile],
  );

  const preventDefaults = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div className={className}>
      <Tabs value={activeTab} onValueChange={(nextTab) => onTabChange(nextTab as ImportExportTab)} className="space-y-6">
        <TabsList>
          <TabsTrigger value="export">
            <Download className="mr-2 size-4" />
            Export
          </TabsTrigger>
          <TabsTrigger value="import">
            <Upload className="mr-2 size-4" />
            Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-3">
                    <Package className="size-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle>Full Collection Export</CardTitle>
                    <CardDescription>
                      Export all items across all categories
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary">{formatNumber(items.length)}</Badge>
                    <span className="text-muted-foreground">items</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary">{formatCurrency(totalValue)}</Badge>
                    <span className="text-muted-foreground">total value</span>
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button className="flex-1" onClick={handleFullCSV}>
                    <FileSpreadsheet className="size-4" />
                    Export as CSV
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleFullJSON}>
                    <FileJson className="size-4" />
                    Export as JSON
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-3">
                    <FolderOpen className="size-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle>Export by Category</CardTitle>
                    <CardDescription>
                      Export items from a specific category
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedCategory && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Badge variant="secondary">
                      {formatNumber(selectedCategoryItems.length)}
                    </Badge>
                    <span className="text-muted-foreground">
                      items in {selectedCategory.name}
                    </span>
                  </div>
                )}

                <Separator />

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="flex-1"
                    disabled={!selectedCategory || selectedCategoryItems.length === 0}
                    onClick={handleCategoryCSV}
                  >
                    <FileSpreadsheet className="size-4" />
                    Export as CSV
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={!selectedCategory || selectedCategoryItems.length === 0}
                    onClick={handleCategoryJSON}
                  >
                    <FileJson className="size-4" />
                    Export as JSON
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-3">
                  <Download className="size-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <CardTitle>What&apos;s Included</CardTitle>
                  <CardDescription>
                    Information about your exported data
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {[
                  'Item titles, descriptions, and conditions',
                  'Purchase prices, dates, and currencies',
                  'Current valuations and gain/loss percentages',
                  'Tags, notes, and location information',
                  'Category-specific custom fields',
                  'Favorite status and timestamps',
                ].map((text) => (
                  <li key={text} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-green-500" />
                    {text}
                  </li>
                ))}
              </ul>

              <Separator />

              <p className="text-xs text-muted-foreground">
                Your data is exported directly to your device. No data is sent to
                external servers during the export process.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-3">
                    <FileJson className="size-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle>Import JSON</CardTitle>
                    <CardDescription>
                      Import a JSON array of collection items
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={jsonInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleJsonFile(file);
                  }}
                />

                <div
                  className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-primary/50 hover:bg-muted/50"
                  onClick={() => jsonInputRef.current?.click()}
                  onDrop={(e) => handleDrop(e, 'json')}
                  onDragOver={preventDefaults}
                  onDragEnter={preventDefaults}
                >
                  <FileUp className="size-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">
                      {jsonFileName || 'Drop a .json file here or click to browse'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Accepts JSON arrays of collection items
                    </p>
                  </div>
                </div>

                {jsonPreview && (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Preview</span>
                      <Badge variant="secondary">{jsonPreview.count} items found</Badge>
                    </div>
                    <Separator />
                    <div className="space-y-1">
                      {Object.entries(jsonPreview.byCategory).map(([cat, count]) => (
                        <div key={cat} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{cat}</span>
                          <Badge variant="outline" className="text-xs">
                            {count}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  disabled={jsonItems.length === 0}
                  onClick={handleJsonImport}
                >
                  <Upload className="size-4" />
                  Import {jsonItems.length > 0 ? `${jsonItems.length} Items` : ''}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-3">
                    <FileSpreadsheet className="size-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle>Import CSV</CardTitle>
                    <CardDescription>
                      Import items from a CSV spreadsheet
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCsvFile(file);
                  }}
                />

                <div
                  className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-primary/50 hover:bg-muted/50"
                  onClick={() => csvInputRef.current?.click()}
                  onDrop={(e) => handleDrop(e, 'csv')}
                  onDragOver={preventDefaults}
                  onDragEnter={preventDefaults}
                >
                  <FileUp className="size-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">
                      {csvFileName || 'Drop a .csv file here or click to browse'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      First row should contain column headers
                    </p>
                  </div>
                </div>

                {csvData && (
                  <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Preview</span>
                      <Badge variant="secondary">{csvData.rows.length} rows</Badge>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Detected Columns</Label>
                      <div className="space-y-1">
                        {csvData.headers.map((header, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded-md bg-background px-3 py-1.5 text-sm">
                            <span className="font-medium">{header}</span>
                            <span className="max-w-[50%] truncate text-xs text-muted-foreground">
                              {csvData.rows[0]?.[idx] ?? '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Table2 className="size-3.5 text-muted-foreground" />
                        <Label className="text-xs text-muted-foreground">
                          First {Math.min(5, csvData.rows.length)} rows
                        </Label>
                      </div>
                      <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              {csvData.headers.map((h, i) => (
                                <th key={i} className="whitespace-nowrap px-3 py-2 text-left font-medium">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {csvData.rows.slice(0, 5).map((row, ri) => (
                              <tr key={ri} className="border-b last:border-0">
                                {row.map((cell, ci) => (
                                  <td key={ci} className="max-w-[200px] truncate whitespace-nowrap px-3 py-1.5">
                                    {cell || '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Assign to Category</Label>
                      <Select value={csvCategoryId} onValueChange={setCsvCategoryId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  disabled={!csvData || !csvCategoryId}
                  onClick={handleCsvImport}
                >
                  <Upload className="size-4" />
                  Import {csvData ? `${csvData.rows.length} Items` : ''}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-3">
                  <Info className="size-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <CardTitle>Import Guidelines</CardTitle>
                  <CardDescription>
                    Tips for preparing your import files
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <FileJson className="size-4 text-primary" />
                  JSON Format
                </h4>
                <ul className="space-y-1.5 pl-6 text-sm text-muted-foreground">
                  {[
                    'File must contain a JSON array of objects',
                    'Each object must have "title" (string) and "categoryId" (string)',
                    'Optional fields: description, condition, tags, notes, purchaseInfo, valuationInfo',
                    'categoryId must match an existing category in your collection',
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-green-500" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <FileSpreadsheet className="size-4 text-primary" />
                  CSV Format
                </h4>
                <ul className="space-y-1.5 pl-6 text-sm text-muted-foreground">
                  {[
                    'First row must contain column headers',
                    'Use commas as column separators',
                    'Include a "title" or "name" column (required)',
                    'Optional columns: description, condition, price/cost/value',
                    'Wrap values containing commas in double quotes',
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-green-500" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              <Separator />

              <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-500" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Duplicate Detection
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Duplicate detection is not yet implemented. Importing the same file
                    multiple times will create duplicate entries. Please verify your data
                    before importing.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export type { ImportExportTab };
