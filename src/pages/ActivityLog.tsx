import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import type { ActivityAction } from '@/types';
import {
  Plus,
  Pencil,
  Trash2,
  Star,
  StarOff,
  FolderPlus,
  Settings,
  FolderX,
  Send,
  ArrowDownLeft,
  Wrench,
  Heart,
  ShoppingCart,
  Download,
  ClipboardList,
  Filter,
  Trash,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { PageHeader, EmptyState, LoadingSkeleton } from '@/components/shared';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PageTransition } from '@/components/shared/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getLocale, useT } from '@/i18n';
import { cn, formatNumber } from '@/lib/utils';
import { useCollectionStore } from '@/store/useCollectionStore';
import { selectIsColdLoading } from '@/store/collectionStore.selectors';
import { RelativeTime } from '@/components/shared/RelativeTime';

const PAGE_SIZE = 20;

type EntityFilter = 'all' | 'item' | 'category' | 'wishlist' | 'system';

const ENTITY_FILTERS: EntityFilter[] = ['all', 'item', 'category', 'wishlist', 'system'];

const ACTION_ICON_MAP: Record<ActivityAction, LucideIcon> = {
  item_created: Plus,
  item_updated: Pencil,
  item_deleted: Trash2,
  item_favorited: Star,
  item_unfavorited: StarOff,
  category_created: FolderPlus,
  category_updated: Settings,
  category_deleted: FolderX,
  item_lent: Send,
  item_returned: ArrowDownLeft,
  maintenance_added: Wrench,
  wishlist_added: Heart,
  wishlist_acquired: ShoppingCart,
  export_created: Download,
};

const ACTION_DOT_COLOR: Record<ActivityAction, string> = {
  item_created: 'bg-green-500 shadow-green-500/40',
  item_updated: 'bg-blue-500 shadow-blue-500/40',
  item_deleted: 'bg-red-500 shadow-red-500/40',
  item_favorited: 'bg-amber-500 shadow-amber-500/40',
  item_unfavorited: 'bg-amber-400 shadow-amber-400/40',
  category_created: 'bg-green-500 shadow-green-500/40',
  category_updated: 'bg-blue-500 shadow-blue-500/40',
  category_deleted: 'bg-red-500 shadow-red-500/40',
  item_lent: 'bg-orange-500 shadow-orange-500/40',
  item_returned: 'bg-teal-500 shadow-teal-500/40',
  maintenance_added: 'bg-purple-500 shadow-purple-500/40',
  wishlist_added: 'bg-pink-500 shadow-pink-500/40',
  wishlist_acquired: 'bg-pink-500 shadow-pink-500/40',
  export_created: 'bg-gray-500 shadow-gray-500/40',
};

const ACTION_BADGE_VARIANT: Record<ActivityAction, string> = {
  item_created: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
  item_updated: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  item_deleted: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400',
  item_favorited: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  item_unfavorited: 'border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-400',
  category_created: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
  category_updated: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  category_deleted: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400',
  item_lent: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400',
  item_returned: 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-400',
  maintenance_added: 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400',
  wishlist_added: 'border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-400',
  wishlist_acquired: 'border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-400',
  export_created: 'border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-400',
};

const FALLBACK_DOT_COLOR = 'bg-gray-500 shadow-gray-500/40';
const FALLBACK_BADGE_COLOR = 'border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-400';

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function getDateGroupLabel(date: Date, t: (key: string) => string): string {
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return t('common.today');
  if (diffDays === 1) return t('common.yesterday');
  return date.toLocaleDateString(getLocale(), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString(getLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEntityRoute(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case 'item':
      return `/items/${entityId}`;
    case 'category':
      return '/collections';
    default:
      return null;
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase(getLocale())
    .slice(0, 2);
}

export default function ActivityLog() {
  const t = useT();
  const navigate = useNavigate();
  const activityLog = useCollectionStore((s) => s.activityLog);
  const getContributorById = useCollectionStore((s) => s.getContributorById);
  const clearActivityLog = useCollectionStore((s) => s.clearActivityLog);
  const ownerUserId = useCollectionStore((s) => s.ownerUserId);
  const isRemoteDataLoading = useCollectionStore((s) => s.isRemoteDataLoading);
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const shouldShowLoadingState = selectIsColdLoading(
    { ownerUserId, isRemoteDataLoading },
    [activityLog.length],
  );

  const filteredLog = useMemo(() => {
    if (entityFilter === 'all') return activityLog;
    return activityLog.filter((entry) => entry.entityType === entityFilter);
  }, [activityLog, entityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLog.length / PAGE_SIZE));

  const pagedLog = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLog.slice(start, start + PAGE_SIZE);
  }, [filteredLog, currentPage]);

  const groupedByDate = useMemo(() => {
    const groupMap = new Map<string, typeof pagedLog>();

    for (const entry of pagedLog) {
      const date = new Date(entry.timestamp);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const bucket = groupMap.get(key) ?? [];
      bucket.push(entry);
      groupMap.set(key, bucket);
    }

    return [...groupMap.entries()].map(([key, entries]) => ({
      key,
      date: new Date(entries[0].timestamp),
      entries,
    }));
  }, [pagedLog]);

  function handleFilterChange(filter: EntityFilter) {
    setEntityFilter(filter);
    setCurrentPage(1);
  }

  function handleClearConfirm() {
    clearActivityLog();
    setConfirmClearOpen(false);
    setCurrentPage(1);
  }

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title={t('activity.title')}
          description={t('activity.descriptionLong')}
        />

        {shouldShowLoadingState ? (
          <div className="space-y-4">
            <LoadingSkeleton variant="list" count={6} />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 pb-1">
              <Filter className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div
                className="flex min-w-0 max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border p-0.5"
                role="group"
                aria-label={t('activity.filterLabel')}
              >
                {ENTITY_FILTERS.map((filter) => (
                  <Button
                    key={filter}
                    variant={entityFilter === filter ? 'default' : 'ghost'}
                    size="sm"
                    className="h-9 shrink-0 px-3 text-xs sm:h-7"
                    aria-pressed={entityFilter === filter}
                    onClick={() => handleFilterChange(filter)}
                  >
                    {t(`activity.filter.${filter}`)}
                  </Button>
                ))}
              </div>
              {entityFilter !== 'all' && (
                <Badge variant="secondary" className="shrink-0">
                  {t('activity.entryCount', { count: filteredLog.length, formatted: formatNumber(filteredLog.length) })}
                </Badge>
              )}
              {activityLog.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 sm:h-8 ml-auto shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmClearOpen(true)}
                >
                  <Trash className="mr-1.5 size-3.5" />
                  {t('activity.clear')}
                </Button>
              )}
            </div>

            {groupedByDate.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                eyebrow={t('activity.eyebrow')}
                title={t('activity.emptyTitle')}
                description={t('activity.emptyDescriptionLong')}
                action={{ label: t('activity.browse'), onClick: () => navigate('/collections') }}
                secondaryAction={{ label: t('activity.goToDashboard'), onClick: () => navigate('/dashboard') }}
                hint={t('activity.emptyHint')}
              />
            ) : (
              <>
                <div className="space-y-10">
                  {groupedByDate.map((group) => (
                    <section key={group.key} aria-labelledby={`activity-group-${group.key}`}>
                      <div className="mb-4 flex items-center gap-3">
                        <h2 id={`activity-group-${group.key}`} className="text-sm font-semibold text-foreground">
                          {getDateGroupLabel(group.date, t)}
                        </h2>
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-xs text-muted-foreground">
                          {t('activity.actionCount', { count: group.entries.length, formatted: formatNumber(group.entries.length) })}
                        </span>
                      </div>

                      <div className="relative ml-[72px]">
                        <div className="absolute bottom-0 left-3 top-3 w-px bg-border" aria-hidden="true" />

                        <ol className="space-y-0">
                          {group.entries.map((entry, entryIdx) => {
                            const Icon = ACTION_ICON_MAP[entry.action] ?? ClipboardList;
                            const dotColor = ACTION_DOT_COLOR[entry.action] ?? FALLBACK_DOT_COLOR;
                            const badgeColor = ACTION_BADGE_VARIANT[entry.action] ?? FALLBACK_BADGE_COLOR;
                            const contributor = getContributorById(entry.userId);
                            const entityRoute = getEntityRoute(entry.entityType, entry.entityId);
                            const isLast = entryIdx === group.entries.length - 1;

                            return (
                              <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
                                <div className="absolute -left-[72px] top-0.5 w-[56px] text-right">
                                  <time dateTime={entry.timestamp} className="text-xs font-medium tabular-nums text-muted-foreground">
                                    {formatTime(entry.timestamp)}
                                  </time>
                                </div>

                                <div className="relative z-10 mt-1.5 flex shrink-0 items-center justify-center" aria-hidden="true">
                                  <div className={cn('size-[10px] rounded-full shadow-[0_0_8px]', dotColor)} />
                                </div>

                                {isLast && (
                                  <div className="absolute bottom-0 left-[9px] top-4 w-px bg-background" aria-hidden="true" />
                                )}

                                <Card className="min-w-0 flex-1 transition-all duration-200 hover:shadow-md">
                                  <CardContent className="flex items-start gap-3 p-4">
                                    <div
                                      className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg border', badgeColor)}
                                      aria-hidden="true"
                                    >
                                      <Icon className="size-4" />
                                    </div>

                                    <div className="min-w-0 flex-1 space-y-1">
                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                        <span className="text-sm font-medium">
                                          {t(`activity.action.${entry.action}`)}
                                        </span>
                                        {entityRoute ? (
                                          <Link
                                            to={entityRoute}
                                            className="truncate text-sm font-semibold text-primary underline-offset-2 hover:underline"
                                          >
                                            {entry.entityTitle}
                                          </Link>
                                        ) : (
                                          <span className="truncate text-sm font-semibold">{entry.entityTitle}</span>
                                        )}
                                      </div>

                                      {entry.details && (
                                        <p className="text-sm leading-relaxed text-muted-foreground">{entry.details}</p>
                                      )}

                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1">
                                        {contributor && (
                                          <>
                                            <div className="flex items-center gap-1.5">
                                              <Avatar className="size-5">
                                                <AvatarImage src={contributor.avatar} alt="" />
                                                <AvatarFallback className="text-[10px]">{getInitials(contributor.name)}</AvatarFallback>
                                              </Avatar>
                                              <span className="text-xs text-muted-foreground">{contributor.name}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground/70" aria-hidden="true">·</span>
                                          </>
                                        )}
                                        <span className="text-xs text-muted-foreground/70">
                                          <RelativeTime date={entry.timestamp} />
                                        </span>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    </section>
                  ))}
                </div>

                {totalPages > 1 && (
                  <nav className="flex items-center justify-between border-t pt-4" aria-label={t('activity.pagination')}>
                    <span className="text-sm text-muted-foreground">
                      {t('activity.pageOf', {
                        page: formatNumber(currentPage),
                        total: formatNumber(totalPages),
                        entries: formatNumber(filteredLog.length),
                      })}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 sm:h-8"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="size-4" />
                        {t('activity.previous')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 sm:h-8"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        {t('activity.next')}
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </nav>
                )}
              </>
            )}
          </>
        )}

        <ConfirmDialog
          open={confirmClearOpen}
          onClose={() => setConfirmClearOpen(false)}
          onConfirm={handleClearConfirm}
          title={t('activity.clearTitle')}
          description={t('activity.clearDescription')}
          confirmLabel={t('activity.clearConfirm')}
          destructive
        />
      </div>
    </PageTransition>
  );
}
