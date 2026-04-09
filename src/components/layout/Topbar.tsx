import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  Sun,
  Moon,
  Bell,
  Settings,
  LogOut,
  User,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Star,
  StarOff,
  FolderPlus,
  FolderPen,
  FolderX,
  Send,
  Undo2,
  Heart,
  Wrench,
  Download,
  CheckCircle2,
  Clock,
  X,
  RefreshCw,
  WifiOff,
  AlertCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCollectionStore } from '@/store/useCollectionStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useSyncStore } from '@/store/useSyncStore';
import { collectionSyncService } from '@/services/collectionSyncService';
import type { ActivityAction } from '@/types';

const actionMeta: Record<ActivityAction, { icon: LucideIcon; color: string; label: string }> = {
  item_created:      { icon: Plus, color: 'text-emerald-500 bg-emerald-500/10', label: 'New item added' },
  item_updated:      { icon: Pencil, color: 'text-blue-500 bg-blue-500/10', label: 'Item updated' },
  item_deleted:      { icon: Trash2, color: 'text-red-500 bg-red-500/10', label: 'Item deleted' },
  item_favorited:    { icon: Star, color: 'text-amber-500 bg-amber-500/10', label: 'Item starred' },
  item_unfavorited:  { icon: StarOff, color: 'text-gray-400 bg-gray-400/10', label: 'Item unstarred' },
  category_created:  { icon: FolderPlus, color: 'text-violet-500 bg-violet-500/10', label: 'Category created' },
  category_updated:  { icon: FolderPen, color: 'text-indigo-500 bg-indigo-500/10', label: 'Category updated' },
  category_deleted:  { icon: FolderX, color: 'text-red-500 bg-red-500/10', label: 'Category deleted' },
  item_lent:         { icon: Send, color: 'text-orange-500 bg-orange-500/10', label: 'Item lent out' },
  item_returned:     { icon: Undo2, color: 'text-teal-500 bg-teal-500/10', label: 'Item returned' },
  wishlist_added:    { icon: Heart, color: 'text-pink-500 bg-pink-500/10', label: 'Wishlist item added' },
  wishlist_acquired: { icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-500/10', label: 'Wishlist item acquired' },
  maintenance_added: { icon: Wrench, color: 'text-cyan-500 bg-cyan-500/10', label: 'Maintenance logged' },
  export_created:    { icon: Download, color: 'text-green-500 bg-green-500/10', label: 'Data exported' },
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatSyncTimestamp(timestamp: string | null): string {
  if (!timestamp) return 'No successful sync yet';

  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SearchDropdown({
  query,
  onClose,
}: {
  query: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const items = useCollectionStore((s) => s.items);
  const categories = useCollectionStore((s) => s.categories);
  const getCategoryById = useCollectionStore((s) => s.getCategoryById);
  const setSearchQuery = useCollectionStore((s) => s.setSearchQuery);

  const q = query.toLowerCase().trim();

  const matchedItems = useMemo(() => {
    if (q.length < 2) return [];
    return items
      .filter((i) => !i.isArchived)
      .filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [items, q]);

  const matchedCategories = useMemo(() => {
    if (q.length < 2) return [];
    return categories
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q),
      )
      .slice(0, 3);
  }, [categories, q]);

  if (matchedItems.length === 0 && matchedCategories.length === 0) return null;

  function go(path: string) {
    navigate(path);
    setSearchQuery('');
    onClose();
  }

  return (
    <div className="surface-3 absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl border">
      {matchedItems.length > 0 && (
        <>
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Items
          </div>
          {matchedItems.map((item) => {
            const cat = getCategoryById(item.categoryId);
            return (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(`/items/${item.id}`)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
              >
                <Search className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  {cat && <p className="text-xs text-muted-foreground">{cat.name}</p>}
                </div>
                {item.condition && (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {item.condition}
                  </Badge>
                )}
              </button>
            );
          })}
        </>
      )}

      {matchedCategories.length > 0 && (
        <>
          {matchedItems.length > 0 && <Separator />}
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Categories
          </div>
          {matchedCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(`/collections/${cat.slug}`)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
            >
              <span className="text-base leading-none">{cat.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{cat.name}</p>
                {cat.description && (
                  <p className="truncate text-xs text-muted-foreground">{cat.description}</p>
                )}
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

const Topbar = () => {
  const toggleSidebar = useCollectionStore((s) => s.toggleSidebar);
  const theme = useCollectionStore((s) => s.theme);
  const toggleTheme = useCollectionStore((s) => s.toggleTheme);
  const searchQuery = useCollectionStore((s) => s.searchQuery);
  const setSearchQuery = useCollectionStore((s) => s.setSearchQuery);
  const activityLog = useCollectionStore((s) => s.activityLog);
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const syncStatus = useSyncStore((s) => s.status);
  const pendingSyncCount = useSyncStore((s) => s.pendingCount);
  const queuedSyncCount = useSyncStore((s) => s.queuedCount);
  const runningSyncCount = useSyncStore((s) => s.runningCount);
  const failedSyncCount = useSyncStore((s) => s.failedCount);
  const lastSyncError = useSyncStore((s) => s.lastError);
  const lastSuccessfulSyncAt = useSyncStore((s) => s.lastSuccessfulSyncAt);
  const lastFailureAt = useSyncStore((s) => s.lastFailureAt);
  const syncMutations = useSyncStore((s) => s.mutations);

  const userName = authUser?.displayName || 'User';
  const userEmail = authUser?.email || '';
  const userInitials = userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const readNotificationIds = useCollectionStore((s) => s.readNotificationIds);
  const markNotificationRead = useCollectionStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useCollectionStore((s) => s.markAllNotificationsRead);

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileSearchFocused, setMobileSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const readSet = useMemo(() => new Set(readNotificationIds), [readNotificationIds]);

  const notifications = useMemo(
    () => [...activityLog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 20),
    [activityLog],
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readSet.has(n.id)).length,
    [notifications, readSet],
  );

  const showDesktopDropdown = searchFocused && searchQuery.length >= 2;
  const showMobileDropdown = mobileSearchFocused && searchQuery.length >= 2;
  const failedMutation = useMemo(
    () => syncMutations.find((mutation) => mutation.status === 'failed'),
    [syncMutations],
  );
  const syncMeta = useMemo(() => {
    if (syncStatus === 'offline') {
      const hasQueuedOfflineWork = pendingSyncCount > 0;
      return {
        icon: WifiOff,
        iconClassName: 'text-amber-500',
        label: hasQueuedOfflineWork ? `${pendingSyncCount} Offline` : 'Offline',
        pillClassName: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
        description: hasQueuedOfflineWork
          ? `${pendingSyncCount} queued change${pendingSyncCount > 1 ? 's are' : ' is'} waiting for connectivity.`
          : 'Changes stay local until the connection returns.',
        action: hasQueuedOfflineWork
          ? `Last healthy sync: ${formatSyncTimestamp(lastSuccessfulSyncAt)}.`
          : 'Connection restores automatically and pending changes will retry.',
      };
    }

    if (failedSyncCount > 0 || syncStatus === 'error') {
      const issueCount = failedSyncCount || 1;
      return {
        icon: AlertCircle,
        iconClassName: 'text-destructive',
        label: issueCount > 1 ? `${issueCount} Sync Issues` : 'Sync Issue',
        pillClassName: 'border-destructive/20 bg-destructive/10 text-destructive',
        description:
          failedMutation?.errorMessage
          ?? lastSyncError
          ?? 'Some changes could not be written to Firestore.',
        action: `Retry the pending queue now. Last failure: ${formatSyncTimestamp(lastFailureAt)}.`,
      };
    }

    if (runningSyncCount > 0 || queuedSyncCount > 0 || pendingSyncCount > 0) {
      const activeCount = runningSyncCount + queuedSyncCount;
      return {
        icon: runningSyncCount > 0 ? RefreshCw : Clock,
        iconClassName: runningSyncCount > 0 ? 'animate-spin text-primary' : 'text-primary',
        label: `${activeCount} In Queue`,
        pillClassName: 'border-primary/20 bg-primary/10 text-primary',
        description: runningSyncCount > 0
          ? `${runningSyncCount} running, ${queuedSyncCount} queued for Firestore sync.`
          : `${queuedSyncCount} change${queuedSyncCount > 1 ? 's are' : ' is'} queued for Firestore sync.`,
        action: `Last healthy sync: ${formatSyncTimestamp(lastSuccessfulSyncAt)}.`,
      };
    }

    return {
      icon: CheckCircle2,
      iconClassName: 'text-muted-foreground/80',
      label: 'Synced',
      pillClassName: 'border-border/70 bg-background/45 text-muted-foreground backdrop-blur-sm hover:bg-background/65',
      description: 'Local changes and Firestore are currently in sync.',
      action: `Last successful sync: ${formatSyncTimestamp(lastSuccessfulSyncAt)}.`,
    };
  }, [
    failedMutation?.errorMessage,
    failedSyncCount,
    lastFailureAt,
    lastSuccessfulSyncAt,
    lastSyncError,
    pendingSyncCount,
    queuedSyncCount,
    runningSyncCount,
    syncStatus,
  ]);

  return (
    <header className="surface-chrome sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1.5 border-b px-2 sm:h-16 sm:gap-3 sm:px-4 md:px-6">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Toggle sidebar</TooltipContent>
      </Tooltip>

      {/* Desktop search */}
      <div ref={searchContainerRef} className="relative mx-auto hidden w-full max-w-md md:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search items, categories..."
          className="h-9 rounded-full border-none bg-secondary pl-9 pr-9 text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary"
        />
        {searchQuery && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
        {showDesktopDropdown && (
          <SearchDropdown query={searchQuery} onClose={() => setSearchFocused(false)} />
        )}
      </div>

      {/* Mobile search toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto shrink-0 md:hidden"
        onClick={() => {
          setMobileSearchOpen((v) => !v);
          setMobileSearchFocused(false);
        }}
      >
        <Search className="h-5 w-5" />
      </Button>

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (syncStatus === 'error' || failedSyncCount > 0 || pendingSyncCount > 0) {
                  void collectionSyncService.retryPending();
                }
              }}
              className={cn(
                'relative gap-2 rounded-full px-2 sm:w-auto sm:justify-start sm:border sm:px-3',
                syncMeta.pillClassName,
              )}
            >
              <syncMeta.icon className={cn('h-5 w-5 shrink-0', syncMeta.iconClassName)} />
              <span className="hidden text-xs font-semibold sm:inline">{syncMeta.label}</span>
              {pendingSyncCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {pendingSyncCount > 9 ? '9+' : pendingSyncCount}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs space-y-1.5">
            <p className="text-xs font-semibold text-primary-foreground">{syncMeta.label}</p>
            <p className="text-xs leading-relaxed text-primary-foreground/90">{syncMeta.description}</p>
            <p className="text-[11px] leading-relaxed text-primary-foreground/75">{syncMeta.action}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              <Sun
                className={cn(
                  'h-5 w-5 transition-all',
                  theme === 'dark'
                    ? 'rotate-0 scale-100'
                    : '-rotate-90 scale-0',
                )}
              />
              <Moon
                className={cn(
                  'absolute h-5 w-5 transition-all',
                  theme === 'dark'
                    ? 'rotate-90 scale-0'
                    : 'rotate-0 scale-100',
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Toggle theme</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open settings"
              onClick={() => navigate('/settings')}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Settings</TooltipContent>
        </Tooltip>

        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Open notifications">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary shadow-sm ring-2 ring-background">
                      <span className="text-[9px] font-bold leading-none text-primary-foreground">
                        {unreadCount > 99 ? '99' : unreadCount}
                      </span>
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            {!notifOpen && <TooltipContent side="bottom">Notifications</TooltipContent>}
          </Tooltip>

          <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-[380px] p-0 sm:w-[380px]" sideOffset={8}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={markAllNotificationsRead}>
                  <CheckCircle2 className="mr-1 size-3" />
                  Mark all read
                </Button>
              )}
            </div>

            <div className="max-h-[min(400px,60vh)] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/40">
                    <Bell className="size-6 text-primary/70" />
                  </div>
                  <p className="mt-4 text-sm font-medium">No notifications yet</p>
                  <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                    New item activity, wishlist updates, and collection reminders will show up here.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      navigate('/activity');
                      setNotifOpen(false);
                    }}
                  >
                    Open Activity Log
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((entry) => {
                    const meta = actionMeta[entry.action] ?? actionMeta.item_updated;
                    const Icon = meta.icon;
                    const isRead = readSet.has(entry.id);

                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                          !isRead && 'bg-primary/[0.03]',
                        )}
                        onClick={() => {
                          markNotificationRead(entry.id);
                          if (entry.entityType === 'item') {
                            navigate(`/items/${entry.entityId}`);
                            setNotifOpen(false);
                          } else if (entry.entityType === 'category') {
                            navigate('/collections');
                            setNotifOpen(false);
                          } else if (entry.entityType === 'wishlist') {
                            navigate('/wishlist');
                            setNotifOpen(false);
                          }
                        }}
                      >
                        <div className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full', meta.color.split(' ')[1])}>
                          <Icon className={cn('size-4', meta.color.split(' ')[0])} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-medium">{entry.entityTitle}</p>
                            {!isRead && (
                              <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{meta.label}</p>
                          {entry.details && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{entry.details}</p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1 pt-0.5">
                          <Clock className="size-3 text-muted-foreground/50" />
                          <span className="text-[10px] text-muted-foreground/60">{timeAgo(entry.timestamp)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  navigate('/activity');
                  setNotifOpen(false);
                }}
              >
                View all activity
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="gap-2 rounded-full px-2"
              aria-label="Open account menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={authUser?.photoURL ?? ''} alt={userName} />
                <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline-block">
                {userName.split(' ')[0]}
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 opacity-50 md:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">
                  {userEmail}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile search overlay */}
      {mobileSearchOpen && (
        <div className="surface-3 absolute inset-x-0 top-full z-40 border-b p-3 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setMobileSearchFocused(true)}
              onBlur={() => setMobileSearchFocused(false)}
              placeholder="Search items, categories..."
              className="h-9 rounded-full border-none bg-secondary pl-9 pr-4 text-sm"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
            {showMobileDropdown && (
              <SearchDropdown
                query={searchQuery}
                onClose={() => {
                  setMobileSearchFocused(false);
                  setMobileSearchOpen(false);
                }}
              />
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Topbar;
