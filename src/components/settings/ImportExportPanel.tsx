import { useState, useMemo, useRef, useCallback, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import {
  AlertCircle,
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileUp,
  FolderOpen,
  HardDrive,
  Info,
  Package,
  Printer,
  Tags,
  Upload,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useT } from '@/i18n';
import { canEditContent, canManageCatalog } from '@/lib/permissions';
import { getDesktopLocalSyncApi } from '@/lib/runtime';
import { formatCurrency, formatNumber, generateId } from '@/lib/utils';
import { currencyService } from '@/services/currencyService';
import {
  buildBackupRestorePreview,
  isBackupBundle,
  type BackupBundle,
  type BackupRestoreMode,
} from '@/services/backupRestoreService';
import {
  exportService,
  getDefaultCsvDelimiter,
  type CsvExportDelimiter,
} from '@/services/exportService';
import { useAuthStore } from '@/store/useAuthStore';
import { useCollectionStore } from '@/store/useCollectionStore';
import type { CollectionItem } from '@/types';

import { CsvImportCard } from './data/CsvImportCard';
import { LocalSyncTab } from './data/LocalSyncTab';
import { PanelCardHeader } from './data/PanelCardHeader';
import { RestoreConfirmSummary, RestorePreview } from './data/RestorePreview';
import { useBackupState } from './data/useBackupState';
import { TagManager } from './TagManager';

type ImportExportTab = 'export' | 'import' | 'local-sync';

function buildTimestampedExportName(slug: string): string {
  return `curio-${slug}-${Date.now()}.json`;
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

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
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
  const t = useT();
  const user = useAuthStore((state) => state.user);
  const displayCurrency = useCollectionStore((s) => s.displayCurrency);
  const categories = useCollectionStore((s) => s.categories);
  const items = useCollectionStore((s) => s.items);
  const getItemsByCategory = useCollectionStore((s) => s.getItemsByCategory);
  const getCategoryById = useCollectionStore((s) => s.getCategoryById);
  const logActivity = useCollectionStore((s) => s.logActivity);
  const bulkAddItems = useCollectionStore((s) => s.bulkAddItems);
  const restoreBackupBundle = useCollectionStore((s) => s.restoreBackupBundle);
  const { currentBackupState, downloadFullBackup } = useBackupState();

  const role = user?.role ?? 'viewer';
  const canRestoreBackups = canManageCatalog(role);
  const isAdmin = role === 'admin';
  const canEditTags = canEditContent(role);
  const currentContributorId = user?.uid ?? 'offline';

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [csvDelimiter, setCsvDelimiter] = useState<CsvExportDelimiter>(() => getDefaultCsvDelimiter());
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  const [jsonPreview, setJsonPreview] = useState<{ count: number; byCategory: Record<string, number> } | null>(null);
  const [jsonItems, setJsonItems] = useState<Partial<CollectionItem>[]>([]);
  const [jsonFileName, setJsonFileName] = useState<string>('');
  const [backupBundle, setBackupBundle] = useState<BackupBundle | null>(null);
  const [restoreMode, setRestoreMode] = useState<BackupRestoreMode>('merge');
  const [preRestoreBackupDownloaded, setPreRestoreBackupDownloaded] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const localSyncAvailable = Boolean(getDesktopLocalSyncApi());

  const totalValue = useMemo(() => {
    const totalUSD = items.reduce(
      (sum, item) => sum + currencyService.convertToUSD(
        item.valuationInfo.currentEstimatedValue,
        item.valuationInfo.currentValueCurrency,
      ),
      0,
    );
    return currencyService.convert(totalUSD, 'USD', displayCurrency);
  }, [items, displayCurrency]);

  const selectedCategory = selectedCategoryId ? getCategoryById(selectedCategoryId) : undefined;
  const selectedCategoryItems = selectedCategoryId ? getItemsByCategory(selectedCategoryId) : [];

  const restorePreview = useMemo(
    () => (backupBundle ? buildBackupRestorePreview(backupBundle, currentBackupState, restoreMode) : null),
    [backupBundle, currentBackupState, restoreMode],
  );

  const logExportActivity = useCallback((details: string) => {
    logActivity({
      action: 'export_created',
      entityType: 'system',
      entityId: generateId(),
      entityTitle: 'Collection Export',
      details,
    });
  }, [logActivity]);

  function handleFullCSV() {
    exportService.exportToCSV(items, categories, undefined, { delimiter: csvDelimiter });
    logExportActivity('CSV export of full collection');
    toast.success(t('data.export.csvDone'), {
      description: t('data.export.allItems', { count: items.length }),
    });
  }

  function handleFullJSON() {
    exportService.exportToJSON(items);
    logExportActivity('JSON export of full collection');
    toast.success(t('data.export.jsonDone'), {
      description: t('data.export.allItems', { count: items.length }),
    });
  }

  function handleFullBackup() {
    downloadFullBackup();
    logExportActivity('Full JSON backup bundle');
    toast.success(t('data.export.backupDone'));
  }

  function handlePreRestoreBackup() {
    downloadFullBackup(`curio-pre-restore-${Date.now()}.json`);
    setPreRestoreBackupDownloaded(true);
    toast.success(t('data.restore.backupDownloaded'), {
      description: t('data.restore.replaceUnlocked'),
    });
  }

  function handleCategoryCSV() {
    if (!selectedCategory) return;
    exportService.exportCategoryToCSV(selectedCategoryItems, selectedCategory, undefined, { delimiter: csvDelimiter });
    logExportActivity(`CSV export of ${selectedCategory.name}`);
    toast.success(t('data.export.csvDone'), {
      description: t('data.export.categoryItems', { count: selectedCategoryItems.length, category: selectedCategory.name }),
    });
  }

  function handleCategoryJSON() {
    if (!selectedCategory) return;
    exportService.exportToJSON(selectedCategoryItems, buildTimestampedExportName(selectedCategory.slug));
    logExportActivity(`JSON export of ${selectedCategory.name}`);
    toast.success(t('data.export.jsonDone'), {
      description: t('data.export.categoryItems', { count: selectedCategoryItems.length, category: selectedCategory.name }),
    });
  }

  const handleJsonFile = useCallback((file: File) => {
    setJsonFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed: unknown = JSON.parse(String(event.target?.result ?? ''));
        if (isBackupBundle(parsed)) {
          const preview = buildBackupRestorePreview(parsed, currentBackupState, restoreMode);
          setBackupBundle(parsed);
          setPreRestoreBackupDownloaded(false);
          setJsonItems([]);
          setJsonPreview(null);

          if (preview.errors.length > 0) {
            toast.error(t('data.restore.cannotRestore'), { description: preview.errors[0] });
          } else {
            toast.success(t('data.restore.previewReady'), {
              description: t('data.restore.previewReadyHint', {
                items: preview.incomingCounts.items,
                categories: preview.incomingCounts.categories,
              }),
            });
          }
          return;
        }

        if (!Array.isArray(parsed)) {
          toast.error(t('data.json.invalid'), { description: t('data.json.expectedArray') });
          return;
        }

        setBackupBundle(null);
        setPreRestoreBackupDownloaded(false);

        const validCategoryIds = new Set(categories.map((c) => c.id));
        const valid = (parsed as Record<string, unknown>[]).filter(
          (entry) =>
            entry !== null
            && typeof entry === 'object'
            && typeof entry.title === 'string'
            && entry.title.trim() !== ''
            && typeof entry.categoryId === 'string'
            && validCategoryIds.has(entry.categoryId),
        ) as Partial<CollectionItem>[];

        const byCategory: Record<string, number> = {};
        for (const item of valid) {
          const catName = getCategoryById(item.categoryId as string)?.name ?? t('data.json.unknownCategory');
          byCategory[catName] = (byCategory[catName] ?? 0) + 1;
        }

        setJsonItems(valid);
        setJsonPreview({ count: valid.length, byCategory });

        if (valid.length < parsed.length) {
          toast.warning(t('data.json.skipped', { count: parsed.length - valid.length }), {
            description: t('data.json.skippedHint'),
          });
        }
      } catch {
        toast.error(t('data.json.parseFailed'));
      }
    };
    reader.onerror = () => toast.error(t('data.json.parseFailed'));
    reader.readAsText(file);
  }, [categories, getCategoryById, currentBackupState, restoreMode, t]);

  const handleRestoreBackup = useCallback(async () => {
    if (!backupBundle || !restorePreview?.canRestore) return;
    if (!canRestoreBackups) {
      toast.error(t('data.restore.adminOnly'));
      return;
    }
    if (restoreMode === 'replace' && !preRestoreBackupDownloaded) {
      toast.error(t('data.restore.downloadFirstToast'), {
        description: t('data.restore.downloadFirstHint'),
      });
      return;
    }

    setIsRestoring(true);
    try {
      await restoreBackupBundle(backupBundle, restoreMode);
      toast.success(t(restoreMode === 'replace' ? 'data.restore.restored' : 'data.restore.merged'), {
        description: t(restoreMode === 'replace' ? 'data.restore.restoredHint' : 'data.restore.mergedHint'),
      });
      setBackupBundle(null);
      setJsonFileName('');
      setRestoreConfirmOpen(false);
      setPreRestoreBackupDownloaded(false);
      if (jsonInputRef.current) jsonInputRef.current.value = '';
    } catch (error) {
      toast.error(t('data.restore.failed'), {
        description: errorMessage(error, t('data.restore.failedHint')),
      });
    } finally {
      setIsRestoring(false);
    }
  }, [
    backupBundle,
    restorePreview,
    canRestoreBackups,
    restoreMode,
    preRestoreBackupDownloaded,
    restoreBackupBundle,
    t,
  ]);

  const handleJsonImport = useCallback(() => {
    if (jsonItems.length === 0) return;
    const mapped = jsonItems.map((entry) =>
      buildDefaultItem(
        { ...entry, categoryId: entry.categoryId!, title: entry.title! },
        currentContributorId,
      ),
    );
    const count = bulkAddItems(mapped);
    toast.success(t('data.import.success', { count }), { description: t('data.import.successHint') });
    setJsonPreview(null);
    setJsonItems([]);
    setJsonFileName('');
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  }, [jsonItems, bulkAddItems, currentContributorId, t]);

  const categoryOptions = categories.map((cat) => (
    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
  ));

  const eyebrowClass = 'text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground';

  const toolRows: {
    key: string;
    icon: typeof FileText;
    title: string;
    hint: string;
    action: ReactNode;
  }[] = [
    ...(isAdmin
      ? [
          {
            key: 'report',
            icon: FileText,
            title: t('data.tools.report'),
            hint: t('data.tools.reportHint'),
            action: (
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link to="/admin/print-labels?mode=report&from=settings">{t('data.tools.reportOpen')}</Link>
              </Button>
            ),
          },
          {
            key: 'labels',
            icon: Printer,
            title: t('data.tools.labels'),
            hint: t('data.tools.labelsHint'),
            action: (
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link to="/admin/print-labels?from=settings">{t('data.tools.labelsOpen')}</Link>
              </Button>
            ),
          },
        ]
      : []),
    {
      key: 'tags',
      icon: Tags,
      title: t('data.tools.tags'),
      hint: t('data.tools.tagsHint'),
      action: (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={!canEditTags}
          onClick={() => setTagManagerOpen(true)}
        >
          {t('data.tools.tagsOpen')}
        </Button>
      ),
    },
  ];

  return (
    <div className={className}>
      <Tabs value={activeTab} onValueChange={(nextTab) => onTabChange(nextTab as ImportExportTab)} className="space-y-6">
        <TabsList>
          <TabsTrigger value="export">
            <Download className="mr-2 size-4" />
            {t('data.tab.export')}
          </TabsTrigger>
          <TabsTrigger value="import">
            <Upload className="mr-2 size-4" />
            {t('data.tab.import')}
          </TabsTrigger>
          <TabsTrigger
            value="local-sync"
            disabled={!localSyncAvailable}
            title={localSyncAvailable ? undefined : t('data.tab.localDisabled')}
          >
            <HardDrive className="mr-2 size-4" />
            {t('data.tab.local')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <PanelCardHeader
                icon={Package}
                title={t('data.export.fullTitle')}
                description={t('data.export.fullDescription')}
              />
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="tabular-nums">{formatNumber(items.length)}</Badge>
                    <span className="text-muted-foreground">{t('data.export.itemsLabel')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="tabular-nums">{formatCurrency(totalValue, displayCurrency)}</Badge>
                    <span className="text-muted-foreground">{t('data.export.totalValueLabel')}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="csv-export-delimiter" className={eyebrowClass}>
                    {t('data.export.separator')}
                  </Label>
                  <Select value={csvDelimiter} onValueChange={(next) => setCsvDelimiter(next as CsvExportDelimiter)}>
                    <SelectTrigger id="csv-export-delimiter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=",">{t('data.export.separatorComma')}</SelectItem>
                      <SelectItem value=";">{t('data.export.separatorSemicolon')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('data.export.separatorHint')}</p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button className="flex-1" onClick={handleFullCSV}>
                    <FileSpreadsheet className="size-4" />
                    {t('data.export.asCsv')}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleFullJSON}>
                    <FileJson className="size-4" />
                    {t('data.export.asJson')}
                  </Button>
                </div>
                <Button variant="secondary" className="w-full" onClick={handleFullBackup}>
                  <Download className="size-4" />
                  {t('data.export.backup')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <PanelCardHeader
                icon={FolderOpen}
                title={t('data.export.categoryTitle')}
                description={t('data.export.categoryDescription')}
              />
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="export-category" className={eyebrowClass}>
                    {t('data.export.category')}
                  </Label>
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger id="export-category">
                      <SelectValue placeholder={t('data.selectCategory')} />
                    </SelectTrigger>
                    <SelectContent>{categoryOptions}</SelectContent>
                  </Select>
                </div>

                {selectedCategory && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Badge variant="secondary" className="tabular-nums">{formatNumber(selectedCategoryItems.length)}</Badge>
                    <span className="text-muted-foreground">
                      {t('data.export.itemsInLabel', { count: selectedCategoryItems.length, category: selectedCategory.name })}
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
                    {t('data.export.asCsv')}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={!selectedCategory || selectedCategoryItems.length === 0}
                    onClick={handleCategoryJSON}
                  >
                    <FileJson className="size-4" />
                    {t('data.export.asJson')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <PanelCardHeader
              icon={Wrench}
              title={t('data.tools.title')}
              description={t('data.tools.description')}
            />
            <CardContent>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {toolRows.map((row) => {
                  const Icon = row.icon;
                  return (
                    <li
                      key={row.key}
                      className="flex flex-col justify-between gap-4 rounded-xl border bg-muted/30 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 rounded-lg bg-primary/10 p-2">
                          <Icon className="size-4 text-primary" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold">{row.title}</p>
                          <p className="text-xs leading-5 text-muted-foreground">{row.hint}</p>
                        </div>
                      </div>
                      <div className="flex justify-end">{row.action}</div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <PanelCardHeader
              icon={Download}
              title={t('data.included.title')}
              description={t('data.included.description')}
            />
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {['fields', 'prices', 'values', 'tags', 'custom', 'favorites', 'backup'].map((key) => (
                  <li key={key} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-green-500" aria-hidden="true" />
                    {t(`data.included.${key}`)}
                  </li>
                ))}
              </ul>

              <Separator />

              <p className="text-xs text-muted-foreground">{t('data.included.local')}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <PanelCardHeader
                icon={FileJson}
                title={t('data.json.title')}
                description={t('data.json.description')}
              />
              <CardContent className="space-y-4">
                <input
                  ref={jsonInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  aria-label={t('data.json.chooseFile')}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleJsonFile(file);
                  }}
                />

                <button
                  type="button"
                  className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
                  onClick={() => jsonInputRef.current?.click()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const file = event.dataTransfer.files[0];
                    if (file) handleJsonFile(file);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragEnter={(event) => event.preventDefault()}
                >
                  <FileUp className="size-8 text-muted-foreground" aria-hidden="true" />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{jsonFileName || t('data.json.drop')}</span>
                    <span className="block text-xs text-muted-foreground">{t('data.json.dropHint')}</span>
                  </span>
                </button>

                {jsonPreview && (
                  <section className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium">{t('data.json.preview')}</h3>
                      <Badge variant="secondary" className="tabular-nums">
                        {t('data.json.found', { count: jsonPreview.count })}
                      </Badge>
                    </div>
                    <Separator />
                    <ul className="space-y-1">
                      {Object.entries(jsonPreview.byCategory).map(([cat, count]) => (
                        <li key={cat} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{cat}</span>
                          <Badge variant="outline" className="text-xs tabular-nums">{formatNumber(count)}</Badge>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {restorePreview && (
                  <RestorePreview
                    source="file"
                    preview={restorePreview}
                    mode={restoreMode}
                    onModeChange={(mode) => {
                      setRestoreMode(mode);
                      setPreRestoreBackupDownloaded(false);
                    }}
                    safetyBackupDownloaded={preRestoreBackupDownloaded}
                    onDownloadSafetyBackup={handlePreRestoreBackup}
                    canRestore={canRestoreBackups}
                    isRestoring={isRestoring}
                    onRestore={() => setRestoreConfirmOpen(true)}
                  />
                )}

                {!backupBundle && (
                  <Button
                    className="w-full"
                    disabled={jsonItems.length === 0}
                    onClick={handleJsonImport}
                  >
                    <Upload className="size-4" />
                    {jsonItems.length > 0 ? t('data.import.importCount', { count: jsonItems.length }) : t('data.import.import')}
                  </Button>
                )}
              </CardContent>
            </Card>

            <CsvImportCard contributorId={currentContributorId} />
          </div>

          <Card>
            <PanelCardHeader
              icon={Info}
              title={t('data.guide.title')}
              description={t('data.guide.description')}
            />
            <CardContent className="space-y-5">
              <section className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <FileJson className="size-4 text-primary" aria-hidden="true" />
                  {t('data.guide.json')}
                </h3>
                <ul className="space-y-1.5 pl-6 text-sm text-muted-foreground">
                  {['array', 'backup', 'required', 'optional', 'category'].map((key) => (
                    <li key={key} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-green-500" aria-hidden="true" />
                      {t(`data.guide.json.${key}`)}
                    </li>
                  ))}
                </ul>
              </section>

              <Separator />

              <section className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <FileSpreadsheet className="size-4 text-primary" aria-hidden="true" />
                  {t('data.guide.csv')}
                </h3>
                <ul className="space-y-1.5 pl-6 text-sm text-muted-foreground">
                  {['headers', 'separator', 'title', 'mapping', 'encoding'].map((key) => (
                    <li key={key} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-green-500" aria-hidden="true" />
                      {t(`data.guide.csv.${key}`)}
                    </li>
                  ))}
                </ul>
              </section>

              <Separator />

              <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    {t('data.guide.reviewTitle')}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('data.guide.review')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="local-sync" className="space-y-6">
          <LocalSyncTab
            available={localSyncAvailable}
            canRestoreBackups={canRestoreBackups}
            totalValue={totalValue}
            displayCurrency={displayCurrency}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={restoreConfirmOpen}
        onClose={() => setRestoreConfirmOpen(false)}
        onConfirm={handleRestoreBackup}
        title={t(restoreMode === 'replace' ? 'data.restore.confirmReplaceTitle' : 'data.restore.confirmMergeTitle')}
        description={t(
          restoreMode === 'replace' ? 'data.restore.confirmReplaceBody' : 'data.restore.confirmMergeBody',
          { count: restorePreview?.incomingCounts.items ?? 0 },
        )}
        confirmLabel={isRestoring
          ? t('data.restore.restoring')
          : t(restoreMode === 'replace' ? 'data.restore.replaceAllData' : 'data.restore.file.merge')}
        destructive={restoreMode === 'replace'}
      >
        {restorePreview && (
          <RestoreConfirmSummary
            resultItems={restorePreview.resultCounts.items}
            conflicts={restorePreview.conflicts.length}
            skippedLabel={restorePreview.skipped.length > 0
              ? t('data.restore.skippedRecords', { count: restorePreview.skipped.length })
              : null}
          />
        )}
      </ConfirmDialog>

      <Dialog open={tagManagerOpen} onOpenChange={setTagManagerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="size-5 text-primary" aria-hidden="true" />
              {t('data.tags.title')}
            </DialogTitle>
            <DialogDescription>{t('data.tags.description')}</DialogDescription>
          </DialogHeader>
          <TagManager />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export type { ImportExportTab };
