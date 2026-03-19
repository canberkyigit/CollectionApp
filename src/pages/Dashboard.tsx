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

import { PageTransition, MotionGrid, MotionItem, staggerContainer, staggerItem } from '@/components/shared/motion';
import type { DashboardWidgetId, DashboardWidgetConfig } from '@/types';
import { useCollectionStore } from '@/store/useCollectionStore';
import { CustomizeDashboard } from '@/components/dashboard/CustomizeDashboard';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatCurrency, formatNumber, formatRelativeDate, cn } from '@/lib/utils';
import { currencyService } from '@/services/currencyService';

const PIE_COLORS = [
  '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#ec4899', '#06b6d4', '#8b5cf6', '#f97316',
];

function useDisplayCurrency() {
  const dc = useCollectionStore((s) => s.displayCurrency);
  const sym = currencyService.getCurrencySymbol(dc);
  const fmt = (usdValue: number) => formatCurrency(currencyService.convert(usdValue, 'USD', dc), dc);
  const fmtRaw = (value: number, fromCurrency: string) =>
    formatCurrency(currencyService.convert(value, fromCurrency, dc), dc);
  const tickFmt = (v: number) => `${sym}${(currencyService.convert(v, 'USD', dc) / 1000).toFixed(0)}k`;
  return { dc, sym, fmt, fmtRaw, tickFmt };
}

const CustomTooltipInner = ({ active, payload, label, fmt }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? fmt(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
};

const RADIAN = Math.PI / 180;
const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
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

export default function Dashboard() {
  const navigate = useNavigate();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [selectedLibrary, setSelectedLibrary] = useState<string>('all');
  const { fmt, fmtRaw, tickFmt, dc, sym } = useDisplayCurrency();

  const {
    items,
    categories,
    libraries,
    contributors,
    wishlist,
    activityLog,
    dashboardWidgets,
    getTotalValue,
    getCategoryStats,
    getRecentItems,
    getFavoriteItems,
    getValueOverTime,
    getMonthlyAcquisitions,
    getCategoryById,
    getLibrariesByCategory,
  } = useCollectionStore();

  const filteredItems = useMemo(() => {
    const active = items.filter((i) => !i.isArchived);
    if (selectedLibrary === 'all') return active;
    return active.filter((i) => i.libraryId === selectedLibrary);
  }, [items, selectedLibrary]);

  const allLibraries = useMemo(() => libraries, [libraries]);

  const totalValue = useMemo(() => {
    return filteredItems.reduce(
      (sum, item) => sum + currencyService.convertToUSD(item.valuationInfo.currentEstimatedValue, item.valuationInfo.currentValueCurrency),
      0,
    );
  }, [filteredItems]);
  const CustomTooltip = useMemo(() => {
    const Comp = (props: any) => <CustomTooltipInner {...props} fmt={fmt} />;
    return Comp;
  }, [fmt]);
  const categoryStats = useMemo(() => getCategoryStats(), [items, categories]);
  const recentItems = useMemo(() => getRecentItems(6), [items]);
  const favoriteItems = useMemo(() => getFavoriteItems(), [items]);
  const valueOverTime = useMemo(() => getValueOverTime(), [items]);
  const monthlyAcquisitions = useMemo(() => getMonthlyAcquisitions(), [items]);

  const contributorList = useMemo(
    () => [...contributors].sort((a, b) => b.totalContributionValue - a.totalContributionValue).slice(0, 5),
    [contributors],
  );

  const visibleWidgets = useMemo(
    () => [...dashboardWidgets].filter((w) => w.visible).sort((a, b) => a.order - b.order),
    [dashboardWidgets],
  );

  const totalPurchasePrice = useMemo(() => {
    return filteredItems.reduce(
      (sum, item) => sum + currencyService.convertToUSD(item.purchaseInfo.purchasePrice, item.purchaseInfo.purchaseCurrency),
      0,
    );
  }, [filteredItems]);

  const itemsWithPurchase = useMemo(
    () => filteredItems.filter((i) => i.purchaseInfo.purchasePrice > 0),
    [filteredItems],
  );

  const valueTrend = useMemo(() => {
    if (totalPurchasePrice === 0) return null;
    return ((totalValue - totalPurchasePrice) / totalPurchasePrice) * 100;
  }, [totalValue, totalPurchasePrice]);


  const widgetRenderers: Record<DashboardWidgetId, (w: DashboardWidgetConfig) => ReactNode> = {
    'stats': () => (
      <div className="col-span-full space-y-3 sm:space-y-4">
        <MotionGrid className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" variants={staggerContainer} initial="hidden" animate="visible">
          <MotionItem variants={staggerItem}><StatCard title="Estimated Value" value={fmt(totalValue)} icon={DollarSign}
            trend={valueTrend !== null ? { value: Math.abs(valueTrend), isPositive: valueTrend >= 0 } : undefined}
            subtitle={`vs ${fmt(totalPurchasePrice)} paid`} /></MotionItem>
          <MotionItem variants={staggerItem}><StatCard title="Total Items" value={formatNumber(filteredItems.length)} icon={Package}
            subtitle={selectedLibrary === 'all' ? 'across all categories' : 'in selected library'} /></MotionItem>
          <MotionItem variants={staggerItem}><StatCard title="Categories" value={formatNumber(categories.length)} icon={FolderOpen}
            subtitle="active collections" /></MotionItem>
          <MotionItem variants={staggerItem}><StatCard title="Contributors" value={formatNumber(contributors.length)} icon={Users}
            subtitle="team members" /></MotionItem>
        </MotionGrid>
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="text-lg font-bold">
              Estimated Value: {fmt(totalValue)}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                across {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className="text-sm">
              <span className="font-medium">Purchase Price:</span>{' '}
              {fmt(totalPurchasePrice)}
              <span className="text-muted-foreground ml-1">({itemsWithPurchase.length} items with price)</span>
            </p>
          </CardContent>
        </Card>
      </div>
    ),

    'value-over-time': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" />
              Value Over Time
            </CardTitle>
            <CardDescription>Portfolio valuation trend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={valueOverTime}>
                  <defs>
                    <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(265, 80%, 60%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(265, 80%, 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false}
                    tickFormatter={tickFmt} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="value" name="Value" stroke="hsl(265, 80%, 60%)"
                    strokeWidth={2.5} fill="url(#valueGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    ),

    'category-distribution': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-primary" />
              Category Distribution
            </CardTitle>
            <CardDescription>Items per category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryStats} cx="50%" cy="45%" innerRadius={60} outerRadius={100}
                    dataKey="count" nameKey="name" label={renderPieLabel} labelLine={false}
                    strokeWidth={2} stroke="hsl(0 0% 10%)">
                    {categoryStats.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
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
          </CardContent>
        </Card>
      </div>
    ),

    'value-by-category': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Value by Category</CardTitle>
            <CardDescription>Total estimated value per category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryStats} layout="vertical">
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#7c3aed" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(0 0% 60%)' }} axisLine={false}
                    tickLine={false} tickFormatter={tickFmt} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'hsl(0 0% 60%)' }}
                    axisLine={false} tickLine={false} width={100} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="totalValue" name="Value" fill="url(#barGradient)" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    ),

    'acquisition-timeline': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Acquisition Timeline</CardTitle>
            <CardDescription>Monthly items acquired and spend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyAcquisitions}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: 'hsl(0 0% 60%)' }}
                    axisLine={false} tickLine={false} tickFormatter={tickFmt} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar yAxisId="left" dataKey="count" name="Items" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar yAxisId="right" dataKey="value" name="Spend" fill="#7c3aed" radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    ),

    'recent-items': (w) => (
      <div className={cn(sizeToColSpan(w.size), w.size === 'half' && 'col-span-2 lg:col-span-4')}>
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recently Added</CardTitle>
              <CardDescription>Latest additions to your collection</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/collections')}>
              View All <ArrowRight className="ml-1 size-4" />
            </Button>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    ),

    'contributors': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Top Contributors</CardTitle>
            <CardDescription>Most active team members</CardDescription>
          </CardHeader>
          <CardContent>
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
                      {contributor.itemCount} items &middot; {fmt(contributor.totalContributionValue)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    ),

    'starred-items': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Star className="size-4 text-amber-500" />
                Starred Items
              </CardTitle>
              <CardDescription>{favoriteItems.length} favorites</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/favorites')}>
              View All <ArrowRight className="ml-1 size-4" />
            </Button>
          </CardHeader>
          <CardContent>
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
                <p className="py-4 text-center text-sm text-muted-foreground">No starred items yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    ),

    'wishlist': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Heart className="size-4 text-pink-500" />
                Wishlist
              </CardTitle>
              <CardDescription>{wishlist.filter((i) => !i.isAcquired).length} items wanted</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/wishlist')}>
              View All <ArrowRight className="ml-1 size-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {wishlist.filter((i) => !i.isAcquired).slice(0, 4).map((item) => (
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
              {wishlist.filter((i) => !i.isAcquired).length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">Wishlist is empty</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    ),

    'recent-activity': (w) => (
      <div className={sizeToColSpan(w.size)}>
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest actions</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/activity')}>
              View All <ArrowRight className="ml-1 size-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activityLog.slice(0, 5).map((entry) => (
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
          </CardContent>
        </Card>
      </div>
    ),

    'quick-actions': () => (
      <div className="col-span-full">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Button onClick={() => navigate('/items/new')}>
              <Plus className="mr-1.5 size-4" /> Add Item
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/categories/new')}>
              <FolderOpen className="mr-1.5 size-4" /> New Category
            </Button>
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

      {/* Library Filter */}
      {allLibraries.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto">
          <Library className="size-4 text-muted-foreground shrink-0" />
          <button
            onClick={() => setSelectedLibrary('all')}
            className={cn(
              'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              selectedLibrary === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            All Libraries
          </button>
          {allLibraries.map((lib) => (
            <button
              key={lib.id}
              onClick={() => setSelectedLibrary(lib.id)}
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                selectedLibrary === lib.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {lib.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6 lg:gap-6">
        {visibleWidgets.map((widget) => {
          const render = widgetRenderers[widget.id];
          if (!render) return null;
          return <React.Fragment key={widget.id}>{render(widget)}</React.Fragment>;
        })}
      </div>

      {visibleWidgets.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-20">
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
    </div>
    </PageTransition>
  );
}
