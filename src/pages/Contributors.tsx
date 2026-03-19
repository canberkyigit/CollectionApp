import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import {
  Users,
  Package,
  DollarSign,
  Calendar,
  Clock,
  ExternalLink,
  FolderOpen,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

import { PageHeader, StatCard } from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn, formatCurrency, formatNumber, formatDate, formatRelativeDate } from '@/lib/utils';
import { currencyService } from '@/services/currencyService';
import { useCollectionStore } from '@/store/useCollectionStore';

const COLORS = ['#7c3aed', '#10b981', '#f59e0b', '#3b82f6'];

const ROLE_STYLES: Record<string, { variant: 'default' | 'secondary' | 'outline'; className: string }> = {
  admin: { variant: 'default', className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' },
  editor: { variant: 'default', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  viewer: { variant: 'secondary', className: 'bg-muted text-muted-foreground' },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const CustomTooltip = ({ active, payload, label, displayCurrency }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {formatCurrency(entry.value, displayCurrency)}
        </p>
      ))}
    </div>
  );
};

export default function Contributors() {
  const displayCurrency = useCollectionStore((s) => s.displayCurrency);
  const { contributors, items, getCategoryById } = useCollectionStore();

  const totalItems = useMemo(
    () => contributors.reduce((sum, c) => sum + c.itemCount, 0),
    [contributors],
  );

  const totalValueUSD = useMemo(
    () => contributors.reduce((sum, c) => sum + c.totalContributionValue, 0),
    [contributors],
  );

  const totalValue = useMemo(
    () => currencyService.convert(totalValueUSD, 'USD', displayCurrency),
    [totalValueUSD, displayCurrency],
  );

  const contributorCategories = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const item of items) {
      if (!item.contributorId) continue;
      const catMap = map.get(item.contributorId) ?? new Map<string, number>();
      catMap.set(item.categoryId, (catMap.get(item.categoryId) ?? 0) + 1);
      map.set(item.contributorId, catMap);
    }

    const result = new Map<string, { name: string; count: number }[]>();
    for (const [contribId, catMap] of map) {
      const sorted = [...catMap.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([catId, count]) => {
          const cat = getCategoryById(catId);
          return { name: cat?.name ?? catId, count };
        });
      result.set(contribId, sorted);
    }
    return result;
  }, [items, getCategoryById]);

  const chartData = useMemo(
    () =>
      [...contributors]
        .sort((a, b) => b.totalContributionValue - a.totalContributionValue)
        .map((c) => ({
          name: c.name,
          value: currencyService.convert(c.totalContributionValue, 'USD', displayCurrency),
        })),
    [contributors, displayCurrency],
  );

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
      <PageHeader
        title="Contributors"
        description="People who contribute to your collection"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Contributors"
          value={formatNumber(contributors.length)}
          icon={Users}
          subtitle="active members"
        />
        <StatCard
          title="Items Contributed"
          value={formatNumber(totalItems)}
          icon={Package}
          subtitle="across all contributors"
        />
        <StatCard
          title="Total Value"
          value={formatCurrency(totalValue)}
          icon={DollarSign}
          subtitle="contribution value"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {contributors.map((contributor, index) => {
          const roleStyle = ROLE_STYLES[contributor.role] ?? ROLE_STYLES.viewer;
          const topCategories = contributorCategories.get(contributor.id) ?? [];
          const contributorValue = currencyService.convert(contributor.totalContributionValue, 'USD', displayCurrency);

          return (
            <Card
              key={contributor.id}
              className={cn(
                'group overflow-hidden transition-all duration-300',
                'hover:shadow-xl hover:shadow-primary/5',
              )}
            >
              <div
                className="h-1.5 w-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <CardHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={contributor.avatar} alt={contributor.name} />
                    <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                      {getInitials(contributor.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="text-xl font-bold tracking-tight truncate">
                      {contributor.name}
                    </h3>
                    <Badge variant={roleStyle.variant} className={roleStyle.className}>
                      {contributor.role.charAt(0).toUpperCase() + contributor.role.slice(1)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-2xl font-bold">{contributor.itemCount}</p>
                    <p className="text-xs text-muted-foreground">Items</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-lg font-bold truncate">
                      {formatCurrency(contributorValue, displayCurrency)}
                    </p>
                    <p className="text-xs text-muted-foreground">Value</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="size-3.5 shrink-0" />
                    <span>Joined {formatDate(contributor.joinedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-3.5 shrink-0" />
                    <span>Last active {formatRelativeDate(contributor.lastContributionAt)}</span>
                  </div>
                </div>

                {topCategories.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Top Categories
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {topCategories.map((cat) => (
                          <Badge
                            key={cat.name}
                            variant="outline"
                            className="text-xs"
                          >
                            <FolderOpen className="mr-1 size-3" />
                            {cat.name} ({cat.count})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Button variant="outline" className="w-full" asChild>
                  <Link to={`/collections?contributor=${contributor.id}`}>
                    View Items
                    <ExternalLink className="ml-1.5 size-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold tracking-tight">
            Contribution Breakdown
          </h3>
          <p className="text-sm text-muted-foreground">
            Total contribution value by contributor
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" tickFormatter={(v) => formatCurrency(v, displayCurrency)} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip content={<CustomTooltip displayCurrency={displayCurrency} />} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={32}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
    </PageTransition>
  );
}
