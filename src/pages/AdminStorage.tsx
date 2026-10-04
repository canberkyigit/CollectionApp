import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Database,
  FolderOpen,
  HardDrive,
  Layers,
  Package,
  Trash2,
} from 'lucide-react';

import { PageHeader, StatCard, ConfirmDialog } from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAdminBreadcrumbs } from '@/lib/adminNavigation';
import { getCategoryIcon } from '@/lib/icons';
import { cn, formatNumber } from '@/lib/utils';
import { getLocale, useT } from '@/i18n';
import { useCollectionStore } from '@/store/useCollectionStore';

function estimateSize(data: unknown): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return 0;
  }
}

const LOCAL_STORAGE_LIMIT = 5 * 1024 * 1024; // 5 MB
const SETTINGS_DATA_PATH = '/settings?section=data';

function formatBytes(bytes: number): string {
  const fmt = (value: number, digits: number) =>
    value.toLocaleString(getLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (bytes < 1024) return `${fmt(bytes, 0)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${fmt(kb, 1)} KB`;
  return `${fmt(kb / 1024, 2)} MB`;
}

function formatPercent(value: number): string {
  return `${value.toLocaleString(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

const STORAGE_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-rose-500',
];

const headCell = 'px-4 py-3 font-medium text-muted-foreground';

export default function AdminStorage() {
  const t = useT();
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const { items, categories, wishlist, activityLog, clearActivityLog } = useCollectionStore();

  const [confirmClearLog, setConfirmClearLog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const sizeData = useMemo(() => {
    const itemsSize = estimateSize(items);
    const categoriesSize = estimateSize(categories);
    const wishlistSize = estimateSize(wishlist);
    const activitySize = estimateSize(activityLog);

    const imageData = items
      .flatMap((i) => i.images ?? [])
      .filter((img) => typeof img === 'string' && img.startsWith('data:'));
    const imagesSize = estimateSize(imageData);

    const totalSize = itemsSize + categoriesSize + wishlistSize + activitySize + imagesSize;

    const segments = [
      { key: 'items', size: itemsSize, color: STORAGE_COLORS[0] },
      { key: 'categories', size: categoriesSize, color: STORAGE_COLORS[1] },
      { key: 'wishlist', size: wishlistSize, color: STORAGE_COLORS[2] },
      { key: 'activity', size: activitySize, color: STORAGE_COLORS[3] },
      { key: 'images', size: imagesSize, color: STORAGE_COLORS[4] },
    ];

    return { totalSize, segments };
  }, [items, categories, wishlist, activityLog]);

  const categoryBreakdown = useMemo(() => {
    const totalSize = sizeData.totalSize || 1;
    return categories
      .map((cat) => {
        const catItems = items.filter((i) => i.categoryId === cat.id);
        const size = estimateSize(catItems);
        return {
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
          count: catItems.length,
          size,
          percentage: (size / totalSize) * 100,
        };
      })
      .sort((a, b) => b.size - a.size);
  }, [categories, items, sizeData.totalSize]);

  const health = useMemo(() => {
    const usedBytes = sizeData.totalSize;
    const percentage = Math.min((usedBytes / LOCAL_STORAGE_LIMIT) * 100, 100);
    const level = percentage < 50 ? 'healthy' : percentage < 80 ? 'moderate' : 'critical';
    return { usedBytes, percentage, level } as const;
  }, [sizeData.totalSize]);

  const healthTone = {
    healthy: { bar: 'bg-green-500', badge: 'bg-green-500/10 text-green-600 dark:text-green-500' },
    moderate: { bar: 'bg-yellow-500', badge: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500' },
    critical: { bar: 'bg-red-500', badge: 'bg-red-500/10 text-red-500' },
  }[health.level];

  const handleClearLog = async () => {
    setIsClearing(true);
    try {
      await Promise.resolve(clearActivityLog());
      toast.success(t('admin.storage.logCleared'));
      setConfirmClearLog(false);
    } catch {
      toast.error(t('admin.storage.logClearFailed'));
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title={t('admin.storage.title')}
          description={t('admin.storage.description')}
          breadcrumbs={getAdminBreadcrumbs(search ? `?${search}` : '', [{ label: t('admin.storage.title') }])}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title={t('admin.storage.totalItems')}
            value={formatNumber(items.length)}
            icon={Package}
            subtitle={t('admin.storage.totalItemsHint')}
          />
          <StatCard
            title={t('admin.storage.totalCategories')}
            value={formatNumber(categories.length)}
            icon={Layers}
            subtitle={t('admin.storage.totalCategoriesHint')}
          />
          <StatCard
            title={t('admin.storage.estimatedSize')}
            value={formatBytes(sizeData.totalSize)}
            icon={Database}
            subtitle={t('admin.storage.estimatedSizeHint')}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="size-5 text-primary" aria-hidden="true" />
              {t('admin.storage.breakdownTitle')}
            </CardTitle>
            <CardDescription>{t('admin.storage.breakdownDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
              {sizeData.segments.map((seg) => {
                const pct = sizeData.totalSize > 0 ? (seg.size / sizeData.totalSize) * 100 : 0;
                if (pct < 0.5) return null;
                return (
                  <div key={seg.key} className={cn('h-full transition-all', seg.color)} style={{ width: `${pct}%` }} />
                );
              })}
            </div>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sizeData.segments.map((seg) => {
                const pct = sizeData.totalSize > 0 ? (seg.size / sizeData.totalSize) * 100 : 0;
                return (
                  <li key={seg.key} className="flex items-center gap-3">
                    <span className={cn('size-3 shrink-0 rounded-full', seg.color)} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{t(`admin.storage.segment.${seg.key}`)}</span>
                        <Badge variant="secondary" className="shrink-0 text-xs tabular-nums">{formatPercent(pct)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">{formatBytes(seg.size)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="size-5 text-primary" aria-hidden="true" />
              {t('admin.storage.categoryTitle')}
            </CardTitle>
            <CardDescription>{t('admin.storage.categoryDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className={`${headCell} text-left`}>{t('admin.col.category')}</th>
                    <th className={`${headCell} text-center`}>{t('admin.col.items')}</th>
                    <th className={`${headCell} text-right`}>{t('admin.col.size')}</th>
                    <th className={`${headCell} text-right`}>{t('admin.col.share')}</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryBreakdown.map((cat) => {
                    const Icon = getCategoryIcon(cat.icon);
                    return (
                      <tr key={cat.id} className="border-b transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-primary/10 p-1.5" aria-hidden="true">
                              <Icon className="size-4 text-primary" />
                            </div>
                            <span className="font-medium">{cat.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums">{formatNumber(cat.count)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{formatBytes(cat.size)}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge variant="outline" className="text-xs tabular-nums">{formatPercent(cat.percentage)}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {categoryBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                        {t('admin.storage.noCategories')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-primary" aria-hidden="true" />
              {t('admin.storage.healthTitle')}
            </CardTitle>
            <CardDescription>{t('admin.storage.healthDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground tabular-nums">
              <span>{t('admin.storage.used', { size: formatBytes(health.usedBytes) })}</span>
              <span>{t('admin.storage.limit', { size: formatBytes(LOCAL_STORAGE_LIMIT) })}</span>
            </div>
            <div
              className="h-3 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={t('admin.storage.healthTitle')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(health.percentage)}
            >
              <div className={cn('h-full rounded-full transition-all', healthTone.bar)} style={{ width: `${health.percentage}%` }} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="secondary" className={cn('text-xs tabular-nums', healthTone.badge)}>
                {t(`admin.storage.level.${health.level}`)} &mdash; {formatPercent(health.percentage)}
              </Badge>
              {health.level === 'critical' && (
                <p className="text-sm font-medium text-red-500">{t('admin.storage.lowWarning')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="size-5 text-primary" aria-hidden="true" />
              {t('admin.storage.actionsTitle')}
            </CardTitle>
            <CardDescription>{t('admin.storage.actionsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
                  <h3 className="font-semibold">{t('admin.storage.clearLogTitle')}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{t('admin.storage.clearLogDescription')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmClearLog(true)}
                  disabled={activityLog.length === 0}
                >
                  <Trash2 className="mr-2 size-4" aria-hidden="true" />
                  {t('admin.storage.clearLogButton', { count: activityLog.length })}
                </Button>
              </div>

              <div className="space-y-3 rounded-lg border border-destructive/30 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
                  <h3 className="font-semibold text-destructive">{t('admin.storage.clearAllTitle')}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{t('admin.storage.clearAllDescription')}</p>
                <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive" asChild>
                  <Link to={SETTINGS_DATA_PATH}>
                    {t('admin.storage.clearAllLink')}
                    <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <ConfirmDialog
          open={confirmClearLog}
          onClose={() => {
            if (!isClearing) setConfirmClearLog(false);
          }}
          onConfirm={() => void handleClearLog()}
          title={t('admin.storage.clearLogConfirmTitle')}
          description={t('admin.storage.clearLogConfirmDescription')}
          confirmLabel={t('admin.storage.clearLogConfirm')}
          destructive
        />
      </div>
    </PageTransition>
  );
}
