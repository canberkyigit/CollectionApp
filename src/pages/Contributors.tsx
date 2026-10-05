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

import { PageHeader, LoadingSkeleton, StatCard } from '@/components/shared';
import { PageTransition, MotionGrid, MotionItem } from '@/components/shared/motion';
import { staggerContainer, staggerItem } from '@/components/shared/motion-variants';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getLocale, useT } from '@/i18n';
import { buildContributorSummaries } from '@/lib/contributors';
import { cn, formatCurrency, formatNumber, formatDate, formatRelativeDate } from '@/lib/utils';
import { currencyService } from '@/services/currencyService';
import { useCollectionStore } from '@/store/useCollectionStore';
import { selectIsColdLoading } from '@/store/collectionStore.selectors';

const COLORS = ['#7c3aed', '#10b981', '#f59e0b', '#3b82f6'];

const ROLE_STYLES: Record<string, { variant: 'default' | 'secondary' | 'outline'; className: string }> = {
  admin: { variant: 'default', className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' },
  editor: { variant: 'default', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  viewer: { variant: 'secondary', className: 'bg-muted text-muted-foreground' },
};

interface ContributorTooltipEntry {
  color?: string;
  value?: number;
}

interface ContributorTooltipProps {
  active?: boolean;
  payload?: ContributorTooltipEntry[];
  label?: string;
  displayCurrency: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toLocaleUpperCase(getLocale())
    .slice(0, 2);
}

const ContributionTooltip = ({ active, payload, label, displayCurrency }: ContributorTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm font-semibold tabular-nums" style={{ color: entry.color }}>
          {formatCurrency(entry.value ?? 0, displayCurrency)}
        </p>
      ))}
    </div>
  );
};

export default function Contributors() {
  const t = useT();
  const displayCurrency = useCollectionStore((s) => s.displayCurrency);
  const contributors = useCollectionStore((s) => s.contributors);
  const items = useCollectionStore((s) => s.items);
  const getCategoryById = useCollectionStore((s) => s.getCategoryById);
  const ownerUserId = useCollectionStore((s) => s.ownerUserId);
  const isRemoteDataLoading = useCollectionStore((s) => s.isRemoteDataLoading);
  const shouldShowLoadingState = selectIsColdLoading(
    { ownerUserId, isRemoteDataLoading },
    [contributors.length, items.length],
  );
  const contributorSummaries = useMemo(
    () => buildContributorSummaries(contributors, items),
    [contributors, items],
  );
  const visibleContributors = useMemo(
    () => contributorSummaries.filter((contributor) => contributor.derivedItemCount > 0 || contributor.itemCount > 0),
    [contributorSummaries],
  );
  const contributorsToRender = visibleContributors.length > 0 ? visibleContributors : contributorSummaries;

  const totalItems = useMemo(
    () => contributorsToRender.reduce((sum, contributor) => sum + contributor.derivedItemCount, 0),
    [contributorsToRender],
  );

  const totalValue = useMemo(
    () => currencyService.convert(
      contributorsToRender.reduce((sum, contributor) => sum + contributor.derivedTotalContributionValue, 0),
      'USD',
      displayCurrency,
    ),
    [contributorsToRender, displayCurrency],
  );

  const contributorCategories = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const item of items) {
      if (!item.contributorId || item.isArchived) continue;
      const catMap = map.get(item.contributorId) ?? new Map<string, number>();
      catMap.set(item.categoryId, (catMap.get(item.categoryId) ?? 0) + 1);
      map.set(item.contributorId, catMap);
    }

    const result = new Map<string, { name: string; count: number }[]>();
    for (const [contribId, catMap] of map) {
      const sorted = [...catMap.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([catId, count]) => ({ name: getCategoryById(catId)?.name ?? catId, count }));
      result.set(contribId, sorted);
    }
    return result;
  }, [items, getCategoryById]);

  const chartData = useMemo(
    () =>
      [...contributorsToRender]
        .sort((a, b) => b.derivedTotalContributionValue - a.derivedTotalContributionValue)
        .map((c) => ({
          name: c.name,
          value: currencyService.convert(c.derivedTotalContributionValue, 'USD', displayCurrency),
        })),
    [contributorsToRender, displayCurrency],
  );

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title={t('contributors.title')}
          description={t('contributors.descriptionLong')}
        />

        {shouldShowLoadingState ? (
          <div className="space-y-4">
            <LoadingSkeleton variant="list" count={3} />
            <LoadingSkeleton variant="card" count={4} />
          </div>
        ) : (
          <>
            <MotionGrid
              className="grid grid-cols-1 gap-4 sm:grid-cols-3"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <MotionItem className="h-full" variants={staggerItem}>
                <StatCard
                  title={t('contributors.stats.total')}
                  value={formatNumber(contributorsToRender.length)}
                  icon={Users}
                  subtitle={t('contributors.stats.totalHint')}
                />
              </MotionItem>
              <MotionItem className="h-full" variants={staggerItem}>
                <StatCard
                  title={t('contributors.stats.items')}
                  value={formatNumber(totalItems)}
                  icon={Package}
                  subtitle={t('contributors.stats.itemsHint')}
                />
              </MotionItem>
              <MotionItem className="h-full" variants={staggerItem}>
                <StatCard
                  title={t('contributors.stats.totalValue')}
                  value={formatCurrency(totalValue, displayCurrency)}
                  icon={DollarSign}
                  subtitle={t('contributors.stats.valueHint')}
                />
              </MotionItem>
            </MotionGrid>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {contributorsToRender.map((contributor, index) => {
                const topCategories = contributorCategories.get(contributor.id) ?? [];
                const contributorValue = currencyService.convert(
                  contributor.derivedTotalContributionValue,
                  'USD',
                  displayCurrency,
                );
                const roleKey = ['admin', 'editor', 'viewer'].includes(contributor.role) ? contributor.role : 'viewer';
                const roleStyle = ROLE_STYLES[roleKey];

                return (
                  <Card
                    key={contributor.id}
                    className={cn(
                      'group flex flex-col overflow-hidden transition-all duration-300',
                      'hover:shadow-xl hover:shadow-primary/5',
                    )}
                  >
                    <div
                      className="h-1.5 w-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <CardHeader className="pb-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="size-16">
                          <AvatarImage src={contributor.avatar} alt="" />
                          <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                            {getInitials(contributor.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 space-y-1">
                          <h3 className="truncate text-xl font-bold tracking-tight">{contributor.name}</h3>
                          <Badge variant={roleStyle.variant} className={roleStyle.className}>
                            {t(`contributors.role.${roleKey}`)}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="flex flex-1 flex-col space-y-4 pt-0">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-muted/50 p-3 text-center">
                          <p className="text-2xl font-bold tabular-nums">{formatNumber(contributor.derivedItemCount)}</p>
                          <p className="text-xs text-muted-foreground">{t('contributors.card.items')}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3 text-center">
                          <p className="truncate text-lg font-bold tabular-nums">
                            {formatCurrency(contributorValue, displayCurrency)}
                          </p>
                          <p className="text-xs text-muted-foreground">{t('contributors.card.value')}</p>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="size-3.5 shrink-0" aria-hidden="true" />
                          <span>{t('contributors.card.joinedOn', { date: formatDate(contributor.joinedAt) })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                          <span>{t('contributors.card.lastActiveAt', { when: formatRelativeDate(contributor.derivedLastContributionAt) })}</span>
                        </div>
                      </div>

                      {topCategories.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              {t('contributors.card.topCategories')}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {topCategories.map((cat) => (
                                <Badge key={cat.name} variant="outline" className="text-xs">
                                  <FolderOpen className="mr-1 size-3" aria-hidden="true" />
                                  {cat.name} ({formatNumber(cat.count)})
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      <Button variant="outline" className="mt-auto w-full" asChild>
                        <Link to={`/collections?contributor=${contributor.id}`}>
                          {t('contributors.card.viewItems')}
                          <ExternalLink className="ml-1.5 size-3.5" aria-hidden="true" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold tracking-tight">{t('contributors.chart.breakdownTitle')}</h3>
                <p className="text-sm text-muted-foreground">{t('contributors.chart.breakdownDescription')}</p>
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
                      <XAxis
                        type="number"
                        className="text-xs"
                        tick={{ fill: 'var(--color-muted-foreground)' }}
                        tickFormatter={(v) => formatCurrency(v, displayCurrency)}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        className="text-xs"
                        tick={{ fill: 'var(--color-muted-foreground)' }}
                      />
                      <Tooltip content={<ContributionTooltip displayCurrency={displayCurrency} />} />
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
          </>
        )}
      </div>
    </PageTransition>
  );
}
