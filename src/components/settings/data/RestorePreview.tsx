import { AlertCircle, Download, GitMerge, Lock, RotateCcw, ShieldCheck, Upload } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';
import { cn, formatNumber } from '@/lib/utils';
import type {
  BackupRestoreMode,
  BackupRestorePreview,
} from '@/services/backupRestoreService';

export type RestoreSource = 'file' | 'local';

interface RestorePreviewProps {
  source: RestoreSource;
  preview: BackupRestorePreview;
  mode: BackupRestoreMode;
  onModeChange: (mode: BackupRestoreMode) => void;
  safetyBackupDownloaded: boolean;
  onDownloadSafetyBackup: () => void;
  canRestore: boolean;
  isRestoring: boolean;
  onRestore: () => void;
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Two-stat summary shown inside the restore confirmation dialogs. */
export function RestoreConfirmSummary({
  resultItems,
  conflicts,
  skippedLabel,
}: {
  resultItems: number;
  conflicts: number;
  skippedLabel: string | null;
}) {
  const t = useT();
  return (
    <div className="space-y-2 text-sm">
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-muted/40 px-3 py-2">
          <dt className="text-muted-foreground">{t('data.restore.after')}</dt>
          <dd className="mt-1 font-medium tabular-nums">{t('data.restore.itemCount', { count: resultItems })}</dd>
        </div>
        <div className="rounded-md bg-muted/40 px-3 py-2">
          <dt className="text-muted-foreground">{t('data.restore.conflicts')}</dt>
          <dd className="mt-1 font-medium tabular-nums">{formatNumber(conflicts)}</dd>
        </div>
      </dl>
      {skippedLabel && <p className="text-xs text-muted-foreground">{skippedLabel}</p>}
    </div>
  );
}

export function RestorePreview({
  source,
  preview,
  mode,
  onModeChange,
  safetyBackupDownloaded,
  onDownloadSafetyBackup,
  canRestore,
  isRestoring,
  onRestore,
}: RestorePreviewProps) {
  const t = useT();
  const isFile = source === 'file';
  const collectionLabel = (name: string) => t(`data.restore.collection.${name}`);
  const summarize = (counts: { items: number; categories: number }) => t('data.restore.countsSummary', {
    items: formatNumber(counts.items),
    categories: formatNumber(counts.categories),
  });
  const messages = [...preview.errors, ...preview.warnings].slice(0, 4);

  const modeOptions: { value: BackupRestoreMode; icon: typeof GitMerge; title: string; hint: string }[] = [
    {
      value: 'merge',
      icon: GitMerge,
      title: t(isFile ? 'data.restore.file.modeMerge' : 'data.restore.local.modeMerge'),
      hint: t(isFile ? 'data.restore.file.modeMergeHint' : 'data.restore.local.modeMergeHint'),
    },
    {
      value: 'replace',
      icon: RotateCcw,
      title: t(isFile ? 'data.restore.file.modeReplace' : 'data.restore.local.modeReplace'),
      hint: t(isFile ? 'data.restore.file.modeReplaceHint' : 'data.restore.local.modeReplaceHint'),
    },
  ];

  return (
    <section className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            {t(isFile ? 'data.restore.file.title' : 'data.restore.local.title')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {preview.exportedAt
              ? t('data.restore.exportedAt', { date: formatDateTime(preview.exportedAt) })
              : t('data.restore.noDate')}
          </p>
        </div>
        <Badge variant={preview.errors.length > 0 ? 'destructive' : 'secondary'}>
          {t('data.restore.schema', { version: preview.schemaVersion ?? t('data.restore.schemaUnknown') })}
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={t('data.restore.modeLabel')}>
        {modeOptions.map((option) => {
          const Icon = option.icon;
          const active = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onModeChange(option.value)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                !active && 'hover:bg-background',
                active && option.value === 'merge' && 'border-primary bg-primary/10',
                active && option.value === 'replace' && 'border-destructive bg-destructive/10',
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Icon className="size-4" aria-hidden="true" />
                {option.title}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{option.hint}</span>
            </button>
          );
        })}
      </div>

      <dl className="grid gap-2 text-xs sm:grid-cols-3">
        <Stat label={t('data.restore.current')} value={summarize(preview.currentCounts)} />
        <Stat
          label={t(isFile ? 'data.restore.file.incoming' : 'data.restore.local.incoming')}
          value={summarize(preview.incomingCounts)}
        />
        <Stat label={t('data.restore.after')} value={summarize(preview.resultCounts)} />
        <Stat
          label={t('data.restore.collection.wishlist')}
          value={t('data.restore.wishlistAfter', { count: preview.resultCounts.wishlist })}
        />
        <Stat
          label={t('data.restore.collection.activityLog')}
          value={t('data.restore.activityEntries', { count: preview.resultCounts.activityLog })}
        />
        <Stat
          label={t('data.restore.conflicts')}
          value={t('data.restore.conflictCount', { count: preview.conflicts.length })}
        />
      </dl>

      {messages.length > 0 && (
        <ul className="space-y-1">
          {messages.map((message) => (
            <li key={message} className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
              <span>{message}</span>
            </li>
          ))}
        </ul>
      )}

      {preview.conflicts.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">{t('data.restore.conflictSummary')}</p>
          <ul className="space-y-1">
            {preview.conflicts.slice(0, 5).map((conflict) => (
              <li
                key={`${conflict.collection}-${conflict.id}`}
                className="flex items-center justify-between gap-3 rounded-md bg-background px-3 py-1.5 text-xs"
              >
                <span className="truncate">{conflict.label}</span>
                <Badge variant="outline" className="shrink-0 text-[10px]">{collectionLabel(conflict.collection)}</Badge>
              </li>
            ))}
          </ul>
          {preview.conflicts.length > 5 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('data.restore.moreConflicts', { count: preview.conflicts.length - 5 })}
            </p>
          )}
        </div>
      )}

      {preview.skipped.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">{t('data.restore.skippedReport')}</p>
          <ul className="space-y-1">
            {preview.skipped.slice(0, 5).map((issue) => (
              <li
                key={`${issue.collection}-${issue.index}-${issue.id ?? issue.title}`}
                className="rounded-md bg-background px-3 py-1.5 text-xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    {issue.title ?? issue.id ?? t('data.restore.row', { index: issue.index ?? 0 })}
                  </span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{collectionLabel(issue.collection)}</Badge>
                </div>
                <p className="mt-0.5 text-muted-foreground">{issue.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode === 'replace' && (
        <div className="space-y-2 rounded-md border border-destructive/25 bg-destructive/5 p-3">
          <p className="text-xs text-muted-foreground">{t('data.restore.replaceWarning')}</p>
          <Button variant="outline" className="w-full" onClick={onDownloadSafetyBackup}>
            <Download className="size-4" />
            {safetyBackupDownloaded ? t('data.restore.backupDownloaded') : t('data.restore.downloadFirst')}
          </Button>
        </div>
      )}

      {!canRestore && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {t('data.restore.adminOnly')}
        </p>
      )}

      <Button
        className="w-full"
        variant={mode === 'replace' ? 'destructive' : 'default'}
        disabled={
          !preview.canRestore
          || !canRestore
          || isRestoring
          || (mode === 'replace' && !safetyBackupDownloaded)
        }
        onClick={onRestore}
      >
        <Upload className="size-4" />
        {isRestoring
          ? t('data.restore.restoring')
          : mode === 'replace'
            ? t('data.restore.restoreReplace')
            : t(isFile ? 'data.restore.file.merge' : 'data.restore.local.merge')}
      </Button>
    </section>
  );
}
