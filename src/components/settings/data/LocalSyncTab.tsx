import { useCallback, useEffect, useMemo, useState } from 'react';

import { AlertCircle, Check, FolderOpen, HardDrive, Lock, RefreshCw, RotateCcw, ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useT } from '@/i18n';
import { BRAND_NAME } from '@/lib/brand';
import { getDesktopLocalSyncApi, type LocalSyncStatus } from '@/lib/runtime';
import { formatCurrency, formatNumber, generateId } from '@/lib/utils';
import {
  buildBackupRestorePreview,
  isBackupBundle,
  type BackupBundle,
  type BackupRestoreMode,
} from '@/services/backupRestoreService';
import { useCollectionStore } from '@/store/useCollectionStore';

import { PanelCardHeader } from './PanelCardHeader';
import { RestoreConfirmSummary, RestorePreview } from './RestorePreview';
import { useBackupState } from './useBackupState';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${formatNumber(Number(kb.toFixed(1)))} KB`;
  return `${formatNumber(Number((kb / 1024).toFixed(2)))} MB`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

interface LocalSyncTabProps {
  available: boolean;
  canRestoreBackups: boolean;
  totalValue: number;
  displayCurrency: string;
}

export function LocalSyncTab({ available, canRestoreBackups, totalValue, displayCurrency }: LocalSyncTabProps) {
  const t = useT();
  const items = useCollectionStore((s) => s.items);
  const categories = useCollectionStore((s) => s.categories);
  const logActivity = useCollectionStore((s) => s.logActivity);
  const restoreBackupBundle = useCollectionStore((s) => s.restoreBackupBundle);
  const { currentBackupState, buildFullBackupBundle, downloadFullBackup } = useBackupState();

  const [status, setStatus] = useState<LocalSyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [restoreBundle, setRestoreBundle] = useState<BackupBundle | null>(null);
  const [restoreMode, setRestoreMode] = useState<BackupRestoreMode>('merge');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [safetyBackupDownloaded, setSafetyBackupDownloaded] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const restorePreview = useMemo(
    () => (restoreBundle ? buildBackupRestorePreview(restoreBundle, currentBackupState, restoreMode) : null),
    [restoreBundle, currentBackupState, restoreMode],
  );

  const refreshStatus = useCallback(async () => {
    const api = getDesktopLocalSyncApi();
    if (!api) {
      setStatus(null);
      return null;
    }
    setIsStatusLoading(true);
    try {
      const next = await api.getStatus();
      setStatus(next);
      return next;
    } catch (error) {
      toast.error(t('data.local.statusFailed'), {
        description: errorMessage(error, t('data.local.unavailable')),
      });
      return null;
    } finally {
      setIsStatusLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!available) return;
    void refreshStatus();
  }, [available, refreshStatus]);

  const handleSync = useCallback(async () => {
    const api = getDesktopLocalSyncApi();
    if (!api) {
      toast.error(t('data.local.desktopRequired'), { description: t('data.local.desktopRequiredHint') });
      return;
    }
    setIsSyncing(true);
    try {
      const next = await api.syncSnapshot(buildFullBackupBundle());
      setStatus(next);
      setRestoreBundle(null);
      logActivity({
        action: 'export_created',
        entityType: 'system',
        entityId: generateId(),
        entityTitle: 'Collection Export',
        details: 'Desktop local sync snapshot',
      });
      toast.success(t('data.local.synced'), {
        description: t('data.local.syncedHint', { count: next.counts?.items ?? items.length, path: next.path }),
      });
      if (next.failedAssets.length > 0) {
        toast.warning(t('data.local.assetsFailed', { count: next.failedAssets.length }), {
          description: t('data.local.assetsFailedHint'),
        });
      }
    } catch (error) {
      toast.error(t('data.local.syncFailed'), {
        description: errorMessage(error, t('data.local.syncFailedHint')),
      });
    } finally {
      setIsSyncing(false);
    }
  }, [buildFullBackupBundle, items.length, logActivity, t]);

  const handleOpenFolder = useCallback(async () => {
    const api = getDesktopLocalSyncApi();
    if (!api) return;
    try {
      await api.openFolder();
    } catch (error) {
      toast.error(t('data.local.openFailed'), {
        description: errorMessage(error, t('data.local.openFailedHint')),
      });
    }
  }, [t]);

  const handleLoadSnapshot = useCallback(async () => {
    const api = getDesktopLocalSyncApi();
    if (!api) {
      toast.error(t('data.local.desktopRequired'));
      return;
    }
    try {
      const snapshot = await api.restoreSnapshot();
      if (!isBackupBundle(snapshot)) {
        toast.error(t('data.local.invalid'), { description: t('data.local.invalidHint', { brand: BRAND_NAME }) });
        return;
      }
      const preview = buildBackupRestorePreview(snapshot, currentBackupState, restoreMode);
      setRestoreBundle(snapshot);
      setSafetyBackupDownloaded(false);
      if (preview.errors.length > 0) {
        toast.error(t('data.local.cannotRestore'), { description: preview.errors[0] });
      } else {
        toast.success(t('data.local.loaded'), {
          description: t('data.local.loadedHint', {
            items: preview.incomingCounts.items,
            categories: preview.incomingCounts.categories,
          }),
        });
      }
    } catch (error) {
      toast.error(t('data.local.notFound'), {
        description: errorMessage(error, t('data.local.notFoundHint')),
      });
    }
  }, [currentBackupState, restoreMode, t]);

  const handleSafetyBackup = useCallback(() => {
    downloadFullBackup(`curio-pre-local-restore-${Date.now()}.json`);
    setSafetyBackupDownloaded(true);
    toast.success(t('data.restore.backupDownloaded'), { description: t('data.local.replaceUnlocked') });
  }, [downloadFullBackup, t]);

  const handleRestore = useCallback(async () => {
    if (!restoreBundle || !restorePreview?.canRestore) return;
    if (!canRestoreBackups) {
      toast.error(t('data.restore.adminOnly'));
      return;
    }
    if (restoreMode === 'replace' && !safetyBackupDownloaded) {
      toast.error(t('data.restore.downloadFirstToast'), { description: t('data.restore.downloadFirstHint') });
      return;
    }
    setIsRestoring(true);
    try {
      await restoreBackupBundle(restoreBundle, restoreMode);
      toast.success(t(restoreMode === 'replace' ? 'data.local.restored' : 'data.local.merged'), {
        description: t(restoreMode === 'replace' ? 'data.local.restoredHint' : 'data.local.mergedHint'),
      });
      setConfirmOpen(false);
      setSafetyBackupDownloaded(false);
      setRestoreBundle(null);
      await refreshStatus();
    } catch (error) {
      toast.error(t('data.restore.failed'), { description: errorMessage(error, t('data.restore.failedHint')) });
    } finally {
      setIsRestoring(false);
    }
  }, [
    restoreBundle,
    restorePreview,
    canRestoreBackups,
    restoreMode,
    safetyBackupDownloaded,
    restoreBackupBundle,
    refreshStatus,
    t,
  ]);

  if (!available) {
    return (
      <Card>
        <PanelCardHeader
          icon={Lock}
          muted
          title={t('data.local.desktopRequired')}
          description={t('data.local.webDisabled')}
        />
        <CardContent className="text-sm text-muted-foreground">
          {t('data.local.openDesktop', { brand: BRAND_NAME })}
        </CardContent>
      </Card>
    );
  }

  const statusLabel = isStatusLoading
    ? t('data.local.checking')
    : status?.exists ? t('data.local.available') : t('data.local.notSynced');
  const statusRows: { label: string; value: string }[] = [
    {
      label: t('data.local.lastSynced'),
      value: status?.syncedAt ? new Date(status.syncedAt).toLocaleString() : t('data.local.never'),
    },
    { label: t('data.local.size'), value: formatBytes(status?.sizeBytes ?? 0) },
    { label: t('data.local.assets'), value: formatNumber(status?.assetCount ?? 0) },
  ];
  const overviewStats: { label: string; value: string; unit: string }[] = [
    { label: t('data.local.currentAppData'), value: formatNumber(items.length), unit: t('data.local.itemsUnit') },
    { label: t('data.local.categories'), value: formatNumber(categories.length), unit: t('data.local.categoriesUnit') },
    { label: t('data.local.value'), value: formatCurrency(totalValue, displayCurrency), unit: displayCurrency },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Card>
          <PanelCardHeader
            icon={HardDrive}
            title={t('data.local.title')}
            description={t('data.local.description')}
          />
          <CardContent className="space-y-5">
            <dl className="grid gap-3 sm:grid-cols-3">
              {overviewStats.map((stat) => (
                <div key={stat.label} className="rounded-lg border bg-muted/30 p-3">
                  <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums">{stat.value}</dd>
                  <dd className="text-xs text-muted-foreground">{stat.unit}</dd>
                </div>
              ))}
            </dl>

            <Separator />

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{t('data.local.autoHint', { brand: BRAND_NAME })}</p>
              <p>{t('data.local.storageHint')}</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {['collections', 'items', 'wishlist', 'assets'].map((key) => (
                  <li key={key} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-green-500" aria-hidden="true" />
                    <span>{t(`data.local.include.${key}`)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" disabled={isSyncing} onClick={handleSync}>
                <RefreshCw className={isSyncing ? 'size-4 animate-spin' : 'size-4'} />
                {isSyncing ? t('data.local.syncing') : t('data.local.syncNow')}
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleOpenFolder}>
                <FolderOpen className="size-4" />
                {t('data.local.openFolder')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
              {t('data.local.statusTitle')}
            </CardTitle>
            <CardDescription>{t('data.local.statusDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="space-y-2 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-muted-foreground">{t('data.local.status')}</dt>
                <dd>
                  <Badge variant={status?.exists ? 'secondary' : 'outline'}>{statusLabel}</Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-muted-foreground">{t('data.local.autoSync')}</dt>
                <dd>
                  <Badge variant="secondary">{t('data.local.autoSyncOn')}</Badge>
                </dd>
              </div>
              {statusRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <dt className="text-sm text-muted-foreground">{row.label}</dt>
                  <dd className="text-right text-sm font-medium tabular-nums">{row.value}</dd>
                </div>
              ))}
            </dl>

            {status?.counts && (
              <dl className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(status.counts).map(([key, count]) => (
                  <div key={key} className="rounded-md bg-background px-3 py-2">
                    <dt className="text-muted-foreground">{t(`data.restore.collection.${key}`)}</dt>
                    <dd className="mt-1 font-medium tabular-nums">{formatNumber(count)}</dd>
                  </div>
                ))}
              </dl>
            )}

            {(status?.failedAssets.length ?? 0) > 0 && (
              <div className="space-y-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <AlertCircle className="size-4 text-amber-500" aria-hidden="true" />
                  {t('data.local.assetIssues', { count: status?.failedAssets.length ?? 0 })}
                </p>
                <p className="text-xs text-muted-foreground">{t('data.local.assetIssuesHint')}</p>
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={() => void refreshStatus()}>
              <RefreshCw className="size-4" />
              {t('data.local.refresh')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <PanelCardHeader
          icon={RotateCcw}
          title={t('data.local.restoreTitle')}
          description={t('data.local.restoreDescription')}
        />
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1" disabled={!status?.exists} onClick={handleLoadSnapshot}>
              <Upload className="size-4" />
              {t('data.local.load')}
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleOpenFolder}>
              <FolderOpen className="size-4" />
              {t('data.local.openFolderShort')}
            </Button>
          </div>

          {restorePreview && (
            <RestorePreview
              source="local"
              preview={restorePreview}
              mode={restoreMode}
              onModeChange={(mode) => {
                setRestoreMode(mode);
                setSafetyBackupDownloaded(false);
              }}
              safetyBackupDownloaded={safetyBackupDownloaded}
              onDownloadSafetyBackup={handleSafetyBackup}
              canRestore={canRestoreBackups}
              isRestoring={isRestoring}
              onRestore={() => setConfirmOpen(true)}
            />
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleRestore}
        title={t(restoreMode === 'replace' ? 'data.local.confirmReplaceTitle' : 'data.local.confirmMergeTitle')}
        description={t(
          restoreMode === 'replace' ? 'data.local.confirmReplaceBody' : 'data.local.confirmMergeBody',
          { count: restorePreview?.incomingCounts.items ?? 0 },
        )}
        confirmLabel={isRestoring
          ? t('data.restore.restoring')
          : t(restoreMode === 'replace' ? 'data.restore.replaceAllData' : 'data.restore.local.merge')}
        destructive={restoreMode === 'replace'}
      >
        {restorePreview && (
          <RestoreConfirmSummary
            resultItems={restorePreview.resultCounts.items}
            conflicts={restorePreview.conflicts.length}
            skippedLabel={restorePreview.skipped.length > 0
              ? t('data.local.skippedRecords', { count: restorePreview.skipped.length })
              : null}
          />
        )}
      </ConfirmDialog>
    </div>
  );
}
