import React, { useState, useMemo, type ReactNode } from 'react';
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
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatCurrency, formatNumber, formatRelativeDate, cn } from '@/lib/utils';
import { canManageCatalog } from '@/lib/permissions';
import { currencyService } from '@/services/currencyService';
import {
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
} from './dashboard-helpers';

const PIE_COLORS = [
  '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#ec4899', '#06b6d4', '#8b5cf6', '#f97316',
];

const CHART_GRID_COLOR = 'hsl(244 16% 82% / 0.24)';
const CHART_TICK_COLOR = 'hsl(224 8% 52%)';
const CHART_STROKE = 'hsl(229 84% 62%)';
const CHART_FILL = 'hsl(229 84% 62%)';

function useDisplayCurrency() {
  const dc = useCollectionStore((s) => s.displayCurrency);
  const fmt = (usdValue: number) => formatCurrency(currencyService.convert(usdValue, 'USD', dc), dc);
  const fmtRaw = (value: number, fromCurrency: string) =>
    formatCurrency(currencyService.convert(value, fromCurrency, dc), dc);
  const sym = currencyService.getCurrencySymbol(dc);
  const tickFmt = (v: number) => `${sym}${(currencyService.convert(v, 'USD', dc) / 1000).toFixed(0)}k`;
  return { fmt, fmtRaw, tickFmt };
}

interface DashboardTooltipEntry {
  color?: string;
  name?: string;
  value?: number | string | null;
}

interface DashboardTooltipProps {
  active?: boolean;
  payload?: DashboardTooltipEntry[];
  label?: string | number;
  fmt: (value: number) => string;
}

function DashboardTooltip({ active, payload, label, fmt }: DashboardTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? fmt(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
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
      {`${(percent * 100).toFixed(0)}%`}
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
  return (
    <Card className="h-full overflow-hidden border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.84))] shadow-[0_16px_40px_rgb(15_23_42_/_0.06)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.88))] dark:shadow-[0_18px_40px_rgb(0_0_0_/_0.22)]">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/55 pb-4">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            {Icon && (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                <Icon className="size-4.5" />
              </span>
            )}
            <span>{title}</span>
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
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
          <Icon className="size-4.5" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const canCreateCategory = canManageCatalog(user?.role ?? 'viewer');
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
  const filteredItems = useMemo(() => getFilteredDashboardItems(items, selectedLibrary), [items, selectedLibrary]);
  const categoryStats = useMemo(() => getDashboardCategoryStats(categories, items), [categories, items]);
  const recentItems = useMemo(() => getRecentDashboardItems(items, 6), [items]);
  const favoriteItems = useMemo(() => getFavoriteDashboardItems(items), [items]);
  const valueOverTime = useMemo(() => getDashboardValueOverTime(items), [items]);
  const monthlyAcquisitions = useMemo(() => getDashboardMonthlyAcquisitions(items), [items]);
  const contributorList = useMemo(() => getTopDashboardContributors(contributors, items, 5), [contributors, items]);
  const visibleWidgets = useMemo(() => getVisibleDashboardWidgets(dashboardWidgets), [dashboardWidgets]);
  const { totalValue, totalPurchasePrice, itemsWithPurchase, valueTrend } = useMemo(
    () => getDashboardSummary(filteredItems),
    [filteredItems],
  );
  const wishlistPendingCount = useMemo(() => getWishlistPendingCount(wishlist), [wishlist]);
  const wishlistPreviewItems = useMemo(() => getWishlistPreviewItems(wishlist, 4), [wishlist]);
  const recentActivity = useMemo(() => getRecentActivityPreview(activityLog, 5), [activityLog]);
  const allLibraries = libraries;
  const contributorCount = contributorList.length;
  const selectedLibraryLabel = selectedLibrary === 'all'
    ? 'All Libraries'
    : (allLibraries.find((library) => library.id === selectedLibrary)?.name ?? 'Selected Library');
  const averageItemValue = filteredItems.length > 0 ? totalValue / filteredItems.length : 0;


  const widgetRenderers: Record<DashboardWidgetId, (w: DashboardWidgetConfig) => ReactNode> = {
    'stats': () => (
      <div className="col-span-full">
        <MotionGrid
          className="grid gap-4 lg:grid-cols-6 lg:gap-6"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <MotionItem variants={staggerItem} className="lg:col-span-4">
            <Card className="relative overflow-hidden border-border/70 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,0.88))] shadow-[0_18px_50px_rgb(15_23_42_/_0.08)] dark:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.18),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.97),rgba(15,23,42,0.9))] dark:shadow-[0_24px_60px_rgb(0_0_0_/_0.28)]">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),transparent_42%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.06),transparent_42%)]" />
              <CardContent className="relative space-y-6 p-5 sm:p-6 lg:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <Badge className="h-7 rounded-full border border-primary/15 bg-background/70 px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary shadow-sm">
                      <Sparkles className="mr-1.5 size-3.5" />
                      Portfolio Overview
                    </Badge>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {selectedLibraryLabel}
                      </p>
                      <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
                        <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                          {fmt(totalValue)}
                        </h2>
                        {valueTrend !== null && (
                          <span className={cn(
                            'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold',
                            valueTrend >= 0
                              ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
                          )}>
                            <TrendingUp className="mr-1.5 size-4" />
                            {valueTrend >= 0 ? '+' : ''}{valueTrend.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                      Your collection is currently valued at {fmt(totalValue)} across {formatNumber(filteredItems.length)} active {filteredItems.length === 1 ? 'item' : 'items'}.
                      Purchase basis is {fmt(totalPurchasePrice)} from {formatNumber(itemsWithPurchase.length)} priced entries.
                    </p>
                  </div>

                  <div className="grid min-w-[220px] gap-2 sm:max-w-[240px]">
                    <div className="rounded-2xl border border-border/60 bg-background/65 px-4 py-3 backdrop-blur-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Average Item
                      </p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight">{fmt(averageItemValue)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/65 px-4 py-3 backdrop-blur-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Purchase Basis
                      </p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight">{fmt(totalPurchasePrice)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.25rem] border border-border/60 bg-background/55 px-4 py-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Estimated Value
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">{fmt(totalValue)}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-border/60 bg-background/55 px-4 py-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Active Library
                    </p>
                    <p className="mt-2 text-lg font-semibold tracking-tight">{selectedLibraryLabel}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-border/60 bg-background/55 px-4 py-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Tracked Items
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">
                      {formatNumber(filteredItems.length)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </MotionItem>

          <MotionItem variants={staggerItem} className="lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <DashboardMiniMetric
                icon={Package}
                label="Items"
                value={formatNumber(filteredItems.length)}
                description={selectedLibrary === 'all' ? 'Across all categories and libraries' : 'Inside the selected library scope'}
              />
              <DashboardMiniMetric
                icon={FolderOpen}
                label="Collections"
                value={formatNumber(categories.length)}
                description={`${formatNumber(allLibraries.length)} libraries and ${formatNumber(contributorCount)} contributors tracked`}
              />
            </div>
          </MotionItem>
        </MotionGrid>
      </div>
    ),

    'value-over-time': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <DashboardWidgetShell
          title="Value Over Time"
          description="Portfolio valuation trend"
          icon={TrendingUp}
        >
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
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: CHART_TICK_COLOR }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: CHART_TICK_COLOR }} axisLine={false} tickLine={false}
                    tickFormatter={tickFmt} />
                  <Tooltip content={<DashboardTooltip fmt={fmt} />} />
                  <Area type="monotone" dataKey="value" name="Value" stroke={CHART_STROKE}
                    strokeWidth={2.5} fill="url(#valueGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
        </DashboardWidgetShell>
      </div>
    ),

    'category-distribution': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <DashboardWidgetShell
          title="Category Distribution"
          description="Items per category"
          icon={BarChart3}
        >
            <div className="h-48 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryStats} cx="50%" cy="45%" innerRadius={60} outerRadius={100}
                    dataKey="count" nameKey="name" label={renderPieLabel} labelLine={false}
                    strokeWidth={2} stroke="hsl(0 0% 100% / 0.55)">
                    {categoryStats.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<DashboardTooltip fmt={fmt} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {categoryStats.map((stat, index) => (
                <div key={stat.categoryId} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                  {stat.name}
                </div>
              ))}
            </div>
        </DashboardWidgetShell>
      </div>
    ),

    'value-by-category': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <DashboardWidgetShell
          title="Value by Category"
          description="Total estimated value per category"
          icon={DollarSign}
        >
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
                  <XAxis type="number" tick={{ fontSize: 12, fill: CHART_TICK_COLOR }} axisLine={false}
                    tickLine={false} tickFormatter={tickFmt} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: CHART_TICK_COLOR }}
                    axisLine={false} tickLine={false} width={100} />
                  <Tooltip content={<DashboardTooltip fmt={fmt} />} />
                  <Bar dataKey="totalValue" name="Value" fill="url(#barGradient)" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
        </DashboardWidgetShell>
      </div>
    ),

    'acquisition-timeline': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <DashboardWidgetShell
          title="Acquisition Timeline"
          description="Monthly items acquired and spend"
          icon={Package}
        >
            <div className="h-48 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyAcquisitions}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: CHART_TICK_COLOR }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12, fill: CHART_TICK_COLOR }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: CHART_TICK_COLOR }}
                    axisLine={false} tickLine={false} tickFormatter={tickFmt} />
                  <Tooltip content={<DashboardTooltip fmt={fmt} />} />
                  <Bar yAxisId="left" dataKey="count" name="Items" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar yAxisId="right" dataKey="value" name="Spend" fill={CHART_STROKE} radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
        </DashboardWidgetShell>
      </div>
    ),

    'recent-items': (w) => (
      <div className={cn(sizeToColSpan(w.size), w.size === 'half' && 'col-span-2 lg:col-span-4')}>
        <DashboardWidgetShell
          title="Recently Added"
          description="Latest additions to your collection"
          icon={Clock}
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate('/collections')}>
              View All <ArrowRight className="ml-1 size-4" />
            </Button>
          }
        >
            <div className="divide-y divide-border">
              {recentItems.map((item) => {
                const category = getCategoryById(item.categoryId);
                return (
                  <button key={item.id} type="button" onClick={() => navigate(`/items/${item.id}`)}
                    className="flex w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:bg-muted/50 -mx-2 px-2 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        {category && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{category.name}</Badge>}
                        <span className="text-xs text-muted-foreground">{formatRelativeDate(item.createdAt)}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-primary">
                      {fmtRaw(item.purchaseInfo.purchasePrice, item.purchaseInfo.purchaseCurrency)}
                    </span>
                  </button>
                );
              })}
            </div>
        </DashboardWidgetShell>
      </div>
    ),

    'contributors': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <DashboardWidgetShell
          title="Top Contributors"
          description="Most active team members"
          icon={Users}
        >
            <div className="space-y-4">
              {contributorList.map((contributor) => (
                <div key={contributor.id} className="flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarImage src={contributor.avatar} alt={contributor.name} />
                    <AvatarFallback className="text-xs">
                      {contributor.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{contributor.name}</p>
                      <Badge variant={contributor.role === 'admin' ? 'default' : 'secondary'}
                        className="text-[10px] px-1.5 py-0">{contributor.role}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {contributor.derivedItemCount} items &middot; {fmt(contributor.derivedTotalContributionValue)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
        </DashboardWidgetShell>
      </div>
    ),

    'starred-items': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <DashboardWidgetShell
          title="Starred Items"
          description={`${favoriteItems.length} favorites`}
          icon={Star}
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate('/favorites')}>
              View All <ArrowRight className="ml-1 size-4" />
            </Button>
          }
        >
            <div className="space-y-3">
              {favoriteItems.slice(0, 4).map((item) => {
                const cat = getCategoryById(item.categoryId);
                return (
                  <button key={item.id} onClick={() => navigate(`/items/${item.id}`)}
                    className="flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      {cat && <p className="text-xs text-muted-foreground">{cat.name}</p>}
                    </div>
                    <Star className="size-3.5 shrink-0 fill-amber-500 text-amber-500" />
                  </button>
                );
              })}
              {favoriteItems.length === 0 && (
                <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-5 text-center">
                  <p className="text-sm font-medium">No starred items yet</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Star a few standout pieces to keep them one tap away here.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/collections')}>
                    Browse Collections
                  </Button>
                </div>
              )}
            </div>
        </DashboardWidgetShell>
      </div>
    ),

    'wishlist': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <DashboardWidgetShell
          title="Wishlist"
          description={`${wishlistPendingCount} items wanted`}
          icon={Heart}
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate('/wishlist')}>
              View All <ArrowRight className="ml-1 size-4" />
            </Button>
          }
        >
            <div className="space-y-3">
              {wishlistPreviewItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <Badge
                      variant={item.priority === 'must-have' ? 'destructive' : item.priority === 'high' ? 'warning' : 'secondary'}
                      className="mt-0.5 text-[10px]">{item.priority}</Badge>
                  </div>
                  {item.targetPrice && (
                    <span className="shrink-0 text-sm font-semibold text-muted-foreground">
                      {fmtRaw(item.targetPrice, item.targetCurrency ?? 'USD')}
                    </span>
                  )}
                </div>
              ))}
              {wishlistPendingCount === 0 && (
                <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-5 text-center">
                  <p className="text-sm font-medium">Wishlist is empty</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Add upcoming targets here to track priorities and buying plans.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/wishlist')}>
                    Open Wishlist
                  </Button>
                </div>
              )}
            </div>
        </DashboardWidgetShell>
      </div>
    ),

    'recent-activity': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <DashboardWidgetShell
          title="Recent Activity"
          description="Latest actions"
          icon={Clock}
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate('/activity')}>
              View All <ArrowRight className="ml-1 size-4" />
            </Button>
          }
        >
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-5 text-center">
                  <p className="text-sm font-medium">No recent activity</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Your latest item edits, wishlist changes, and lending actions will appear here.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/collections')}>
                    Browse Collections
                  </Button>
                </div>
              ) : recentActivity.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="mt-0.5 size-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-medium">{entry.entityTitle}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{formatRelativeDate(entry.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
        </DashboardWidgetShell>
      </div>
    ),

    'quick-actions': () => (
      <div className="col-span-full">
        <Card className="overflow-hidden border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.84))] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.88))]">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
            <Button onClick={() => navigate('/items/new')}>
              <Plus className="mr-1.5 size-4" /> Add Item
            </Button>
            {canCreateCategory && (
              <Button variant="outline" onClick={() => navigate('/admin/categories/new')}>
                <FolderOpen className="mr-1.5 size-4" /> New Category
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/wishlist')}>
              <Heart className="mr-1.5 size-4" /> Wishlist
            </Button>
            <Button variant="outline" onClick={() => navigate('/lending')}>
              <Send className="mr-1.5 size-4" /> Lending
            </Button>
            <Button variant="outline" onClick={() => navigate('/export')}>
              <Download className="mr-1.5 size-4" /> Export
            </Button>
          </CardContent>
        </Card>
      </div>
    ),
  };

  return (
    <PageTransition>
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      <PageHeader
        title="Statistics"
        description="Welcome back! Here's your collection overview."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCustomizeOpen(true)}
          className="gap-1.5"
        >
          <Settings2 className="size-4" />
          Customize
        </Button>
      </PageHeader>

      {shouldShowLoadingState ? (
        <div className="space-y-6">
          <LoadingSkeleton variant="card" count={4} />
          <LoadingSkeleton variant="card" count={4} className="lg:grid-cols-2" />
        </div>
      ) : (
        <>

      {/* Library Filter */}
      {allLibraries.length > 0 && (
        <Card className="overflow-hidden border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.82))] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.93),rgba(15,23,42,0.88))]">
          <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                <Library className="size-4.5 shrink-0" />
              </span>
              <div>
                <p className="text-sm font-semibold">Library scope</p>
                <p className="text-xs text-muted-foreground">
                  Focus dashboard metrics on a single library or compare everything at once.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedLibrary('all')}
                className={cn(
                  'whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold transition-all',
                  selectedLibrary === 'all'
                    ? 'border-primary/20 bg-primary text-primary-foreground shadow-sm'
                    : 'border-border/70 bg-background/65 text-muted-foreground hover:text-foreground',
                )}
              >
                All Libraries
              </button>
              {allLibraries.map((lib) => (
                <button
                  key={lib.id}
                  onClick={() => setSelectedLibrary(lib.id)}
                  className={cn(
                    'whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold transition-all',
                    selectedLibrary === lib.id
                      ? 'border-primary/20 bg-primary text-primary-foreground shadow-sm'
                      : 'border-border/70 bg-background/65 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {lib.name}
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
          <Settings2 className="size-12 text-muted-foreground/30" />
          <div className="text-center">
            <p className="text-lg font-semibold">No widgets visible</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Click "Customize" to add widgets to your dashboard
            </p>
          </div>
          <Button variant="outline" onClick={() => setCustomizeOpen(true)}>
            <Settings2 className="mr-1.5 size-4" />
            Customize Dashboard
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
