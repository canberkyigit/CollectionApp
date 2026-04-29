import { useState, useMemo, useRef, useCallback, useEffect } from 'react';

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
  ShieldCheck,
  GitMerge,
  RotateCcw,
  HardDrive,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared';
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
import {
  getDesktopLocalSyncApi,
  type LocalSyncStatus,
} from '@/lib/runtime';
import { currencyService } from '@/services/currencyService';
import {
  buildBackupRestorePreview,
  isBackupBundle,
  type BackupBundle,
  type BackupRestoreMode,
  type RestorableBackupState,
} from '@/services/backupRestoreService';
import { parseCSV } from '@/services/csvService';
import { exportService } from '@/services/exportService';
import {
  buildAutoCsvMapping,
  buildCsvImportPreview,
  buildItemFromCsvPreviewRow,
} from '@/services/importPreviewService';
import { useAuthStore } from '@/store/useAuthStore';
import { useCollectionStore } from '@/store/useCollectionStore';
import { canManageCatalog } from '@/lib/permissions';
import type { CollectionItem } from '@/types';

type ImportExportTab = 'export' | 'import' | 'local-sync';

function buildTimestampedExportName(slug: string): string {
  return `${slug}-export-${Date.now()}.json`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function formatLocalSyncDate(value: string | null | undefined): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
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
  const {
    categories,
    items,
    libraries,
    wishlist,
    activityLog,
    contributors,
    theme,
    sidebarOpen,
    menuCollectionStyle,
    dashboardWidgets,
    readNotificationIds,
    notifications,
    getItemsByCategory,
    getCategoryById,
    logActivity,
    bulkAddItems,
    restoreBackupBundle,
  } =
    useCollectionStore();
  const canRestoreBackups = canManageCatalog(user?.role ?? 'viewer');
  const currentContributorId = user?.uid ?? 'offline';
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const [jsonPreview, setJsonPreview] = useState<{ count: number; byCategory: Record<string, number> } | null>(null);
  const [jsonItems, setJsonItems] = useState<Partial<CollectionItem>[]>([]);
  const [jsonFileName, setJsonFileName] = useState<string>('');
  const [backupBundle, setBackupBundle] = useState<BackupBundle | null>(null);
  const [restoreMode, setRestoreMode] = useState<BackupRestoreMode>('merge');
  const [preRestoreBackupDownloaded, setPreRestoreBackupDownloaded] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [csvCategoryId, setCsvCategoryId] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');

  const [localSyncStatus, setLocalSyncStatus] = useState<LocalSyncStatus | null>(null);
  const [isLocalSyncing, setIsLocalSyncing] = useState(false);
  const [isLocalStatusLoading, setIsLocalStatusLoading] = useState(false);
  const [localRestoreBundle, setLocalRestoreBundle] = useState<BackupBundle | null>(null);
  const [localRestoreMode, setLocalRestoreMode] = useState<BackupRestoreMode>('merge');
  const [localRestoreConfirmOpen, setLocalRestoreConfirmOpen] = useState(false);
  const [localPreRestoreBackupDownloaded, setLocalPreRestoreBackupDownloaded] = useState(false);
  const [isLocalRestoring, setIsLocalRestoring] = useState(false);

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const localSyncAvailable = Boolean(getDesktopLocalSyncApi());

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
  const selectedCsvCategory = csvCategoryId
    ? getCategoryById(csvCategoryId)
    : undefined;

  const selectedCategoryItems = selectedCategoryId
    ? getItemsByCategory(selectedCategoryId)
    : [];

  const currentBackupState = useMemo<RestorableBackupState>(() => ({
    categories,
    items,
    libraries,
    wishlist,
    activityLog,
    contributors,
    settings: {
      displayCurrency,
      theme,
      sidebarOpen,
      menuCollectionStyle,
      dashboardWidgets,
      readNotificationIds,
      notifications,
    },
  }), [
    categories,
    items,
    libraries,
    wishlist,
    activityLog,
    contributors,
    displayCurrency,
    theme,
    sidebarOpen,
    menuCollectionStyle,
    dashboardWidgets,
    readNotificationIds,
    notifications,
  ]);

  const restorePreview = useMemo(
    () => backupBundle ? buildBackupRestorePreview(backupBundle, currentBackupState, restoreMode) : null,
    [backupBundle, currentBackupState, restoreMode],
  );

  const localRestorePreview = useMemo(
    () => localRestoreBundle
      ? buildBackupRestorePreview(localRestoreBundle, currentBackupState, localRestoreMode)
      : null,
    [localRestoreBundle, currentBackupState, localRestoreMode],
  );

  const buildFullBackupBundle = useCallback(() => ({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    categories,
    items,
    wishlist,
    activityLog,
    contributors,
    libraries,
    settings: {
      displayCurrency,
      theme,
      sidebarOpen,
      menuCollectionStyle,
      dashboardWidgets,
      readNotificationIds,
      notifications,
    },
  }), [
    categories,
    items,
    wishlist,
    activityLog,
    contributors,
    libraries,
    displayCurrency,
    theme,
    sidebarOpen,
    menuCollectionStyle,
    dashboardWidgets,
    readNotificationIds,
    notifications,
  ]);

  const refreshLocalSyncStatus = useCallback(async () => {
    const api = getDesktopLocalSyncApi();
    if (!api) {
      setLocalSyncStatus(null);
      return null;
    }

    setIsLocalStatusLoading(true);
    try {
      const status = await api.getStatus();
      setLocalSyncStatus(status);
      return status;
    } catch (error) {
      toast.error('Failed to read local sync status', {
        description: error instanceof Error ? error.message : 'Desktop local sync is unavailable.',
      });
      return null;
    } finally {
      setIsLocalStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!localSyncAvailable) return;
    void refreshLocalSyncStatus();
  }, [localSyncAvailable, refreshLocalSyncStatus]);

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

  const downloadFullBackup = useCallback((filename?: string) => {
    const bundle = buildFullBackupBundle();
    exportService.exportBackupBundle({
      categories: bundle.categories,
      items: bundle.items,
      wishlist: bundle.wishlist,
      activityLog: bundle.activityLog,
      contributors: bundle.contributors,
      libraries: bundle.libraries,
      settings: bundle.settings!,
    }, filename);
  }, [buildFullBackupBundle]);

  function handleFullBackup() {
    downloadFullBackup();
    logExportActivity('Full JSON backup bundle');
    toast.success('Backup bundle downloaded');
  }

  function handlePreRestoreBackup() {
    downloadFullBackup(`collectvault-pre-restore-${Date.now()}.json`);
    setPreRestoreBackupDownloaded(true);
    toast.success('Current backup downloaded', {
      description: 'Replace restore is now unlocked for this preview.',
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
          if (isBackupBundle(parsed)) {
            const preview = buildBackupRestorePreview(parsed, currentBackupState, restoreMode);
            setBackupBundle(parsed);
            setPreRestoreBackupDownloaded(false);
            setJsonItems([]);
            setJsonPreview(null);

            if (preview.errors.length > 0) {
              toast.error('Backup cannot be restored', {
                description: preview.errors[0],
              });
            } else {
              toast.success('Backup preview ready', {
                description: `${preview.incomingCounts.items} items, ${preview.incomingCounts.categories} categories detected.`,
              });
            }
            return;
          }

          if (!Array.isArray(parsed)) {
            toast.error('Invalid JSON', { description: 'Expected an array of items.' });
            return;
          }

          setBackupBundle(null);
          setPreRestoreBackupDownloaded(false);

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
    [categories, getCategoryById, currentBackupState, restoreMode],
  );

  const handleRestoreBackup = useCallback(async () => {
    if (!backupBundle || !restorePreview?.canRestore) return;
    if (!canRestoreBackups) {
      toast.error('Only admins can restore backups');
      return;
    }
    if (restoreMode === 'replace' && !preRestoreBackupDownloaded) {
      toast.error('Download a current backup first', {
        description: 'Replace restore is destructive, so a fresh safety backup is required.',
      });
      return;
    }

    setIsRestoring(true);
    try {
      await restoreBackupBundle(backupBundle, restoreMode);
      toast.success(restoreMode === 'replace' ? 'Backup restored' : 'Backup merged', {
        description: restoreMode === 'replace'
          ? 'Your local and Firestore collection data now match the backup.'
          : 'Backup records were merged into your current collection.',
      });
      setBackupBundle(null);
      setJsonFileName('');
      setRestoreConfirmOpen(false);
      setPreRestoreBackupDownloaded(false);
      if (jsonInputRef.current) jsonInputRef.current.value = '';
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

  const csvMappingPreview = useMemo(() => {
    if (!csvData || !selectedCsvCategory) return null;
    const mapping = buildAutoCsvMapping(csvData.headers, selectedCsvCategory);
    const preview = buildCsvImportPreview(csvData.headers, csvData.rows, selectedCsvCategory, mapping);
    return { mapping, preview };
  }, [csvData, selectedCsvCategory]);
  const csvImportableCount = useMemo(
    () => csvMappingPreview?.preview.filter((row) => row.canImport).length ?? 0,
    [csvMappingPreview],
  );
  const csvIssueCount = useMemo(
    () => csvMappingPreview?.preview.reduce((sum, row) => sum + row.issues.length, 0) ?? 0,
    [csvMappingPreview],
  );

  const handleCsvImport = useCallback(() => {
    if (!csvData || !selectedCsvCategory || !csvMappingPreview) return;

    if (!csvMappingPreview.mapping.builtInFields.title) {
      toast.error('No title column found', { description: 'CSV must have a column matching "title" or "name".' });
      return;
    }

    const importableRows = csvMappingPreview.preview.filter((row) => row.canImport);
    const mapped = importableRows.map((row) => buildItemFromCsvPreviewRow(
      row,
      csvData.headers,
      csvData.rows[row.rowIndex],
      csvMappingPreview.mapping,
      currentContributorId,
    ));

    const count = bulkAddItems(mapped);
    const skipped = csvMappingPreview.preview.length - count;
    toast.success(`Imported ${count} items`, {
      description: skipped > 0
        ? `${skipped} row${skipped > 1 ? 's were' : ' was'} skipped due to validation issues.`
        : 'Items have been added to your collection.',
    });
    setCsvData(null);
    setCsvCategoryId('');
    setCsvFileName('');
    if (csvInputRef.current) csvInputRef.current.value = '';
  }, [csvData, selectedCsvCategory, csvMappingPreview, bulkAddItems, currentContributorId]);

  const handleLocalSync = useCallback(async () => {
    const api = getDesktopLocalSyncApi();
    if (!api) {
      toast.error('Desktop app required', {
        description: 'Local sync can only write to disk from the desktop app.',
      });
      return;
    }

    setIsLocalSyncing(true);
    try {
      const status = await api.syncSnapshot(buildFullBackupBundle());
      setLocalSyncStatus(status);
      setLocalRestoreBundle(null);
      logExportActivity('Desktop local sync snapshot');
      toast.success('Local copy updated', {
        description: `${status.counts?.items ?? items.length} items saved to ${status.path}`,
      });
      if (status.failedAssets.length > 0) {
        toast.warning(`${status.failedAssets.length} asset${status.failedAssets.length === 1 ? '' : 's'} could not be copied`, {
          description: 'The data snapshot was saved, but a few remote files still need internet access.',
        });
      }
    } catch (error) {
      toast.error('Local sync failed', {
        description: error instanceof Error ? error.message : 'Unable to write the local desktop copy.',
      });
    } finally {
      setIsLocalSyncing(false);
    }
  }, [buildFullBackupBundle, items.length, logExportActivity]);

  const handleOpenLocalSyncFolder = useCallback(async () => {
    const api = getDesktopLocalSyncApi();
    if (!api) return;

    try {
      await api.openFolder();
    } catch (error) {
      toast.error('Could not open local folder', {
        description: error instanceof Error ? error.message : 'The folder could not be opened.',
      });
    }
  }, []);

  const handleLoadLocalSnapshot = useCallback(async () => {
    const api = getDesktopLocalSyncApi();
    if (!api) {
      toast.error('Desktop app required');
      return;
    }

    try {
      const snapshot = await api.restoreSnapshot();
      if (!isBackupBundle(snapshot)) {
        toast.error('Local copy is invalid', {
          description: 'The saved desktop copy is not a valid ESC backup file.',
        });
        return;
      }

      const preview = buildBackupRestorePreview(snapshot, currentBackupState, localRestoreMode);
      setLocalRestoreBundle(snapshot);
      setLocalPreRestoreBackupDownloaded(false);

      if (preview.errors.length > 0) {
        toast.error('Local copy cannot be restored', {
          description: preview.errors[0],
        });
      } else {
        toast.success('Local copy loaded', {
          description: `${preview.incomingCounts.items} items and ${preview.incomingCounts.categories} categories are ready to restore.`,
        });
      }
    } catch (error) {
      toast.error('No local copy found', {
        description: error instanceof Error ? error.message : 'Run Sync With Local first.',
      });
    }
  }, [currentBackupState, localRestoreMode]);

  const handleLocalPreRestoreBackup = useCallback(() => {
    downloadFullBackup(`collectvault-pre-local-restore-${Date.now()}.json`);
    setLocalPreRestoreBackupDownloaded(true);
    toast.success('Current backup downloaded', {
      description: 'Replace restore is now unlocked for the local copy.',
    });
  }, [downloadFullBackup]);

  const handleLocalRestore = useCallback(async () => {
    if (!localRestoreBundle || !localRestorePreview?.canRestore) return;
    if (!canRestoreBackups) {
      toast.error('Only admins can restore backups');
      return;
    }
    if (localRestoreMode === 'replace' && !localPreRestoreBackupDownloaded) {
      toast.error('Download a current backup first', {
        description: 'Replace restore is destructive, so a fresh safety backup is required.',
      });
      return;
    }

    setIsLocalRestoring(true);
    try {
      await restoreBackupBundle(localRestoreBundle, localRestoreMode);
      toast.success(localRestoreMode === 'replace' ? 'Local copy restored' : 'Local copy merged', {
        description: localRestoreMode === 'replace'
          ? 'Your collection now matches the desktop local copy.'
          : 'Desktop local copy records were merged into your current collection.',
      });
      setLocalRestoreConfirmOpen(false);
      setLocalPreRestoreBackupDownloaded(false);
      setLocalRestoreBundle(null);
      await refreshLocalSyncStatus();
    } finally {
      setIsLocalRestoring(false);
    }
  }, [
    localRestoreBundle,
    localRestorePreview,
    canRestoreBackups,
    localRestoreMode,
    localPreRestoreBackupDownloaded,
    restoreBackupBundle,
    refreshLocalSyncStatus,
  ]);

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
          <TabsTrigger
            value="local-sync"
            disabled={!localSyncAvailable}
            title={localSyncAvailable ? undefined : 'Available in the desktop app only'}
          >
            <HardDrive className="mr-2 size-4" />
            Sync With Local
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
                <Button variant="secondary" className="w-full" onClick={handleFullBackup}>
                  <Download className="size-4" />
                  Download Full Backup Bundle
                </Button>
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
                  'Full backup bundles include categories, libraries, wishlist, activity, contributors, and settings',
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

                {restorePreview && (
                  <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="size-4 text-primary" />
                          <span className="text-sm font-medium">Full Backup Restore Preview</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {restorePreview.exportedAt
                            ? `Exported ${new Date(restorePreview.exportedAt).toLocaleString()}`
                            : 'Backup export date not available'}
                        </p>
                      </div>
                      <Badge variant={restorePreview.errors.length > 0 ? 'destructive' : 'secondary'}>
                        Schema v{restorePreview.schemaVersion ?? 'unknown'}
                      </Badge>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRestoreMode('merge');
                          setPreRestoreBackupDownloaded(false);
                        }}
                        className={`rounded-lg border p-3 text-left transition-colors ${restoreMode === 'merge' ? 'border-primary bg-primary/10' : 'hover:bg-background'}`}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <GitMerge className="size-4" />
                          Merge
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Adds backup data and overwrites same-ID conflicts with backup versions.
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRestoreMode('replace');
                          setPreRestoreBackupDownloaded(false);
                        }}
                        className={`rounded-lg border p-3 text-left transition-colors ${restoreMode === 'replace' ? 'border-destructive bg-destructive/10' : 'hover:bg-background'}`}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <RotateCcw className="size-4" />
                          Replace All
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Replaces local data and Firestore data with this backup.
                        </span>
                      </button>
                    </div>

                    <div className="grid gap-2 text-xs sm:grid-cols-3">
                      <div className="rounded-md bg-background px-3 py-2">
                        <span className="text-muted-foreground">Current</span>
                        <p className="mt-1 font-medium">
                          {restorePreview.currentCounts.items} items, {restorePreview.currentCounts.categories} categories
                        </p>
                      </div>
                      <div className="rounded-md bg-background px-3 py-2">
                        <span className="text-muted-foreground">Backup</span>
                        <p className="mt-1 font-medium">
                          {restorePreview.incomingCounts.items} items, {restorePreview.incomingCounts.categories} categories
                        </p>
                      </div>
                      <div className="rounded-md bg-background px-3 py-2">
                        <span className="text-muted-foreground">After Restore</span>
                        <p className="mt-1 font-medium">
                          {restorePreview.resultCounts.items} items, {restorePreview.resultCounts.categories} categories
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 text-xs sm:grid-cols-3">
                      <div className="rounded-md bg-background px-3 py-2">
                        <span className="text-muted-foreground">Wishlist</span>
                        <p className="mt-1 font-medium">
                          {restorePreview.resultCounts.wishlist} after restore
                        </p>
                      </div>
                      <div className="rounded-md bg-background px-3 py-2">
                        <span className="text-muted-foreground">Activity</span>
                        <p className="mt-1 font-medium">
                          {restorePreview.resultCounts.activityLog} entries
                        </p>
                      </div>
                      <div className="rounded-md bg-background px-3 py-2">
                        <span className="text-muted-foreground">Conflicts</span>
                        <p className="mt-1 font-medium">
                          {restorePreview.conflicts.length} same-ID conflict{restorePreview.conflicts.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>

                    {(restorePreview.errors.length > 0 || restorePreview.warnings.length > 0) && (
                      <div className="space-y-1">
                        {[...restorePreview.errors, ...restorePreview.warnings].slice(0, 4).map((message) => (
                          <div key={message} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                            <span>{message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {restorePreview.conflicts.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium">Conflict Summary</p>
                        {restorePreview.conflicts.slice(0, 5).map((conflict) => (
                          <div key={`${conflict.collection}-${conflict.id}`} className="flex items-center justify-between gap-3 rounded-md bg-background px-3 py-1.5 text-xs">
                            <span className="truncate">{conflict.label}</span>
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {conflict.collection}
                            </Badge>
                          </div>
                        ))}
                        {restorePreview.conflicts.length > 5 && (
                          <p className="text-xs text-muted-foreground">
                            +{restorePreview.conflicts.length - 5} more conflicts
                          </p>
                        )}
                      </div>
                    )}

                    {restorePreview.skipped.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium">Skipped Report</p>
                        {restorePreview.skipped.slice(0, 5).map((issue) => (
                          <div key={`${issue.collection}-${issue.index}-${issue.id ?? issue.title}`} className="rounded-md bg-background px-3 py-1.5 text-xs">
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate">{issue.title ?? issue.id ?? `Row ${issue.index}`}</span>
                              <Badge variant="outline" className="shrink-0 text-[10px]">
                                {issue.collection}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-muted-foreground">{issue.reason}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {restoreMode === 'replace' && (
                      <div className="space-y-2 rounded-md border border-destructive/25 bg-destructive/5 p-3">
                        <p className="text-xs text-muted-foreground">
                          Replace mode is destructive. Download a fresh backup of the current state before continuing.
                        </p>
                        <Button variant="outline" className="w-full" onClick={handlePreRestoreBackup}>
                          <Download className="size-4" />
                          {preRestoreBackupDownloaded ? 'Current Backup Downloaded' : 'Download Current Backup First'}
                        </Button>
                      </div>
                    )}

                    <Button
                      className="w-full"
                      variant={restoreMode === 'replace' ? 'destructive' : 'default'}
                      disabled={
                        !restorePreview.canRestore
                        || !canRestoreBackups
                        || isRestoring
                        || (restoreMode === 'replace' && !preRestoreBackupDownloaded)
                      }
                      onClick={() => setRestoreConfirmOpen(true)}
                    >
                      <Upload className="size-4" />
                      {isRestoring
                        ? 'Restoring...'
                        : restoreMode === 'replace'
                          ? 'Restore and Replace All'
                          : 'Merge Backup'}
                    </Button>
                  </div>
                )}

                <Button
                  className="w-full"
                  disabled={jsonItems.length === 0 || backupBundle !== null}
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

                    {csvMappingPreview && (
                      <>
                        <Separator />

                        <div className="space-y-3 rounded-md border bg-background p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">Mapping Review</p>
                              <p className="text-xs text-muted-foreground">
                                {csvImportableCount} ready, {csvData.rows.length - csvImportableCount} skipped
                              </p>
                            </div>
                            <Badge variant={csvIssueCount > 0 ? 'outline' : 'secondary'}>
                              {csvIssueCount} issue{csvIssueCount === 1 ? '' : 's'}
                            </Badge>
                          </div>

                          <div className="grid gap-2 text-xs sm:grid-cols-2">
                            <div className="rounded-md bg-muted/40 px-3 py-2">
                              <span className="text-muted-foreground">Title column</span>
                              <p className="mt-1 font-medium">
                                {csvMappingPreview.mapping.builtInFields.title ?? 'Not detected'}
                              </p>
                            </div>
                            <div className="rounded-md bg-muted/40 px-3 py-2">
                              <span className="text-muted-foreground">Custom fields</span>
                              <p className="mt-1 font-medium">
                                {Object.keys(csvMappingPreview.mapping.customFields).length} mapped
                              </p>
                            </div>
                          </div>

                          {csvIssueCount > 0 && (
                            <div className="space-y-1">
                              {csvMappingPreview.preview
                                .flatMap((row) =>
                                  row.issues.map((issue) => ({
                                    ...issue,
                                    rowNumber: row.rowIndex + 2,
                                  })),
                                )
                                .slice(0, 4)
                                .map((issue) => (
                                  <div key={`${issue.rowNumber}-${issue.field}-${issue.message}`} className="flex items-start gap-2 text-xs text-muted-foreground">
                                    <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                                    <span>
                                      Row {issue.rowNumber}: {issue.message}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <Button
                  className="w-full"
                  disabled={!csvData || !csvCategoryId || csvImportableCount === 0}
                  onClick={handleCsvImport}
                >
                  <Upload className="size-4" />
                  Import {csvImportableCount > 0 ? `${csvImportableCount} Items` : ''}
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
                    'Item import files must contain a JSON array of objects',
                    'Full backup files open a restore preview with merge and replace options',
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
                    Import Review
                  </p>
                  <p className="text-xs text-muted-foreground">
                    CSV imports now validate rows before saving. Use the duplicates screen
                    after large imports to merge ISBN or title matches.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="local-sync" className="space-y-6">
          {!localSyncAvailable ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-muted p-3">
                    <Lock className="size-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle>Desktop App Required</CardTitle>
                    <CardDescription>
                      Local disk sync is disabled in the web app because browsers cannot write silently to your Documents folder.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Open ESC Desktop to save an offline copy with collection data, notes, photos, wishlist records, activity history, contributors, and settings.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-primary/10 p-3">
                        <HardDrive className="size-6 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <CardTitle>Sync With Local</CardTitle>
                        <CardDescription>
                          Save a complete desktop copy to your Mac for offline recovery.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Current App Data</p>
                        <p className="mt-1 text-lg font-semibold">{formatNumber(items.length)}</p>
                        <p className="text-xs text-muted-foreground">items</p>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Categories</p>
                        <p className="mt-1 text-lg font-semibold">{formatNumber(categories.length)}</p>
                        <p className="text-xs text-muted-foreground">schemas</p>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Estimated Value</p>
                        <p className="mt-1 text-lg font-semibold">{formatCurrency(totalValue)}</p>
                        <p className="text-xs text-muted-foreground">{displayCurrency}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>
                        ESC Desktop keeps this local copy updated automatically after collection changes. Use Sync With Local for an immediate refresh.
                      </p>
                      <p>
                        The desktop copy stores a full backup bundle plus local asset files under your Documents folder.
                      </p>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {[
                          'Collections, libraries, and custom fields',
                          'Items, notes, tags, lending, and maintenance',
                          'Wishlist and activity history',
                          'Photos and documents when they can be copied',
                        ].map((text) => (
                          <li key={text} className="flex items-start gap-2">
                            <Check className="mt-0.5 size-4 shrink-0 text-green-500" />
                            <span>{text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button className="flex-1" disabled={isLocalSyncing} onClick={handleLocalSync}>
                        <RefreshCw className={`size-4 ${isLocalSyncing ? 'animate-spin' : ''}`} />
                        {isLocalSyncing ? 'Syncing...' : 'Sync With Local'}
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={handleOpenLocalSyncFolder}>
                        <FolderOpen className="size-4" />
                        Open Local Folder
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="size-5 text-primary" />
                      Local Copy Status
                    </CardTitle>
                    <CardDescription>
                      The latest desktop snapshot stored on this Mac.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge variant={localSyncStatus?.exists ? 'secondary' : 'outline'}>
                          {isLocalStatusLoading ? 'Checking...' : localSyncStatus?.exists ? 'Available' : 'Not synced'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">Auto-sync</span>
                        <Badge variant="secondary">Enabled on desktop</Badge>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">Last synced</span>
                        <span className="text-right text-sm font-medium">
                          {formatLocalSyncDate(localSyncStatus?.syncedAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">Local size</span>
                        <span className="text-sm font-medium">{formatBytes(localSyncStatus?.sizeBytes ?? 0)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">Copied assets</span>
                        <span className="text-sm font-medium">{formatNumber(localSyncStatus?.assetCount ?? 0)}</span>
                      </div>
                    </div>

                    {localSyncStatus?.counts && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(localSyncStatus.counts).map(([label, count]) => (
                          <div key={label} className="rounded-md bg-background px-3 py-2">
                            <span className="capitalize text-muted-foreground">{label}</span>
                            <p className="mt-1 font-medium">{formatNumber(count)}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {(localSyncStatus?.failedAssets.length ?? 0) > 0 && (
                      <div className="space-y-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <AlertCircle className="size-4 text-amber-500" />
                          {localSyncStatus?.failedAssets.length} asset issue{localSyncStatus?.failedAssets.length === 1 ? '' : 's'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Some remote files could not be copied. Their original URLs stayed in the snapshot.
                        </p>
                      </div>
                    )}

                    <Button variant="outline" className="w-full" onClick={() => void refreshLocalSyncStatus()}>
                      <RefreshCw className="size-4" />
                      Refresh Status
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-3">
                      <RotateCcw className="size-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle>Restore From Local Copy</CardTitle>
                      <CardDescription>
                        Load the saved desktop snapshot and restore it into the current collection.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={!localSyncStatus?.exists}
                      onClick={handleLoadLocalSnapshot}
                    >
                      <Upload className="size-4" />
                      Load Local Copy
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={handleOpenLocalSyncFolder}>
                      <FolderOpen className="size-4" />
                      Open Folder
                    </Button>
                  </div>

                  {localRestorePreview && (
                    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Local Restore Preview</p>
                          <p className="text-xs text-muted-foreground">
                            {localRestorePreview.exportedAt
                              ? `Snapshot exported ${new Date(localRestorePreview.exportedAt).toLocaleString()}`
                              : 'Snapshot export date not available'}
                          </p>
                        </div>
                        <Badge variant={localRestorePreview.errors.length > 0 ? 'destructive' : 'secondary'}>
                          Schema v{localRestorePreview.schemaVersion ?? 'unknown'}
                        </Badge>
                      </div>

                      <div className="grid gap-2 text-xs sm:grid-cols-3">
                        <div className="rounded-md bg-background px-3 py-2">
                          <span className="text-muted-foreground">Current</span>
                          <p className="mt-1 font-medium">
                            {localRestorePreview.currentCounts.items} items
                          </p>
                        </div>
                        <div className="rounded-md bg-background px-3 py-2">
                          <span className="text-muted-foreground">Local Copy</span>
                          <p className="mt-1 font-medium">
                            {localRestorePreview.incomingCounts.items} items
                          </p>
                        </div>
                        <div className="rounded-md bg-background px-3 py-2">
                          <span className="text-muted-foreground">Conflicts</span>
                          <p className="mt-1 font-medium">
                            {localRestorePreview.conflicts.length}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => {
                            setLocalRestoreMode('merge');
                            setLocalPreRestoreBackupDownloaded(false);
                          }}
                          className={`rounded-lg border p-3 text-left transition-colors ${localRestoreMode === 'merge' ? 'border-primary bg-primary/10' : 'hover:bg-background'}`}
                        >
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <GitMerge className="size-4" />
                            Merge Local Copy
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Adds local records and overwrites same-ID conflicts with local versions.
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLocalRestoreMode('replace');
                            setLocalPreRestoreBackupDownloaded(false);
                          }}
                          className={`rounded-lg border p-3 text-left transition-colors ${localRestoreMode === 'replace' ? 'border-destructive bg-destructive/10' : 'hover:bg-background'}`}
                        >
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <RotateCcw className="size-4" />
                            Replace With Local
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Replaces the current collection and cloud data with the local snapshot.
                          </span>
                        </button>
                      </div>

                      {(localRestorePreview.errors.length > 0 || localRestorePreview.warnings.length > 0) && (
                        <div className="space-y-1">
                          {[...localRestorePreview.errors, ...localRestorePreview.warnings].slice(0, 4).map((message) => (
                            <div key={message} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                              <span>{message}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {localRestoreMode === 'replace' && (
                        <div className="space-y-2 rounded-md border border-destructive/25 bg-destructive/5 p-3">
                          <p className="text-xs text-muted-foreground">
                            Replace mode is destructive. Download a fresh backup of the current state before continuing.
                          </p>
                          <Button variant="outline" className="w-full" onClick={handleLocalPreRestoreBackup}>
                            <Download className="size-4" />
                            {localPreRestoreBackupDownloaded ? 'Current Backup Downloaded' : 'Download Current Backup First'}
                          </Button>
                        </div>
                      )}

                      <Button
                        className="w-full"
                        variant={localRestoreMode === 'replace' ? 'destructive' : 'default'}
                        disabled={
                          !localRestorePreview.canRestore
                          || !canRestoreBackups
                          || isLocalRestoring
                          || (localRestoreMode === 'replace' && !localPreRestoreBackupDownloaded)
                        }
                        onClick={() => setLocalRestoreConfirmOpen(true)}
                      >
                        <Upload className="size-4" />
                        {isLocalRestoring
                          ? 'Restoring...'
                          : localRestoreMode === 'replace'
                            ? 'Restore and Replace All'
                            : 'Merge Local Copy'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={restoreConfirmOpen}
        onClose={() => setRestoreConfirmOpen(false)}
        onConfirm={handleRestoreBackup}
        title={restoreMode === 'replace' ? 'Replace All Data From Backup?' : 'Merge Backup Into Collection?'}
        description={
          restoreMode === 'replace'
            ? `This will replace your current local and Firestore collection data with ${restorePreview?.incomingCounts.items ?? 0} backup items.`
            : `This will merge ${restorePreview?.incomingCounts.items ?? 0} backup items into your current collection. Same-ID conflicts will use the backup version.`
        }
        confirmLabel={isRestoring ? 'Restoring...' : restoreMode === 'replace' ? 'Replace All Data' : 'Merge Backup'}
        destructive={restoreMode === 'replace'}
      >
        {restorePreview && (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-muted/40 px-3 py-2">
                <span className="text-muted-foreground">After restore</span>
                <p className="mt-1 font-medium">{restorePreview.resultCounts.items} items</p>
              </div>
              <div className="rounded-md bg-muted/40 px-3 py-2">
                <span className="text-muted-foreground">Conflicts</span>
                <p className="mt-1 font-medium">{restorePreview.conflicts.length}</p>
              </div>
            </div>
            {restorePreview.skipped.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {restorePreview.skipped.length} invalid backup record{restorePreview.skipped.length === 1 ? '' : 's'} will be skipped.
              </p>
            )}
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={localRestoreConfirmOpen}
        onClose={() => setLocalRestoreConfirmOpen(false)}
        onConfirm={handleLocalRestore}
        title={localRestoreMode === 'replace' ? 'Replace All Data From Local Copy?' : 'Merge Local Copy Into Collection?'}
        description={
          localRestoreMode === 'replace'
            ? `This will replace your current local and Firestore collection data with ${localRestorePreview?.incomingCounts.items ?? 0} locally synced items.`
            : `This will merge ${localRestorePreview?.incomingCounts.items ?? 0} locally synced items into your current collection. Same-ID conflicts will use the local copy.`
        }
        confirmLabel={isLocalRestoring ? 'Restoring...' : localRestoreMode === 'replace' ? 'Replace All Data' : 'Merge Local Copy'}
        destructive={localRestoreMode === 'replace'}
      >
        {localRestorePreview && (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-muted/40 px-3 py-2">
                <span className="text-muted-foreground">After restore</span>
                <p className="mt-1 font-medium">{localRestorePreview.resultCounts.items} items</p>
              </div>
              <div className="rounded-md bg-muted/40 px-3 py-2">
                <span className="text-muted-foreground">Conflicts</span>
                <p className="mt-1 font-medium">{localRestorePreview.conflicts.length}</p>
              </div>
            </div>
            {localRestorePreview.skipped.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {localRestorePreview.skipped.length} invalid local record{localRestorePreview.skipped.length === 1 ? '' : 's'} will be skipped.
              </p>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

export type { ImportExportTab };
