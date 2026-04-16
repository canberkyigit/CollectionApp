import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Database,
  HardDrive,
  Package,
  Layers,
  FolderOpen,
  AlertTriangle,
  Trash2,
  Clock,
} from 'lucide-react';
import { getCategoryIcon } from '@/lib/icons';
import { toast } from 'sonner';

import { PageHeader, StatCard, ConfirmDialog } from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAdminBreadcrumbs } from '@/lib/adminNavigation';
import { cn, formatNumber } from '@/lib/utils';
import { useCollectionStore } from '@/store/useCollectionStore';

function estimateSize(data: unknown): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return 0;
  }
}

const STORAGE_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-rose-500',
];

const LOCAL_STORAGE_LIMIT = 5 * 1024 * 1024; // 5 MB

export default function AdminStorage() {
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const { items, categories, wishlist, activityLog, clearActivityLog, wipeAllData } =
    useCollectionStore();

  const [confirmAction, setConfirmAction] = useState<
    'clear-log' | 'clear-all' | null
  >(null);

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
      { label: 'Items data', size: itemsSize, color: STORAGE_COLORS[0] },
      { label: 'Categories schema', size: categoriesSize, color: STORAGE_COLORS[1] },
      { label: 'Wishlist', size: wishlistSize, color: STORAGE_COLORS[2] },
      { label: 'Activity Log', size: activitySize, color: STORAGE_COLORS[3] },
      { label: 'Images (base64)', size: imagesSize, color: STORAGE_COLORS[4] },
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
          sizeKB: size / 1024,
          percentage: (size / totalSize) * 100,
        };
      })
      .sort((a, b) => b.sizeKB - a.sizeKB);
  }, [categories, items, sizeData.totalSize]);

  const healthStatus = useMemo(() => {
    const usedBytes = sizeData.totalSize;
    const percentage = (usedBytes / LOCAL_STORAGE_LIMIT) * 100;
    let color: string;
    let label: string;
    if (percentage < 50) {
      color = 'bg-green-500';
      label = 'Healthy';
    } else if (percentage < 80) {
      color = 'bg-yellow-500';
      label = 'Moderate';
    } else {
      color = 'bg-red-500';
      label = 'Critical';
    }
    return { usedBytes, percentage: Math.min(percentage, 100), color, label };
  }, [sizeData.totalSize]);

  const handleConfirm = async () => {
    if (confirmAction === 'clear-log') {
      clearActivityLog();
      toast.success('Activity log cleared');
    } else if (confirmAction === 'clear-all') {
      await wipeAllData();
      toast.success('All data cleared');
    }
    setConfirmAction(null);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
      <PageHeader
        title="Data & Storage"
        description="Monitor your collection data usage"
        breadcrumbs={getAdminBreadcrumbs(search ? `?${search}` : '', [{ label: 'Data & Storage' }])}
      />

      {/* Overview Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Items"
          value={formatNumber(items.length)}
          icon={Package}
          subtitle="across all categories"
        />
        <StatCard
          title="Total Categories"
          value={formatNumber(categories.length)}
          icon={Layers}
          subtitle="collection types"
        />
        <StatCard
          title="Estimated Data Size"
          value={formatBytes(sizeData.totalSize)}
          icon={Database}
          subtitle="in-memory store"
        />
      </div>

      {/* Storage Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="size-5 text-primary" />
            Storage Breakdown
          </CardTitle>
          <CardDescription>
            Percentage breakdown by data type
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Horizontal stacked bar */}
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
            {sizeData.segments.map((seg) => {
              const pct =
                sizeData.totalSize > 0
                  ? (seg.size / sizeData.totalSize) * 100
                  : 0;
              if (pct < 0.5) return null;
              return (
                <div
                  key={seg.label}
                  className={cn('h-full transition-all', seg.color)}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sizeData.segments.map((seg) => {
              const pct =
                sizeData.totalSize > 0
                  ? (seg.size / sizeData.totalSize) * 100
                  : 0;
              return (
                <div key={seg.label} className="flex items-center gap-3">
                  <div className={cn('size-3 shrink-0 rounded-full', seg.color)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {seg.label}
                      </span>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {pct.toFixed(1)}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(seg.size)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="size-5 text-primary" />
            Category Breakdown
          </CardTitle>
          <CardDescription>
            Data usage per collection category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Category
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    Items
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Size
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    % of Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {categoryBreakdown.map((cat) => {
                  const Icon = getCategoryIcon(cat.icon);
                  return (
                    <tr
                      key={cat.id}
                      className="border-b transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="rounded-lg bg-primary/10 p-1.5">
                            <Icon className="size-4 text-primary" />
                          </div>
                          <span className="font-medium">{cat.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {formatNumber(cat.count)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {cat.sizeKB.toFixed(1)} KB
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="outline" className="text-xs">
                          {cat.percentage.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {categoryBreakdown.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      No categories found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Storage Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-primary" />
            Storage Health
          </CardTitle>
          <CardDescription>
            localStorage usage relative to the typical 5 MB browser limit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {formatBytes(healthStatus.usedBytes)} used
            </span>
            <span className="text-muted-foreground">
              {formatBytes(LOCAL_STORAGE_LIMIT)} limit
            </span>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                healthStatus.color,
              )}
              style={{ width: `${healthStatus.percentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <Badge
              variant="secondary"
              className={cn(
                'text-xs',
                healthStatus.percentage >= 80 && 'bg-red-500/10 text-red-500',
                healthStatus.percentage >= 50 &&
                  healthStatus.percentage < 80 &&
                  'bg-yellow-500/10 text-yellow-500',
                healthStatus.percentage < 50 &&
                  'bg-green-500/10 text-green-500',
              )}
            >
              {healthStatus.label} &mdash; {healthStatus.percentage.toFixed(1)}%
            </Badge>
            {healthStatus.percentage >= 80 && (
              <p className="text-sm font-medium text-red-500">
                Storage is running low. Consider clearing unused data.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="size-5 text-primary" />
            Actions
          </CardTitle>
          <CardDescription>Manage and clear stored data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <h4 className="font-semibold">Clear Activity Log</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Remove all activity log entries. This frees up storage but
                you&apos;ll lose your action history.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmAction('clear-log')}
                disabled={activityLog.length === 0}
              >
                <Trash2 className="mr-2 size-4" />
                Clear Log ({formatNumber(activityLog.length)} entries)
              </Button>
            </div>

            <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-destructive" />
                <h4 className="font-semibold text-destructive">
                  Clear All Data
                </h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Permanently delete all items, categories, wishlist entries, and
                activity logs. This action cannot be undone.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmAction('clear-all')}
              >
                <Trash2 className="mr-2 size-4" />
                Clear All Data
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmAction === 'clear-log'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void handleConfirm()}
        title="Clear Activity Log"
        description="This will permanently delete all activity log entries. This action cannot be undone."
        confirmLabel="Clear Log"
        destructive
      />

      <ConfirmDialog
        open={confirmAction === 'clear-all'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void handleConfirm()}
        title="Clear All Data"
        description="This will permanently delete ALL items, categories, wishlist entries, and activity logs. This action cannot be undone."
        confirmLabel="Delete Everything"
        destructive
      />
    </div>
    </PageTransition>
  );
}
