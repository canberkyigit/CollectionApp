import React, { useId, useState, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  Package,
  FolderOpen,
  Users,
  Plus,
  ArrowRight,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Star,
  Heart,
  Clock,
  Send,
  Download,
  Settings2,
  Library,
  Sparkles,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { PageTransition, MotionGrid, MotionItem } from '@/components/shared/motion';
import { staggerContainer, staggerItem } from '@/components/shared/motion-variants';
import type { DashboardWidgetId, DashboardWidgetConfig } from '@/types';
import { useCollectionStore } from '@/store/useCollectionStore';
import { selectIsColdLoading } from '@/store/collectionStore.selectors';
import { useAuthStore } from '@/store/useAuthStore';
import { CustomizeDashboard } from '@/components/dashboard/CustomizeDashboard';
import { RealValueWidget } from '@/components/dashboard/RealValueWidget';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import { canEditContent, canManageCatalog } from '@/lib/permissions';
import { getLocale, useT } from '@/i18n';
import { currencyService } from '@/services/currencyService';
import { RelativeTime } from '@/components/shared/RelativeTime';
import {
  foldDashboardCategoryStats,
  getDashboardCategoryStats,
  getDashboardMonthlyAcquisitions,
  getDashboardSummary,
  getDashboardValueOverTime,
  getFavoriteDashboardItems,
  getFilteredDashboardItems,
  getRecentActivityPreview,
  getRecentDashboardItems,
  getTopDashboardContributors,
  getVisibleDashboardWidgets,
  getWishlistPendingCount,
  getWishlistPreviewItems,
  normalizeDashboardWidgets,
} from './dashboard-helpers';

const PIE_COLORS = [
  '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#ec4899', '#06b6d4', '#8b5cf6', '#f97316',
];

const CHART_GRID_COLOR = 'hsl(244 16% 82% / 0.24)';
const CHART_TICK_COLOR = 'hsl(224 8% 52%)';
const CHART_STROKE = 'hsl(229 84% 62%)';
const CHART_FILL = 'hsl(229 84% 62%)';
const AXIS_TICK = { fontSize: 12, fill: CHART_TICK_COLOR };

/** Shared panel look for every dashboard widget card (mirrored in RealValueWidget). */
const DASHBOARD_PANEL_CLASS =
  'h-full overflow-hidden border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.84))] shadow-[0_16px_40px_rgb(15_23_42_/_0.06)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.88))] dark:shadow-[0_18px_40px_rgb(0_0_0_/_0.22)]';

function useDisplayCurrency() {
  const dc = useCollectionStore((s) => s.displayCurrency);
  const fmt = (usdValue: number) => formatCurrency(currencyService.convert(usdValue, 'USD', dc), dc);
  const fmtRaw = (value: number, fromCurrency: string) =>
    formatCurrency(currencyService.convert(value, fromCurrency, dc), dc);
  const compact = new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency: dc,
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  const tickFmt = (usdValue: number) => compact.format(currencyService.convert(usdValue, 'USD', dc));
  return { fmt, fmtRaw, tickFmt };
}

function formatMonthKey(key: string): string {
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString(getLocale(), { month: 'short', year: '2-digit' });
}

function formatSignedPercent(value: number): string {
  return new Intl.NumberFormat(getLocale(), {
    style: 'percent',
    signDisplay: 'exceptZero',
    maximumFractionDigits: 1,
  }).format(value / 100);
}

function formatShare(fraction: number): string {
  return new Intl.NumberFormat(getLocale(), { style: 'percent', maximumFractionDigits: 0 }).format(fraction);
}

interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

function DashboardTooltipCard({ title, rows }: { title?: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
      {title && <p className="text-xs text-muted-foreground">{title}</p>}
      {rows.map((row) => (
        <p key={row.label} className="text-sm font-semibold tabular-nums" style={{ color: row.color }}>
          {row.label}: {row.value}
        </p>
      ))}
    </div>
  );
}

interface RechartsTooltipProps<T> {
  active?: boolean;
  payload?: readonly { payload?: T }[];
}

const RADIAN = Math.PI / 180;
interface PieLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}

const renderPieLabel = ({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  percent = 0,
}: PieLabelProps) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.05) return null;
  return (
    <text x={x} y={y} fill="currentColor" className="text-xs fill-muted-foreground"
      textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {formatShare(percent)}
    </text>
  );
};

function sizeToColSpan(size: DashboardWidgetConfig['size']) {
  switch (size) {
    case 'full': return 'col-span-2 lg:col-span-6';
    case 'half': return 'col-span-2 sm:col-span-1 lg:col-span-3';
    case 'third': return 'col-span-2 sm:col-span-1 lg:col-span-2';
  }
}

function DashboardWidgetShell({
  title,
  description,
  icon: Icon,
  action,
  children,
  contentClassName,
}: {
  title: string;
  description: string;
  icon?: typeof TrendingUp;
  action?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}) {
  const titleId = useId();
  return (
    <Card role="region" aria-labelledby={titleId} className={DASHBOARD_PANEL_CLASS}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 border-b border-border/55 pb-4">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            {Icon && (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary" aria-hidden="true">
                <Icon className="size-4.5" />
              </span>
            )}
            <span id={titleId}>{title}</span>
          </CardTitle>
          <CardDescription className="mt-2 text-sm leading-6">
            {description}
          </CardDescription>
        </div>
        {action}
      </CardHeader>
      <CardContent className={cn('p-5', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

function DashboardEmpty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-5 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

function DashboardMiniMetric({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-border/60 bg-background/55 p-4 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.35)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary" aria-hidden="true">
          <Icon className="size-4.5" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function HeroTile({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-border/60 bg-background/65 px-4 py-3 backdrop-blur-sm', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function HeroStripTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[1.25rem] border border-border/60 bg-background/55 px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const t = useT();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const role = user?.role ?? 'viewer';
  const canCreateCategory = canManageCatalog(role);
  const canAddItems = canEditContent(role);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [selectedLibrary, setSelectedLibrary] = useState<string>('all');
  const { fmt, fmtRaw, tickFmt } = useDisplayCurrency();

  const {
    items,
    categories,
    libraries,
    contributors,
    wishlist,
    activityLog,
    dashboardWidgets,
    ownerUserId,
    isRemoteDataLoading,
    getCategoryById,
  } = useCollectionStore();
  const shouldShowLoadingState = selectIsColdLoading(
    { ownerUserId, isRemoteDataLoading },
    [
      items.length,
      categories.length,
      libraries.length,
      contributors.length,
      wishlist.length,
      activityLog.length,
    ],
  );

  // Every item-based widget respects the library scope.
  const filteredItems = useMemo(() => getFilteredDashboardItems(items, selectedLibrary), [items, selectedLibrary]);
  const categoryStats = useMemo(() => getDashboardCategoryStats(categories, filteredItems), [categories, filteredItems]);
  const distributionStats = useMemo(
    () => foldDashboardCategoryStats(categoryStats, t('dashboard.otherCategories')),
    [categoryStats, t],
  );
  const recentItems = useMemo(() => getRecentDashboardItems(filteredItems, 6), [filteredItems]);
  const favoriteItems = useMemo(() => getFavoriteDashboardItems(filteredItems), [filteredItems]);
  const valueOverTime = useMemo(() => getDashboardValueOverTime(filteredItems), [filteredItems]);
  const monthlyAcquisitions = useMemo(() => getDashboardMonthlyAcquisitions(filteredItems), [filteredItems]);
  const contributorList = useMemo(
    () => getTopDashboardContributors(contributors, filteredItems, 5),
    [contributors, filteredItems],
  );
  const visibleWidgets = useMemo(
    () => getVisibleDashboardWidgets(normalizeDashboardWidgets(dashboardWidgets)),
    [dashboardWidgets],
  );
  const { totalValue, totalPurchasePrice, itemsWithPurchase, valueTrend } = useMemo(
    () => getDashboardSummary(filteredItems),
    [filteredItems],
  );
  const wishlistPendingCount = useMemo(() => getWishlistPendingCount(wishlist), [wishlist]);
  const wishlistPreviewItems = useMemo(() => getWishlistPreviewItems(wishlist, 4), [wishlist]);
  const recentActivity = useMemo(() => getRecentActivityPreview(activityLog, 5), [activityLog]);
  const selectedLibraryLabel = selectedLibrary === 'all'
    ? t('dashboard.scope.all')
    : (libraries.find((library) => library.id === selectedLibrary)?.name ?? t('dashboard.scope.all'));
  const averageItemValue = filteredItems.length > 0 ? totalValue / filteredItems.length : 0;
  const gainLoss = totalValue - totalPurchasePrice;
  const contributorCount = contributorList.length;

  const viewAll = (path: string) => (
    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => navigate(path)}>
      {t('dashboard.viewAll')} <ArrowRight className="ml-1 size-4" aria-hidden="true" />
    </Button>
  );

  const widgetRenderers: Record<DashboardWidgetId, (w: DashboardWidgetConfig) => ReactNode> = {
    'stats': () => (
      <section className="col-span-full" aria-label={t('dashboard.hero.eyebrow')}>
        <MotionGrid
          className="grid gap-4 lg:grid-cols-6 lg:gap-6"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <MotionItem variants={staggerItem} className="lg:col-span-4">
            <Card className="relative h-full overflow-hidden border-border/70 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,0.88))] shadow-[0_18px_50px_rgb(15_23_42_/_0.08)] dark:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.18),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.97),rgba(15,23,42,0.9))] dark:shadow-[0_24px_60px_rgb(0_0_0_/_0.28)]">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),transparent_42%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.06),transparent_42%)]" />
              <CardContent className="relative space-y-6 p-5 sm:p-6 lg:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <Badge className="h-7 rounded-full border border-primary/15 bg-background/70 px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary shadow-sm hover:bg-background/70">
                      <Sparkles className="mr-1.5 size-3.5" aria-hidden="true" />
                      {t('dashboard.hero.eyebrow')}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t('dashboard.totalValue')} · {selectedLibraryLabel}
                      </p>
                      <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
                        <h2 className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                          {fmt(totalValue)}
                        </h2>
                        {valueTrend !== null && (
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold tabular-nums',
                              valueTrend >= 0
                                ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
                            )}
                          >
                            {valueTrend >= 0
                              ? <TrendingUp className="mr-1.5 size-4" aria-hidden="true" />
                              : <TrendingDown className="mr-1.5 size-4" aria-hidden="true" />}
                            {t('dashboard.trendVsCost', { value: formatSignedPercent(valueTrend) })}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                      {t('dashboard.hero.summary', {
                        count: filteredItems.length,
                        value: fmt(totalValue),
                        items: formatNumber(filteredItems.length),
                        basis: fmt(totalPurchasePrice),
                        priced: formatNumber(itemsWithPurchase.length),
                      })}
                    </p>
                  </div>

                  <div className="grid min-w-[220px] gap-2 sm:max-w-[240px]">
                    <HeroTile label={t('dashboard.kpi.average')}>
                      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{fmt(averageItemValue)}</p>
                    </HeroTile>
                    <HeroTile label={t('dashboard.kpi.purchaseBasis')}>
                      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{fmt(totalPurchasePrice)}</p>
                    </HeroTile>
                    <HeroTile label={t('dashboard.kpi.gainLoss')}>
                      <p
                        className={cn(
                          'mt-1 text-2xl font-semibold tracking-tight tabular-nums',
                          gainLoss > 0 && 'text-emerald-600 dark:text-emerald-400',
                          gainLoss < 0 && 'text-rose-600 dark:text-rose-400',
                        )}
                      >
                        {`${gainLoss > 0 ? '+' : ''}${fmt(gainLoss)}`}
                      </p>
                    </HeroTile>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <HeroStripTile label={t('dashboard.totalValue')}>
                    <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{fmt(totalValue)}</p>
                  </HeroStripTile>
                  <HeroStripTile label={t('dashboard.hero.activeLibrary')}>
                    <p className="mt-2 text-lg font-semibold tracking-tight">{selectedLibraryLabel}</p>
                  </HeroStripTile>
                  <HeroStripTile label={t('dashboard.hero.trackedItems')}>
                    <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                      {formatNumber(filteredItems.length)}
                    </p>
                  </HeroStripTile>
                </div>
              </CardContent>
            </Card>
          </MotionItem>

          <MotionItem variants={staggerItem} className="lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <DashboardMiniMetric
                icon={Package}
                label={t('dashboard.kpi.items')}
                value={formatNumber(filteredItems.length)}
                description={selectedLibrary === 'all' ? t('dashboard.mini.itemsAll') : t('dashboard.mini.itemsScoped')}
              />
              <DashboardMiniMetric
                icon={FolderOpen}
                label={t('dashboard.mini.collections')}
                value={formatNumber(categories.length)}
                description={t('dashboard.mini.collectionsDescription', {
                  libraries: t('dashboard.librariesCount', { count: libraries.length, n: formatNumber(libraries.length) }),
                  contributors: t('dashboard.contributorsCount', { count: contributorCount, n: formatNumber(contributorCount) }),
                })}
              />
            </div>
          </MotionItem>
        </MotionGrid>
      </section>
    ),

    'real-value': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <RealValueWidget items={filteredItems} />
      </div>
    ),

    'value-over-time': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <DashboardWidgetShell
          title={t('dashboard.widget.value-over-time')}
          description={t('dashboard.valueOverTime.description')}
          icon={TrendingUp}
        >
          {valueOverTime.length === 0 ? (
            <DashboardEmpty title={t('dashboard.noData')} description={t('dashboard.valueOverTime.empty')} />
          ) : (
            <div className="h-48 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={valueOverTime}>
                  <defs>
                    <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_FILL} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={CHART_FILL} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                  <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={formatMonthKey} axisLine={false} tickLine={false} minTickGap={16} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={tickFmt} width={64} />
                  <Tooltip
                    content={({ active, payload }: RechartsTooltipProps<{ date: string; value: number }>) => {
                      const point = active ? payload?.[0]?.payload : undefined;
                      if (!point) return null;
                      return (
                        <DashboardTooltipCard
                          title={formatMonthKey(point.date)}
                          rows={[{ label: t('dashboard.series.value'), value: fmt(point.value), color: CHART_STROKE }]}
                        />
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="value" name={t('dashboard.series.value')} stroke={CHART_STROKE}
                    strokeWidth={2.5} fill="url(#valueGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardWidgetShell>
      </div>
    ),

    'category-distribution': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <DashboardWidgetShell
          title={t('dashboard.widget.category-distribution')}
          description={t('dashboard.distribution.description')}
          icon={BarChart3}
        >
          {distributionStats.length === 0 ? (
            <DashboardEmpty title={t('dashboard.noData')} description={t('dashboard.distribution.empty')} />
          ) : (
            <>
              <div className="h-48 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={distributionStats} cx="50%" cy="45%" innerRadius={60} outerRadius={100}
                      dataKey="count" nameKey="name" label={renderPieLabel} labelLine={false}
                      strokeWidth={2} stroke="hsl(0 0% 100% / 0.55)">
                      {distributionStats.map((stat, index) => (
                        <Cell key={stat.categoryId} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }: RechartsTooltipProps<{ name: string; count: number }>) => {
                        const slice = active ? payload?.[0]?.payload : undefined;
                        if (!slice) return null;
                        return (
                          <DashboardTooltipCard
                            rows={[{ label: slice.name, value: t('dashboard.itemsCount', { count: slice.count, n: formatNumber(slice.count) }) }]}
                          />
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                {distributionStats.map((stat, index) => (
                  <li key={stat.categoryId} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-block size-2.5 rounded-full" aria-hidden="true"
                      style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                    {stat.name}
                    <span className="tabular-nums">({formatNumber(stat.count)})</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </DashboardWidgetShell>
      </div>
    ),

    'value-by-category': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <DashboardWidgetShell
          title={t('dashboard.widget.value-by-category')}
          description={t('dashboard.valueByCategory.description')}
          icon={DollarSign}
        >
          {categoryStats.length === 0 ? (
            <DashboardEmpty title={t('dashboard.noData')} description={t('dashboard.distribution.empty')} />
          ) : (
            <div className="h-48 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryStats} layout="vertical">
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={CHART_STROKE} />
                      <stop offset="100%" stopColor="hsl(231 88% 74%)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={tickFmt} />
                  <YAxis type="category" dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} width={100} />
                  <Tooltip
                    content={({ active, payload }: RechartsTooltipProps<{ name: string; totalValue: number; count: number }>) => {
                      const stat = active ? payload?.[0]?.payload : undefined;
                      if (!stat) return null;
                      return (
                        <DashboardTooltipCard
                          title={stat.name}
                          rows={[
                            { label: t('dashboard.series.value'), value: fmt(stat.totalValue), color: CHART_STROKE },
                            { label: t('dashboard.kpi.items'), value: formatNumber(stat.count) },
                          ]}
                        />
                      );
                    }}
                  />
                  <Bar dataKey="totalValue" name={t('dashboard.series.value')} fill="url(#barGradient)" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardWidgetShell>
      </div>
    ),

    'acquisition-timeline': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <DashboardWidgetShell
          title={t('dashboard.widget.acquisition-timeline')}
          description={t('dashboard.acquisitions.description')}
          icon={Package}
        >
          {monthlyAcquisitions.length === 0 ? (
            <DashboardEmpty title={t('dashboard.noData')} description={t('dashboard.acquisitions.empty')} />
          ) : (
            <div className="h-48 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyAcquisitions}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                  <XAxis dataKey="month" tick={AXIS_TICK} tickFormatter={formatMonthKey} axisLine={false} tickLine={false} minTickGap={12} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={tickFmt} width={64} />
                  <Tooltip
                    content={({ active, payload }: RechartsTooltipProps<{ month: string; value: number; count: number }>) => {
                      const point = active ? payload?.[0]?.payload : undefined;
                      if (!point) return null;
                      return (
                        <DashboardTooltipCard
                          title={formatMonthKey(point.month)}
                          rows={[
                            { label: t('dashboard.series.spend'), value: fmt(point.value), color: CHART_STROKE },
                            { label: t('dashboard.kpi.items'), value: formatNumber(point.count), color: '#10b981' },
                          ]}
                        />
                      );
                    }}
                  />
                  <Bar dataKey="value" name={t('dashboard.series.spend')} fill={CHART_STROKE} radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardWidgetShell>
      </div>
    ),

    'recent-items': (w) => (
      <div className={cn(sizeToColSpan(w.size), w.size === 'half' && 'col-span-2 lg:col-span-4')}>
        <DashboardWidgetShell
          title={t('dashboard.widget.recent-items')}
          description={t('dashboard.recent.description')}
          icon={Clock}
          action={viewAll('/collections')}
        >
          {recentItems.length === 0 ? (
            <DashboardEmpty title={t('dashboard.recent.emptyTitle')} description={t('dashboard.recent.emptyDescription')} />
          ) : (
            <ul className="divide-y divide-border">
              {recentItems.map((item) => {
                const category = getCategoryById(item.categoryId);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/items/${item.id}`)}
                      className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-4 rounded-lg px-2 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium" title={item.title}>{item.title}</span>
                        <span className="mt-0.5 flex items-center gap-2">
                          {category && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{category.name}</Badge>}
                          <RelativeTime date={item.createdAt} className="text-xs text-muted-foreground" />
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-primary tabular-nums">
                        {fmtRaw(item.purchaseInfo.purchasePrice, item.purchaseInfo.purchaseCurrency)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </DashboardWidgetShell>
      </div>
    ),

    'contributors': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <DashboardWidgetShell
          title={t('dashboard.widget.contributors')}
          description={t('dashboard.contributors.description')}
          icon={Users}
        >
          {contributorList.length === 0 ? (
            <DashboardEmpty title={t('dashboard.noData')} description={t('dashboard.contributors.empty')} />
          ) : (
            <ul className="space-y-4">
              {contributorList.map((contributor) => (
                <li key={contributor.id} className="flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarImage src={contributor.avatar} alt="" />
                    <AvatarFallback className="text-xs">
                      {contributor.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{contributor.name}</p>
                      <Badge
                        variant={contributor.role === 'admin' ? 'default' : 'secondary'}
                        className="px-1.5 py-0 text-[10px]"
                      >
                        {t(`dashboard.role.${contributor.role}`)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {t('dashboard.itemsCount', { count: contributor.derivedItemCount, n: formatNumber(contributor.derivedItemCount) })} &middot; {fmt(contributor.derivedTotalContributionValue)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DashboardWidgetShell>
      </div>
    ),

    'starred-items': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <DashboardWidgetShell
          title={t('dashboard.widget.starred-items')}
          description={t('dashboard.starred.description', { count: favoriteItems.length, n: formatNumber(favoriteItems.length) })}
          icon={Star}
          action={viewAll('/favorites')}
        >
          {favoriteItems.length === 0 ? (
            <DashboardEmpty
              title={t('dashboard.starred.emptyTitle')}
              description={t('dashboard.starred.emptyDescription')}
              action={(
                <Button variant="outline" size="sm" onClick={() => navigate('/collections')}>
                  {t('dashboard.browseCollections')}
                </Button>
              )}
            />
          ) : (
            <ul className="space-y-3">
              {favoriteItems.slice(0, 4).map((item) => {
                const category = getCategoryById(item.categoryId);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/items/${item.id}`)}
                      className="flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors hover:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium" title={item.title}>{item.title}</span>
                        {category && <span className="block truncate text-xs text-muted-foreground">{category.name}</span>}
                      </span>
                      <Star className="size-3.5 shrink-0 fill-amber-500 text-amber-500" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </DashboardWidgetShell>
      </div>
    ),

    'wishlist': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <DashboardWidgetShell
          title={t('dashboard.widget.wishlist')}
          description={t('dashboard.wishlist.description', { count: wishlistPendingCount, n: formatNumber(wishlistPendingCount) })}
          icon={Heart}
          action={viewAll('/wishlist')}
        >
          {wishlistPendingCount === 0 ? (
            <DashboardEmpty
              title={t('dashboard.wishlist.emptyTitle')}
              description={t('dashboard.wishlist.emptyDescription')}
              action={(
                <Button variant="outline" size="sm" onClick={() => navigate('/wishlist')}>
                  {t('dashboard.wishlist.open')}
                </Button>
              )}
            />
          ) : (
            <ul className="space-y-3">
              {wishlistPreviewItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={item.title}>{item.title}</p>
                    <Badge
                      variant={item.priority === 'must-have' ? 'destructive' : item.priority === 'high' ? 'warning' : 'secondary'}
                      className="mt-0.5 text-[10px]"
                    >
                      {t(`dashboard.priority.${item.priority}`)}
                    </Badge>
                  </div>
                  {item.targetPrice ? (
                    <span className="shrink-0 text-sm font-semibold text-muted-foreground tabular-nums">
                      {fmtRaw(item.targetPrice, item.targetCurrency ?? 'USD')}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </DashboardWidgetShell>
      </div>
    ),

    'recent-activity': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <DashboardWidgetShell
          title={t('dashboard.widget.recent-activity')}
          description={t('dashboard.activity.description')}
          icon={Clock}
          action={viewAll('/activity')}
        >
          {recentActivity.length === 0 ? (
            <DashboardEmpty
              title={t('dashboard.activity.emptyTitle')}
              description={t('dashboard.activity.emptyDescription')}
              action={(
                <Button variant="outline" size="sm" onClick={() => navigate('/collections')}>
                  {t('dashboard.browseCollections')}
                </Button>
              )}
            />
          ) : (
            <ul className="space-y-3">
              {recentActivity.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.entityTitle}</p>
                    <RelativeTime date={entry.timestamp} className="block text-xs text-muted-foreground" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DashboardWidgetShell>
      </div>
    ),

    'quick-actions': () => (
      <div className="col-span-full">
        <Card className="overflow-hidden border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.84))] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.88))]">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
            {canAddItems && (
              <Button onClick={() => navigate('/items/new')}>
                <Plus className="mr-1.5 size-4" aria-hidden="true" /> {t('dashboard.actions.addItem')}
              </Button>
            )}
            {canCreateCategory && (
              <Button variant="outline" onClick={() => navigate('/admin/categories/new')}>
                <FolderOpen className="mr-1.5 size-4" aria-hidden="true" /> {t('dashboard.actions.newCategory')}
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/wishlist')}>
              <Heart className="mr-1.5 size-4" aria-hidden="true" /> {t('dashboard.actions.wishlist')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/lending')}>
              <Send className="mr-1.5 size-4" aria-hidden="true" /> {t('dashboard.actions.lending')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/export')}>
              <Download className="mr-1.5 size-4" aria-hidden="true" /> {t('dashboard.actions.export')}
            </Button>
          </CardContent>
        </Card>
      </div>
    ),
  };

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader title={t('dashboard.title')} description={t('dashboard.description')}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCustomizeOpen(true)}
            className="gap-1.5"
          >
            <Settings2 className="size-4" aria-hidden="true" />
            {t('dashboard.customize')}
          </Button>
        </PageHeader>

        {shouldShowLoadingState ? (
          <div className="space-y-6">
            <LoadingSkeleton variant="card" count={4} />
            <LoadingSkeleton variant="card" count={4} className="lg:grid-cols-2" />
          </div>
        ) : (
          <>
            {libraries.length > 0 && (
              <Card className="overflow-hidden border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.82))] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.93),rgba(15,23,42,0.88))]">
                <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary" aria-hidden="true">
                      <Library className="size-4.5 shrink-0" />
                    </span>
                    <div>
                      <p id="dashboard-scope-label" className="text-sm font-semibold">{t('dashboard.scope.title')}</p>
                      <p className="text-xs text-muted-foreground">{t('dashboard.scope.description')}</p>
                    </div>
                  </div>
                  <div role="group" aria-labelledby="dashboard-scope-label" className="flex items-center gap-2 overflow-x-auto pb-1">
                    {[{ id: 'all', name: t('dashboard.scope.all') }, ...libraries].map((library) => (
                      <button
                        key={library.id}
                        type="button"
                        aria-pressed={selectedLibrary === library.id}
                        onClick={() => setSelectedLibrary(library.id)}
                        className={cn(
                          'whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold transition-all',
                          selectedLibrary === library.id
                            ? 'border-primary/20 bg-primary text-primary-foreground shadow-sm'
                            : 'border-border/70 bg-background/65 text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {library.name}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6 lg:gap-6">
              {visibleWidgets.map((widget) => {
                const render = widgetRenderers[widget.id];
                if (!render) return null;
                return <React.Fragment key={widget.id}>{render(widget)}</React.Fragment>;
              })}
            </div>

            {visibleWidgets.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-[1.75rem] border border-dashed py-20">
                <Settings2 className="size-12 text-muted-foreground/30" aria-hidden="true" />
                <div className="text-center">
                  <p className="text-lg font-semibold">{t('dashboard.noWidgetsTitle')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.noWidgetsDescription')}</p>
                </div>
                <Button variant="outline" onClick={() => setCustomizeOpen(true)}>
                  <Settings2 className="mr-1.5 size-4" aria-hidden="true" />
                  {t('dashboard.customizeTitle')}
                </Button>
              </div>
            )}

            <CustomizeDashboard open={customizeOpen} onOpenChange={setCustomizeOpen} />
          </>
        )}
      </div>
    </PageTransition>
  );
}
