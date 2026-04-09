import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

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
import { cn, formatRelativeDate } from '@/lib/utils';
import { useCollectionStore } from '@/store/useCollectionStore';
import { selectIsColdLoading } from '@/store/collectionStore.selectors';

const PAGE_SIZE = 20;

type EntityFilter = 'all' | 'item' | 'category' | 'wishlist' | 'system';

const ENTITY_FILTERS: { label: string; value: EntityFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Items', value: 'item' },
  { label: 'Categories', value: 'category' },
  { label: 'Wishlist', value: 'wishlist' },
  { label: 'System', value: 'system' },
];

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

function getActionLabel(action: ActivityAction): string {
  const labels: Record<ActivityAction, string> = {
    item_created: 'Added new item',
    item_updated: 'Updated item',
    item_deleted: 'Deleted item',
    item_favorited: 'Starred item',
    item_unfavorited: 'Unstarred item',
    category_created: 'Created category',
    category_updated: 'Updated category',
    category_deleted: 'Deleted category',
    item_lent: 'Lent item',
    item_returned: 'Item returned',
    maintenance_added: 'Maintenance logged',
    wishlist_added: 'Added to wishlist',
    wishlist_acquired: 'Acquired from wishlist',
    export_created: 'Exported data',
  };
  return labels[action] ?? action;
}

function getDateGroupLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return target.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getEntityRoute(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case 'item':
      return `/items/${entityId}`;
    case 'category':
      return `/collections`;
    default:
      return null;
  }
}

export default function ActivityLog() {
  const navigate = useNavigate();
  const {
    activityLog,
    getContributorById,
    clearActivityLog,
    ownerUserId,
    isRemoteDataLoading,
  } = useCollectionStore();
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
    const groups: { label: string; entries: typeof pagedLog }[] = [];
    const groupMap = new Map<string, typeof pagedLog>();

    for (const entry of pagedLog) {
      const date = new Date(entry.timestamp);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(entry);
    }

    for (const [, entries] of groupMap) {
      const label = getDateGroupLabel(new Date(entries[0].timestamp));
      groups.push({ label, entries });
    }

    return groups;
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
          title="Activity Log"
          description="Track all changes and actions in your collection"
        />

        {shouldShowLoadingState ? (
          <div className="space-y-4">
            <LoadingSkeleton variant="list" count={6} />
          </div>
        ) : (
          <>
            {/* Filter Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <Filter className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
                {ENTITY_FILTERS.map((filter) => (
                  <Button
                    key={filter.value}
                    variant={entityFilter === filter.value ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={() => handleFilterChange(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
              {entityFilter !== 'all' && (
                <Badge variant="secondary" className="shrink-0">
                  {filteredLog.length} {filteredLog.length === 1 ? 'entry' : 'entries'}
                </Badge>
              )}
              {activityLog.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmClearOpen(true)}
                >
                  <Trash className="mr-1.5 size-3.5" />
                  Clear Log
                </Button>
              )}
            </div>

            {/* Timeline */}
            {groupedByDate.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                eyebrow="Timeline"
                title="No activity yet"
                description="Actions you perform on your collection will appear here as a timeline."
                action={{ label: 'Browse Collections', onClick: () => navigate('/collections') }}
                secondaryAction={{ label: 'Go to Dashboard', onClick: () => navigate('/dashboard') }}
                hint="Creating, updating, lending, exporting, and wishlist changes all show up here once the collection becomes active."
              />
            ) : (
              <>
                <div className="space-y-10">
                  {groupedByDate.map((group) => (
                    <div key={group.label}>
                      <div className="mb-4 flex items-center gap-3">
                        <h2 className="text-sm font-semibold text-foreground">
                          {group.label}
                        </h2>
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-xs text-muted-foreground">
                          {group.entries.length} {group.entries.length === 1 ? 'action' : 'actions'}
                        </span>
                      </div>

                      <div className="relative ml-[72px]">
                        <div className="absolute bottom-0 left-3 top-3 w-px bg-border" />

                        <div className="space-y-0">
                          {group.entries.map((entry, entryIdx) => {
                            const Icon = ACTION_ICON_MAP[entry.action];
                            const dotColor = ACTION_DOT_COLOR[entry.action];
                            const badgeColor = ACTION_BADGE_VARIANT[entry.action];
                            const contributor = getContributorById(entry.userId);
                            const entityRoute = getEntityRoute(entry.entityType, entry.entityId);
                            const isLast = entryIdx === group.entries.length - 1;

                            return (
                              <div key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
                                <div className="absolute -left-[72px] top-0.5 w-[56px] text-right">
                                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                                    {formatTime(entry.timestamp)}
                                  </span>
                                </div>

                                <div className="relative z-10 mt-1.5 flex shrink-0 items-center justify-center">
                                  <div
                                    className={cn(
                                      'size-[10px] rounded-full shadow-[0_0_8px]',
                                      dotColor,
                                    )}
                                  />
                                </div>

                                {isLast && (
                                  <div className="absolute bottom-0 left-[9px] top-4 w-px bg-background" />
                                )}

                                <Card className="flex-1 transition-all duration-200 hover:shadow-md">
                                  <CardContent className="flex items-start gap-3 p-4">
                                    <div
                                      className={cn(
                                        'flex size-9 shrink-0 items-center justify-center rounded-lg border',
                                        badgeColor,
                                      )}
                                    >
                                      <Icon className="size-4" />
                                    </div>

                                    <div className="min-w-0 flex-1 space-y-1">
                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                        <span className="text-sm font-medium">
                                          {getActionLabel(entry.action)}
                                        </span>
                                        {entityRoute ? (
                                          <button
                                            className="truncate text-sm font-semibold text-primary underline-offset-2 hover:underline"
                                            onClick={() => navigate(entityRoute)}
                                          >
                                            {entry.entityTitle}
                                          </button>
                                        ) : (
                                          <span className="truncate text-sm font-semibold">
                                            {entry.entityTitle}
                                          </span>
                                        )}
                                      </div>

                                      {entry.details && (
                                        <p className="text-sm leading-relaxed text-muted-foreground">
                                          {entry.details}
                                        </p>
                                      )}

                                      <div className="flex items-center gap-2 pt-1">
                                        {contributor && (
                                          <div className="flex items-center gap-1.5">
                                            <Avatar className="size-5">
                                              <AvatarImage
                                                src={contributor.avatar}
                                                alt={contributor.name}
                                              />
                                              <AvatarFallback className="text-[10px]">
                                                {contributor.name
                                                  .split(' ')
                                                  .map((n) => n[0])
                                                  .join('')}
                                              </AvatarFallback>
                                            </Avatar>
                                            <span className="text-xs text-muted-foreground">
                                              {contributor.name}
                                            </span>
                                          </div>
                                        )}
                                        <span className="text-xs text-muted-foreground/70">
                                          ·
                                        </span>
                                        <span className="text-xs text-muted-foreground/70">
                                          {formatRelativeDate(entry.timestamp)}
                                        </span>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t pt-4">
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages} · {filteredLog.length} entries
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="size-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <ConfirmDialog
          open={confirmClearOpen}
          onClose={() => setConfirmClearOpen(false)}
          onConfirm={handleClearConfirm}
          title="Clear Activity Log"
          description="This will permanently delete all activity log entries. This action cannot be undone."
          confirmLabel="Clear All"
          destructive
        />
      </div>
    </PageTransition>
  );
}
