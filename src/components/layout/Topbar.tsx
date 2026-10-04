import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
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
  ScanQrCode,
  Package,
  RefreshCw,
  WifiOff,
  AlertCircle,
  AlarmClock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { getCategoryIcon } from '@/lib/icons';
import { describeSearchMatch, searchCategories, searchItems, tokenizeQuery } from '@/lib/search';
import { getReminders, type Reminder } from '@/lib/reminders';
import { Button } from '@/components/ui/button';
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
import { getLocale, useT } from '@/i18n';
import type { ActivityAction } from '@/types';

// Heavy dialogs load on first use (palette on Cmd/Ctrl+K, scanner pulls in html5-qrcode).
const BarcodeScannerDialog = lazy(() => import('@/components/shared/BarcodeScannerDialog')
  .then((module) => ({ default: module.BarcodeScannerDialog })));
const CommandPalette = lazy(() => import('@/components/shared/CommandPalette')
  .then((module) => ({ default: module.CommandPalette })));

const actionMeta: Record<ActivityAction, { icon: LucideIcon; color: string }> = {
  item_created:      { icon: Plus, color: 'text-emerald-500 bg-emerald-500/10' },
  item_updated:      { icon: Pencil, color: 'text-blue-500 bg-blue-500/10' },
  item_deleted:      { icon: Trash2, color: 'text-red-500 bg-red-500/10' },
  item_favorited:    { icon: Star, color: 'text-amber-500 bg-amber-500/10' },
  item_unfavorited:  { icon: StarOff, color: 'text-gray-400 bg-gray-400/10' },
  category_created:  { icon: FolderPlus, color: 'text-violet-500 bg-violet-500/10' },
  category_updated:  { icon: FolderPen, color: 'text-indigo-500 bg-indigo-500/10' },
  category_deleted:  { icon: FolderX, color: 'text-red-500 bg-red-500/10' },
  item_lent:         { icon: Send, color: 'text-orange-500 bg-orange-500/10' },
  item_returned:     { icon: Undo2, color: 'text-teal-500 bg-teal-500/10' },
  wishlist_added:    { icon: Heart, color: 'text-pink-500 bg-pink-500/10' },
  wishlist_acquired: { icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-500/10' },
  maintenance_added: { icon: Wrench, color: 'text-cyan-500 bg-cyan-500/10' },
  export_created:    { icon: Download, color: 'text-green-500 bg-green-500/10' },
};

const eyebrowClass = 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground';

type Translate = ReturnType<typeof useT>;

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

function timeAgo(ts: string, t: Translate): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('nav.time.justNow');
  const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'always', style: 'narrow' });
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return rtf.format(-hrs, 'hour');
  const days = Math.floor(hrs / 24);
  if (days < 7) return rtf.format(-days, 'day');
  return formatDate(ts);
}

function formatSyncTimestamp(timestamp: string | null, t: Translate): string {
  if (!timestamp) return t('nav.sync.never');

  return new Date(timestamp).toLocaleString(getLocale(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function reminderText(reminder: Reminder, t: Translate): string {
  const count = Math.abs(reminder.daysUntil);
  switch (reminder.kind) {
    case 'loan-overdue':
      return t('nav.reminders.loanOverdue', { count });
    case 'loan-due':
      return count === 0 ? t('nav.reminders.loanDueToday') : t('nav.reminders.loanDue', { count });
    case 'maintenance-overdue':
      return t('nav.reminders.maintenanceOverdue', { count });
    case 'maintenance-due':
    default:
      return count === 0 ? t('nav.reminders.maintenanceDueToday') : t('nav.reminders.maintenanceDue', { count });
  }
}

function reminderDetail(reminder: Reminder, t: Translate): string | undefined {
  if (!reminder.detail) return undefined;
  if (reminder.kind === 'loan-overdue' || reminder.kind === 'loan-due') {
    return t('nav.reminders.lentTo', { name: reminder.detail });
  }
  return t(`nav.maintenance.${reminder.detail}`);
}

// ───────────────────────── Search ─────────────────────────

interface SearchResultRow {
  key: string;
  path: string;
}

function TopbarSearch({
  variant,
  onNavigate,
  onOpenPalette,
  shortcutLabel,
}: {
  variant: 'desktop' | 'mobile';
  onNavigate?: () => void;
  onOpenPalette?: () => void;
  shortcutLabel?: string;
}) {
  const t = useT();
  const navigate = useNavigate();
  const items = useCollectionStore((s) => s.items);
  const categories = useCollectionStore((s) => s.categories);
  const searchQuery = useCollectionStore((s) => s.searchQuery);
  const setSearchQuery = useCollectionStore((s) => s.setSearchQuery);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState({ query: '', index: 0 });
  const baseId = useId();
  const listId = `${baseId}-results`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const trimmed = searchQuery.trim();
  const searchable = tokenizeQuery(trimmed).join('').length >= 2;

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const matchedItems = useMemo(
    () => (searchable ? searchItems(items, trimmed, { limit: 6 }) : []),
    [items, trimmed, searchable],
  );
  const matchedCategories = useMemo(
    () => (searchable ? searchCategories(categories, trimmed, 3) : []),
    [categories, trimmed, searchable],
  );

  const rows = useMemo<SearchResultRow[]>(() => [
    ...matchedItems.map(({ item }) => ({ key: `item:${item.id}`, path: `/items/${item.id}` })),
    ...matchedCategories.map((cat) => ({ key: `category:${cat.id}`, path: `/collections/${cat.slug}` })),
  ], [matchedItems, matchedCategories]);

  const showDropdown = focused && searchable;
  const activeIndex = active.query === searchQuery ? Math.min(active.index, Math.max(rows.length - 1, 0)) : 0;

  const go = (path: string) => {
    navigate(path);
    setSearchQuery('');
    setFocused(false);
    onNavigate?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (searchQuery) setSearchQuery('');
      else event.currentTarget.blur();
      return;
    }
    if (!showDropdown) {
      if (event.key === 'ArrowDown' && searchable) setFocused(true);
      return;
    }
    if (rows.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive({ query: searchQuery, index: (activeIndex + 1) % rows.length });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive({ query: searchQuery, index: (activeIndex - 1 + rows.length) % rows.length });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = rows[activeIndex];
      if (row) go(row.path);
    }
  };

  const optionClass = (isActive: boolean) => cn(
    'flex cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors',
    isActive ? 'bg-muted/60' : 'hover:bg-muted/60',
  );

  return (
    <div className="relative w-full">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setFocused(true);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder={t('nav.search.placeholder')}
        aria-label={t('nav.search.label')}
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showDropdown && rows.length > 0 ? optionId(activeIndex) : undefined}
        autoFocus={variant === 'mobile'}
        className={cn(
          'h-9 w-full rounded-full border-none bg-secondary pl-9 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary',
          onOpenPalette && shortcutLabel ? 'pr-16' : 'pr-9',
        )}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {searchQuery ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSearchQuery('')}
            aria-label={t('nav.search.clear')}
            className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        ) : onOpenPalette && shortcutLabel ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpenPalette}
            aria-label={t('nav.palette.open')}
            title={t('nav.palette.open')}
            className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 font-sans text-[10px] font-semibold text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {shortcutLabel}
          </button>
        ) : null}
      </div>

      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          aria-label={t('nav.search.results')}
          className="surface-3 absolute left-0 right-0 top-full z-50 mt-1.5 max-h-96 overflow-y-auto rounded-2xl border text-popover-foreground"
        >
          {rows.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-4" role="status">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/60">
                <Search aria-hidden="true" className="size-3.5 text-muted-foreground" />
              </span>
              <p className="text-sm text-muted-foreground">{t('nav.search.noResults', { query: trimmed })}</p>
            </div>
          ) : (
            <>
              {matchedItems.length > 0 && (
                <div role="group" aria-labelledby={`${baseId}-items`}>
                  <div id={`${baseId}-items`} className={cn('px-3 py-2', eyebrowClass)}>
                    {t('nav.search.items')}
                  </div>
                  {matchedItems.map(({ item, match }, index) => {
                    const cat = categoryById.get(item.categoryId);
                    const Icon = cat ? getCategoryIcon(cat.icon) : Package;
                    const isActive = index === activeIndex;
                    const hint = [cat?.name, match ? describeSearchMatch(match, cat, t) : undefined]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <div
                        key={item.id}
                        id={optionId(index)}
                        role="option"
                        aria-selected={isActive}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseMove={() => { if (!isActive) setActive({ query: searchQuery, index }); }}
                        onClick={() => go(`/items/${item.id}`)}
                        className={optionClass(isActive)}
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon aria-hidden="true" className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.title}</p>
                          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {matchedCategories.length > 0 && (
                <div
                  role="group"
                  aria-labelledby={`${baseId}-categories`}
                  className={cn(matchedItems.length > 0 && 'border-t')}
                >
                  <div id={`${baseId}-categories`} className={cn('px-3 py-2', eyebrowClass)}>
                    {t('nav.search.categories')}
                  </div>
                  {matchedCategories.map((cat, catIndex) => {
                    const index = matchedItems.length + catIndex;
                    const isActive = index === activeIndex;
                    const Icon = getCategoryIcon(cat.icon);
                    return (
                      <div
                        key={cat.id}
                        id={optionId(index)}
                        role="option"
                        aria-selected={isActive}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseMove={() => { if (!isActive) setActive({ query: searchQuery, index }); }}
                        onClick={() => go(`/collections/${cat.slug}`)}
                        className={optionClass(isActive)}
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon aria-hidden="true" className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{cat.name}</p>
                          {cat.description && (
                            <p className="truncate text-xs text-muted-foreground">{cat.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Topbar ─────────────────────────

const Topbar = () => {
  const t = useT();
  const toggleSidebar = useCollectionStore((s) => s.toggleSidebar);
  const theme = useCollectionStore((s) => s.theme);
  const toggleTheme = useCollectionStore((s) => s.toggleTheme);
  const activityLog = useCollectionStore((s) => s.activityLog);
  const items = useCollectionStore((s) => s.items);
  const remindersEnabled = useCollectionStore((s) => s.notifications?.newItemReminders ?? false);
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

  const userName = authUser?.displayName || t('nav.user.fallbackName');
  const userEmail = authUser?.email || '';
  const userInitials = userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const readNotificationIds = useCollectionStore((s) => s.readNotificationIds);
  const markNotificationRead = useCollectionStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useCollectionStore((s) => s.markAllNotificationsRead);

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMounted, setPaletteMounted] = useState(false);
  if (paletteOpen && !paletteMounted) setPaletteMounted(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMounted, setScannerMounted] = useState(false);
  if (scannerOpen && !scannerMounted) setScannerMounted(true);

  const shortcutLabel = useMemo(() => (isMacPlatform() ? '⌘K' : 'Ctrl K'), []);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openScanner = useCallback(() => setScannerOpen(true), []);
  const handleItemScanned = useCallback((itemId: string) => navigate(`/items/${itemId}`), [navigate]);

  const readSet = useMemo(() => new Set(readNotificationIds), [readNotificationIds]);

  const notifications = useMemo(
    () => [...activityLog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 20),
    [activityLog],
  );

  const reminders = useMemo(
    () => (remindersEnabled ? getReminders(items) : []),
    [items, remindersEnabled],
  );
  const overdueReminderCount = useMemo(
    () => reminders.filter((reminder) => reminder.daysUntil < 0).length,
    [reminders],
  );

  const unreadActivityCount = useMemo(
    () => notifications.filter((n) => !readSet.has(n.id)).length,
    [notifications, readSet],
  );
  const unreadCount = unreadActivityCount + overdueReminderCount;

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
        pillClassName: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
        label: hasQueuedOfflineWork ? t('nav.sync.offlinePending', { count: pendingSyncCount }) : t('nav.sync.offline'),
        description: hasQueuedOfflineWork
          ? t('nav.sync.offlineQueuedDescription', { count: pendingSyncCount })
          : t('nav.sync.offlineDescription'),
        action: hasQueuedOfflineWork
          ? t('nav.sync.lastHealthy', { time: formatSyncTimestamp(lastSuccessfulSyncAt, t) })
          : t('nav.sync.offlineAction'),
      };
    }

    if (failedSyncCount > 0 || syncStatus === 'error') {
      const issueCount = failedSyncCount || 1;
      return {
        icon: AlertCircle,
        iconClassName: 'text-destructive',
        pillClassName: 'border-destructive/20 bg-destructive/10 text-destructive',
        label: t('nav.sync.issue', { count: issueCount }),
        description:
          failedMutation?.errorMessage
          ?? lastSyncError
          ?? t('nav.sync.issueDescription'),
        action: t('nav.sync.issueAction', { time: formatSyncTimestamp(lastFailureAt, t) }),
      };
    }

    if (runningSyncCount > 0 || queuedSyncCount > 0 || pendingSyncCount > 0) {
      const activeCount = runningSyncCount + queuedSyncCount;
      return {
        icon: runningSyncCount > 0 ? RefreshCw : Clock,
        iconClassName: runningSyncCount > 0 ? 'animate-spin text-primary' : 'text-primary',
        pillClassName: 'border-primary/20 bg-primary/10 text-primary',
        label: t('nav.sync.inQueue', { count: activeCount }),
        description: runningSyncCount > 0
          ? t('nav.sync.runningDescription', { running: runningSyncCount, queued: queuedSyncCount })
          : t('nav.sync.queuedDescription', { count: queuedSyncCount }),
        action: t('nav.sync.lastHealthy', { time: formatSyncTimestamp(lastSuccessfulSyncAt, t) }),
      };
    }

    return {
      icon: CheckCircle2,
      iconClassName: 'text-muted-foreground/80',
      pillClassName: 'border-border/70 bg-background/45 text-muted-foreground backdrop-blur-sm hover:bg-background/65',
      label: t('nav.sync.synced'),
      description: t('nav.sync.syncedDescription'),
      action: t('nav.sync.lastSuccessful', { time: formatSyncTimestamp(lastSuccessfulSyncAt, t) }),
    };
  }, [
    t,
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

  const closeNotificationsAnd = (path: string) => {
    navigate(path);
    setNotifOpen(false);
  };

  const hasNotifications = notifications.length > 0 || reminders.length > 0;

  const SyncIcon = syncMeta.icon;

  return (
    <header className="desktop-sticky-topbar desktop-titlebar-drag surface-chrome sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1.5 border-b px-2 sm:h-16 sm:gap-3 sm:px-4 md:px-6">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="shrink-0"
            aria-label={t('nav.topbar.toggleSidebar')}
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('nav.topbar.toggleSidebar')}</TooltipContent>
      </Tooltip>

      {/* Desktop search */}
      <div className="mx-auto hidden w-full max-w-md md:block">
        <TopbarSearch
          variant="desktop"
          onOpenPalette={() => setPaletteOpen(true)}
          shortcutLabel={shortcutLabel}
        />
      </div>

      {/* Mobile search toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto shrink-0 md:hidden"
        aria-label={mobileSearchOpen ? t('nav.topbar.closeSearch') : t('nav.topbar.openSearch')}
        aria-expanded={mobileSearchOpen}
        onClick={() => setMobileSearchOpen((v) => !v)}
      >
        <Search aria-hidden="true" className="h-5 w-5" />
      </Button>

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={openScanner}
              aria-label={t('nav.topbar.scan')}
            >
              <ScanQrCode aria-hidden="true" className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('nav.topbar.scan')}</TooltipContent>
        </Tooltip>

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
              aria-label={t('nav.sync.ariaLabel', { status: syncMeta.label })}
              className={cn(
                'relative gap-2 rounded-full px-2 sm:w-auto sm:justify-start sm:border sm:px-3',
                syncMeta.pillClassName,
              )}
            >
              <SyncIcon aria-hidden="true" className={cn('h-5 w-5 shrink-0', syncMeta.iconClassName)} />
              <span className="hidden text-xs font-semibold sm:inline">{syncMeta.label}</span>
              {pendingSyncCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground"
                >
                  {pendingSyncCount > 9 ? '9+' : pendingSyncCount}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs space-y-1.5">
            <p className="text-xs font-semibold">{syncMeta.label}</p>
            <p className="text-xs leading-relaxed opacity-90">{syncMeta.description}</p>
            <p className="text-[11px] leading-relaxed opacity-75">{syncMeta.action}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" onClick={toggleTheme} aria-label={t('nav.theme.toggle')}>
              <Sun
                aria-hidden="true"
                className={cn(
                  'h-5 w-5 transition-all',
                  theme === 'dark' ? 'rotate-0 scale-100' : '-rotate-90 scale-0',
                )}
              />
              <Moon
                aria-hidden="true"
                className={cn(
                  'absolute h-5 w-5 transition-all',
                  theme === 'dark' ? 'rotate-90 scale-0' : 'rotate-0 scale-100',
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {theme === 'dark' ? t('nav.theme.switchToLight') : t('nav.theme.switchToDark')}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              aria-label={t('nav.topbar.openSettings')}
              onClick={() => navigate('/settings')}
            >
              <Settings aria-hidden="true" className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('nav.settings')}</TooltipContent>
        </Tooltip>

        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  aria-label={
                    unreadCount > 0
                      ? t('nav.notifications.openWithCount', { count: unreadCount })
                      : t('nav.notifications.open')
                  }
                >
                  <Bell aria-hidden="true" className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 shadow-sm ring-2 ring-background"
                    >
                      <span className="text-[9px] font-bold leading-none tabular-nums text-primary-foreground">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            {!notifOpen && <TooltipContent side="bottom">{t('nav.notifications.title')}</TooltipContent>}
          </Tooltip>

          <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-[380px] p-0 sm:w-[380px]" sideOffset={8}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{t('nav.notifications.title')}</h3>
                {unreadActivityCount > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {t('nav.notifications.newCount', { count: unreadActivityCount })}
                  </Badge>
                )}
              </div>
              {unreadActivityCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={markAllNotificationsRead}>
                  <CheckCircle2 aria-hidden="true" className="mr-1 size-3" />
                  {t('nav.notifications.markAllRead')}
                </Button>
              )}
            </div>

            <div className="max-h-[min(400px,60vh)] overflow-y-auto overscroll-contain">
              {!hasNotifications ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/40">
                    <Bell aria-hidden="true" className="size-6 text-primary/70" />
                  </div>
                  <p className="mt-4 text-sm font-medium">{t('nav.notifications.emptyTitle')}</p>
                  <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                    {t('nav.notifications.emptyDescription')}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => closeNotificationsAnd('/activity')}
                  >
                    {t('nav.notifications.openActivityLog')}
                  </Button>
                </div>
              ) : (
                <>
                  {reminders.length > 0 && (
                    <section aria-labelledby="topbar-reminders-heading" className="border-b">
                      <div className="flex items-center justify-between px-4 pb-1 pt-3">
                        <h4 id="topbar-reminders-heading" className={cn('flex items-center gap-1.5', eyebrowClass)}>
                          <AlarmClock aria-hidden="true" className="size-3 text-primary" />
                          {t('nav.reminders.title')}
                        </h4>
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] tabular-nums">
                          {reminders.length}
                        </Badge>
                      </div>
                      <ul className="divide-y">
                        {reminders.map((reminder) => {
                          const isLoan = reminder.kind === 'loan-overdue' || reminder.kind === 'loan-due';
                          const isOverdue = reminder.daysUntil < 0;
                          const Icon = isLoan ? Send : Wrench;
                          const detail = reminderDetail(reminder, t);
                          return (
                            <li key={reminder.id}>
                              <button
                                type="button"
                                className={cn(
                                  'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none',
                                  isOverdue && 'bg-red-500/[0.04]',
                                )}
                                onClick={() => closeNotificationsAnd(`/items/${reminder.itemId}`)}
                              >
                                <div
                                  className={cn(
                                    'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                                    isOverdue ? 'bg-red-500/10' : 'bg-amber-500/10',
                                  )}
                                >
                                  <Icon aria-hidden="true" className={cn('size-4', isOverdue ? 'text-red-500' : 'text-amber-500')} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{reminder.itemTitle}</p>
                                  <p className={cn('text-xs', isOverdue ? 'font-medium text-red-500' : 'text-muted-foreground')}>
                                    {reminderText(reminder, t)}
                                  </p>
                                  {detail && <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{detail}</p>}
                                </div>
                                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                                  <Clock aria-hidden="true" className="size-3 text-muted-foreground/50" />
                                  <span className="text-[10px] tabular-nums text-muted-foreground/60">{formatDate(reminder.date)}</span>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}

                  {notifications.length > 0 && (
                    <section aria-labelledby={reminders.length > 0 ? 'topbar-activity-heading' : undefined}>
                      {reminders.length > 0 && (
                        <h4 id="topbar-activity-heading" className={cn('px-4 pb-1 pt-3', eyebrowClass)}>
                          {t('nav.notifications.recentActivity')}
                        </h4>
                      )}
                      <ul className="divide-y">
                        {notifications.map((entry) => {
                          const meta = actionMeta[entry.action] ?? actionMeta.item_updated;
                          const Icon = meta.icon;
                          const [iconColor, iconBg] = meta.color.split(' ');
                          const isRead = readSet.has(entry.id);

                          return (
                            <li key={entry.id}>
                              <button
                                type="button"
                                className={cn(
                                  'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none',
                                  !isRead && 'bg-primary/[0.03]',
                                )}
                                onClick={() => {
                                  markNotificationRead(entry.id);
                                  if (entry.entityType === 'item') {
                                    closeNotificationsAnd(`/items/${entry.entityId}`);
                                  } else if (entry.entityType === 'category') {
                                    closeNotificationsAnd('/collections');
                                  } else if (entry.entityType === 'wishlist') {
                                    closeNotificationsAnd('/wishlist');
                                  }
                                }}
                              >
                                <div className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full', iconBg)}>
                                  <Icon aria-hidden="true" className={cn('size-4', iconColor)} />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="truncate text-sm font-medium">{entry.entityTitle}</p>
                                    {!isRead && (
                                      <span className="size-1.5 shrink-0 rounded-full bg-primary">
                                        <span className="sr-only">{t('nav.notifications.unread')}</span>
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{t(`nav.activityAction.${entry.action}`)}</p>
                                  {entry.details && (
                                    <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{entry.details}</p>
                                  )}
                                </div>

                                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                                  <Clock aria-hidden="true" className="size-3 text-muted-foreground/50" />
                                  <span className="text-[10px] text-muted-foreground/60">{timeAgo(entry.timestamp, t)}</span>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}
                </>
              )}
            </div>

            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => closeNotificationsAnd('/activity')}
              >
                {t('nav.notifications.viewAll')}
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
              aria-label={t('nav.user.openMenu')}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={authUser?.photoURL ?? ''} alt="" />
                <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline-block">
                {userName.split(' ')[0]}
              </span>
              <ChevronDown aria-hidden="true" className="hidden h-3.5 w-3.5 opacity-50 md:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="truncate text-sm font-medium">{userName}</p>
                {userEmail && <p className="truncate text-xs text-muted-foreground">{userEmail}</p>}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <User aria-hidden="true" className="mr-2 h-4 w-4" />
              {t('nav.user.profile')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings aria-hidden="true" className="mr-2 h-4 w-4" />
              {t('nav.settings')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              <LogOut aria-hidden="true" className="mr-2 h-4 w-4" />
              {t('nav.user.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile search overlay */}
      {mobileSearchOpen && (
        <div className="surface-3 absolute inset-x-0 top-full z-40 border-b p-3 md:hidden">
          <TopbarSearch variant="mobile" onNavigate={() => setMobileSearchOpen(false)} />
        </div>
      )}

      {paletteMounted && (
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onScan={openScanner} />
        </Suspense>
      )}
      {scannerMounted && (
        <Suspense fallback={null}>
          <BarcodeScannerDialog
            mode="item"
            open={scannerOpen}
            onOpenChange={setScannerOpen}
            onItemFound={handleItemScanned}
          />
        </Suspense>
      )}
    </header>
  );
};

export default Topbar;
