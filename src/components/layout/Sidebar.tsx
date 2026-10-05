import { useCallback, useMemo, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  LayoutDashboard,
  FolderOpen,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Heart,
  Star,
  Send,
  Clock,
  Presentation,
  Library,
  BookOpen,
  Inbox,
  Search,
  Bookmark,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { getCategoryIcon } from '@/lib/icons';
import { isItemUnassignedForCategory, libraryMatchesCategory } from '@/lib/libraries';
import { matchesQuery } from '@/lib/search';
import { getSavedViewHref, useSavedViews } from '@/lib/savedViews';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VirtualList } from '@/components/shared';
import { BrandMark } from '@/components/shared/BrandMark';
import { useCollectionStore } from '@/store/useCollectionStore';
import { useT } from '@/i18n';
import type { CollectionItem } from '@/types';

const baseNavItems: { labelKey: string; icon: LucideIcon; path: string }[] = [
  { labelKey: 'nav.collections', icon: FolderOpen, path: '/collections' },
  { labelKey: 'nav.statistics', icon: LayoutDashboard, path: '/dashboard' },
  { labelKey: 'nav.favorites', icon: Star, path: '/favorites' },
  { labelKey: 'nav.wishlist', icon: Heart, path: '/wishlist' },
  { labelKey: 'nav.lending', icon: Send, path: '/lending' },
  { labelKey: 'nav.contributors', icon: Users, path: '/contributors' },
  { labelKey: 'nav.activity', icon: Clock, path: '/activity' },
  { labelKey: 'nav.exhibition', icon: Presentation, path: '/exhibition' },
];

const VIRTUAL_THRESHOLD = 80;

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50';
const countBadgeClass =
  'h-5 min-w-[1.25rem] shrink-0 justify-center rounded-full border border-border/60 bg-background/55 px-1.5 text-[10px] tabular-nums';
const treeBadgeClass = 'h-4 shrink-0 rounded-full border border-border/60 bg-background/55 px-1 text-[10px] tabular-nums';

function getPrimaryNavClass(isActive: boolean) {
  return cn(
    'group relative flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left text-sm font-medium transition-all duration-200',
    focusRing,
    isActive
      ? 'surface-brand border-primary/25 text-surface-brand-foreground'
      : 'border-transparent text-sidebar-foreground/85 hover:surface-1 hover:-translate-y-px hover:text-foreground',
  );
}

function getSecondaryNavClass(isActive: boolean) {
  return cn(
    'group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-all duration-200',
    focusRing,
    isActive
      ? 'surface-2 border-primary/20 text-primary shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05)]'
      : 'border-transparent text-sidebar-foreground/80 hover:surface-1 hover:text-foreground',
  );
}

function getTreeNavClass(isActive: boolean) {
  return cn(
    'group flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[13px] transition-all duration-200',
    focusRing,
    isActive
      ? 'surface-2 border-primary/18 text-primary'
      : 'border-transparent text-sidebar-foreground/78 hover:surface-1 hover:text-foreground',
  );
}

/** Rounded icon tile used by primary and secondary rows. */
function NavIconTile({ icon: Icon, active, onBrand = false }: { icon: LucideIcon; active: boolean; onBrand?: boolean }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors',
        active ? (onBrand ? 'bg-white/12 text-current' : 'bg-primary/12 text-current') : 'bg-primary/10 text-primary',
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
    </span>
  );
}

function CountBadge({ value, small = false }: { value: number; small?: boolean }) {
  return (
    <Badge variant="secondary" className={small ? treeBadgeClass : countBadgeClass}>
      {value}
    </Badge>
  );
}

function SidebarItemList({
  items: listItems,
  catPath,
  navigate,
  libraryParam,
  activeItemId,
}: {
  items: CollectionItem[];
  catPath: string;
  navigate: (path: string) => void;
  libraryParam?: string;
  activeItemId?: string | null;
}) {
  const t = useT();

  if (listItems.length === 0) {
    return <p className="px-3 py-1.5 text-xs italic text-muted-foreground/60">{t('nav.sidebar.noItems')}</p>;
  }

  const buildDetailPath = (itemId: string) => {
    const params = new URLSearchParams();
    if (libraryParam) {
      params.set('library', libraryParam);
    }
    params.set('detail', itemId);
    return `${catPath}?${params.toString()}`;
  };

  const renderItemButton = (item: CollectionItem) => {
    const isActive = activeItemId === item.id;
    return (
      <button
        type="button"
        onClick={() => navigate(buildDetailPath(item.id))}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'group flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-all duration-200',
          focusRing,
          isActive
            ? 'surface-2 border-primary/15 text-primary'
            : 'border-transparent text-sidebar-foreground/70 hover:surface-1 hover:text-foreground',
        )}
      >
        <BookOpen
          aria-hidden="true"
          className="mt-0.5 size-3 shrink-0 opacity-50 transition-transform duration-200 group-hover:translate-x-0.5"
        />
        <span className="leading-snug">{item.title}</span>
      </button>
    );
  };

  if (listItems.length > VIRTUAL_THRESHOLD) {
    return (
      <VirtualList
        items={listItems}
        threshold={VIRTUAL_THRESHOLD}
        estimateSize={34}
        getItemKey={(item) => item.id}
        renderItem={renderItemButton}
        className="ml-3 border-l border-border/60 py-1 pl-3"
        itemClassName="pb-1"
        viewportHeight="min(46vh, 420px)"
      />
    );
  }

  return (
    <div className="ml-3 space-y-1 border-l border-border/60 py-1 pl-3">
      {listItems.map((item) => (
        <div key={item.id}>{renderItemButton(item)}</div>
      ))}
    </div>
  );
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'mb-3 flex w-full items-center gap-2 rounded-2xl border border-transparent px-3 py-2.5 text-left text-sm font-medium text-sidebar-foreground/80 transition-all duration-200 hover:surface-1 hover:text-foreground',
        focusRing,
      )}
    >
      <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Uppercase, letter-spaced section label with an optional pill count. */
function SectionHeader({
  label,
  count,
  icon,
  children,
}: {
  label: string;
  count?: number;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  const Icon = icon;
  return (
    <div className="mb-2 flex items-center justify-between gap-2 px-3">
      <div className="flex min-w-0 items-center gap-2">
        {Icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Icon aria-hidden="true" className="size-4" />
          </span>
        )}
        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/60">
          {label}
        </span>
      </div>
      {(children || count !== undefined) && (
        <div className="flex shrink-0 items-center gap-1">
          {children}
          {count !== undefined && (
            <Badge variant="secondary" className="h-5 rounded-full border border-border/60 bg-background/55 px-1.5 text-[10px] tabular-nums">
              {count}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

const Sidebar = () => {
  const t = useT();
  const sidebarOpen = useCollectionStore((s) => s.sidebarOpen);
  const menuCollectionStyle = useCollectionStore((s) => s.menuCollectionStyle) ?? 'style1';
  const categories = useCollectionStore((s) => s.categories);
  const items = useCollectionStore((s) => s.items);
  const reorderCategories = useCollectionStore((s) => s.reorderCategories);
  const savedViews = useSavedViews();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [reorderMode, setReorderMode] = useState(false);
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [expandedLibId, setExpandedLibId] = useState<string | null>(null);

  const [groupByField, setGroupByField] = useState<string>('title');
  const [drillGroupValue, setDrillGroupValue] = useState<string | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const activeDetailItemId = searchParams.get('detail');

  const libraries = useCollectionStore((s) => s.libraries);
  const itemsByCategory = useMemo(() => {
    const map = new Map<string, CollectionItem[]>();
    for (const item of items) {
      if (item.isArchived) continue;
      const current = map.get(item.categoryId) ?? [];
      current.push(item);
      map.set(item.categoryId, current);
    }
    return map;
  }, [items]);
  const getCategoryItems = useCallback(
    (categoryId: string) => itemsByCategory.get(categoryId) ?? [],
    [itemsByCategory],
  );

  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches && useCollectionStore.getState().sidebarOpen) {
      useCollectionStore.setState({ sidebarOpen: false });
    }
  }, [location.pathname]);

  const categoryStats = useMemo(
    () =>
      [...categories]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((cat) => {
          const catItems = getCategoryItems(cat.id);
          return {
            ...cat,
            count: catItems.length,
            unassignedCount: catItems.filter((item) => isItemUnassignedForCategory(item, cat.id, libraries)).length,
            libraries: libraries
              .filter((library) => libraryMatchesCategory(library, cat.id))
              .sort((a, b) => a.order - b.order)
              .map((lib) => ({
                ...lib,
                count: catItems.filter((i) => i.libraryId === lib.id).length,
              })),
          };
        }),
    [categories, libraries, getCategoryItems],
  );

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const ids = categoryStats.map((c) => c.id);
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= ids.length) return;
    [ids[index], ids[swapIdx]] = [ids[swapIdx], ids[index]];
    reorderCategories(ids);
  };

  const activeDrillCatId = useMemo(() => {
    if (menuCollectionStyle !== 'style2') return null;
    const match = location.pathname.match(/^\/collections\/([^/]+)$/);
    if (!match) return null;
    const slug = match[1];
    const category = categories.find((entry) => entry.slug === slug);
    if (!category) return null;
    const hasLibraries = libraries.some((entry) => libraryMatchesCategory(entry, category.id));
    return hasLibraries ? category.id : null;
  }, [menuCollectionStyle, location.pathname, categories, libraries]);

  const activeDrillLibId = useMemo(() => {
    if (!activeDrillCatId) return null;
    const libraryParam = searchParams.get('library');
    if (!libraryParam) return null;
    if (libraryParam === 'all') return '_all';
    if (libraryParam === 'unassigned') return '_unassigned';
    return libraryParam;
  }, [activeDrillCatId, searchParams]);
  const activeLibraryParam = useMemo(() => {
    if (!location.pathname.startsWith('/collections/')) return null;
    return searchParams.get('library') ?? 'all';
  }, [location.pathname, searchParams]);

  const isMobileSidebar = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

  return (
    <>
    <AnimatePresence>
      {sidebarOpen && isMobileSidebar && (
        <motion.div
          key="sidebar-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden="true"
          onClick={() => useCollectionStore.setState({ sidebarOpen: false })}
        />
      )}
    </AnimatePresence>
    <aside
      aria-label={t('nav.sidebar.label')}
      className={cn(
        'flex h-full flex-col border-r border-border/70 bg-sidebar/95 text-sidebar-foreground shadow-[18px_0_40px_rgb(0_0_0_/_0.08)] backdrop-blur-xl transition-all duration-300 ease-in-out',
        'fixed inset-y-0 left-0 z-50 md:relative md:z-auto',
        sidebarOpen ? 'w-64' : 'w-0 overflow-hidden',
      )}
    >
      <div className="desktop-titlebar-drag relative flex h-16 shrink-0 items-center overflow-hidden border-b border-border/70 px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative flex w-full items-center gap-3">
          <BrandMark className="size-10 rounded-[0.6rem] shadow-[0_8px_20px_rgba(79,70,229,0.32)]" />
          <div className="min-w-0 flex-1">
            <span className="brand-title-premium block text-[17px] leading-tight" data-text={BRAND_NAME}>
              {BRAND_NAME}
            </span>
            <div className="mt-0.5 flex items-center">
              <span
                className="brand-subtitle-premium whitespace-nowrap text-[12px]"
                data-text={t('nav.tagline')}
              >
                {t('nav.tagline')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        {/* ── Drill-in: Library items view (Style 2 only) ── */}
        {menuCollectionStyle === 'style2' && activeDrillCatId && activeDrillLibId ? (() => {
          const cat = categoryStats.find((c) => c.id === activeDrillCatId);
          if (!cat) return null;
          const catPath = `/collections/${cat.slug}`;
          const isAll = activeDrillLibId === '_all';
          const isUnassigned = activeDrillLibId === '_unassigned';
          const libraryParam = isAll ? 'all' : isUnassigned ? 'unassigned' : activeDrillLibId;
          const lib = cat.libraries.find((l) => l.id === activeDrillLibId);
          const label = isAll ? t('common.all') : isUnassigned ? t('nav.sidebar.unassigned') : lib?.name ?? '';
          const drillItems = isAll
            ? getCategoryItems(cat.id)
            : isUnassigned
              ? getCategoryItems(cat.id).filter((item) => isItemUnassignedForCategory(item, cat.id, libraries))
              : getCategoryItems(cat.id).filter((i) => i.libraryId === activeDrillLibId);

          const textFields = (cat.fields ?? []).filter(
            (f) => (f.type === 'text' || f.type === 'select') && f.key !== 'title',
          );

          const searchFiltered = sidebarSearch.trim()
            ? drillItems.filter((item) =>
                matchesQuery(
                  sidebarSearch,
                  item.title,
                  ...textFields.map((f) => {
                    const val = item.customFields?.[f.key];
                    return typeof val === 'string' ? val : undefined;
                  }),
                ),
              )
            : drillItems;

          const groupField = textFields.find((f) => f.key === groupByField);

          let groupedEntries: { key: string; label: string; count: number }[] = [];
          if (groupField) {
            const map = new Map<string, number>();
            searchFiltered.forEach((item) => {
              const raw = item.customFields?.[groupField.key];
              const val = typeof raw === 'string' && raw.trim() ? raw.trim() : '—';
              map.set(val, (map.get(val) ?? 0) + 1);
            });
            groupedEntries = [...map.entries()]
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([key, count]) => ({ key, label: key, count }));
          }

          const showGroupItems = groupField && drillGroupValue !== null;
          const groupItems = showGroupItems
            ? searchFiltered.filter((item) => {
                const raw = item.customFields?.[groupField.key];
                const val = typeof raw === 'string' && raw.trim() ? raw.trim() : '—';
                return val === drillGroupValue;
              })
            : [];
          const renderDrillItem = (item: CollectionItem) => {
            const isActive = activeDetailItemId === item.id;
            return (
              <button
                type="button"
                onClick={() => navigate(`${catPath}?library=${libraryParam}&detail=${item.id}`)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-all duration-200',
                  focusRing,
                  isActive
                    ? 'surface-2 border-primary/18 text-primary'
                    : 'border-transparent text-sidebar-foreground/80 hover:surface-1 hover:text-foreground',
                )}
              >
                <BookOpen
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0 opacity-50 transition-transform duration-200 group-hover:translate-x-0.5"
                />
                <span className="leading-snug">{item.title}</span>
              </button>
            );
          };

          return (
            <>
              <BackButton
                label={showGroupItems ? groupField.label : cat.name}
                onClick={() => {
                  if (showGroupItems) {
                    setDrillGroupValue(null);
                  } else {
                    navigate(catPath);
                    setGroupByField('none');
                    setDrillGroupValue(null);
                    setSidebarSearch('');
                  }
                }}
              />

              <SectionHeader
                label={(showGroupItems ? drillGroupValue : label) ?? ''}
                count={showGroupItems ? groupItems.length : searchFiltered.length}
              />

              {/* Group dropdown */}
              {!showGroupItems && textFields.length > 0 && (
                <div className="mb-2 px-3">
                  <select
                    value={groupByField}
                    onChange={(e) => { setGroupByField(e.target.value); setDrillGroupValue(null); }}
                    aria-label={t('nav.sidebar.groupBy')}
                    className="surface-1 h-8 w-full rounded-xl border px-3 text-xs text-sidebar-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <option value="title">{t('nav.sidebar.groupTitle')}</option>
                    {textFields.map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search */}
              {!showGroupItems && (
                <div className="relative mb-2 px-3">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-5 top-1/2 size-3.5 -translate-y-1/2 text-sidebar-foreground/55"
                  />
                  <input
                    type="search"
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    placeholder={t('nav.sidebar.searchPlaceholder')}
                    aria-label={t('nav.sidebar.searchLabel')}
                    className="surface-1 h-9 w-full rounded-xl border pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-sidebar-foreground/50 focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </div>
              )}

              {/* Content */}
              <nav className="space-y-0.5" aria-label={label}>
                {showGroupItems ? (
                  groupItems.length === 0 ? (
                    <p className="px-3 py-3 text-xs italic text-muted-foreground/60">{t('nav.sidebar.noItems')}</p>
                  ) : groupItems.length > VIRTUAL_THRESHOLD ? (
                    <VirtualList
                      items={groupItems}
                      threshold={VIRTUAL_THRESHOLD}
                      estimateSize={45}
                      getItemKey={(item) => item.id}
                      renderItem={renderDrillItem}
                      itemClassName="pb-1"
                      viewportHeight="min(54vh, 520px)"
                    />
                  ) : (
                    groupItems.map((item) => (
                      <div key={item.id}>{renderDrillItem(item)}</div>
                    ))
                  )
                ) : groupField ? (
                  groupedEntries.length === 0 ? (
                    <p className="px-3 py-3 text-xs italic text-muted-foreground/60">{t('nav.sidebar.noGroups')}</p>
                  ) : (
                    groupedEntries.map((g) => (
                      <button
                        type="button"
                        key={g.key}
                        onClick={() => setDrillGroupValue(g.key)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm text-sidebar-foreground/80 transition-all duration-200 hover:surface-1 hover:text-foreground',
                          focusRing,
                        )}
                      >
                        <Layers aria-hidden="true" className="size-3.5 shrink-0 opacity-50" />
                        <span className="min-w-0 flex-1 leading-snug">{g.label}</span>
                        <CountBadge value={g.count} />
                      </button>
                    ))
                  )
                ) : searchFiltered.length === 0 ? (
                  <p className="px-3 py-3 text-xs italic text-muted-foreground/60">
                    {sidebarSearch ? t('nav.sidebar.noResults') : t('nav.sidebar.noItemsInLibrary')}
                  </p>
                ) : searchFiltered.length > VIRTUAL_THRESHOLD ? (
                  <VirtualList
                    items={searchFiltered}
                    threshold={VIRTUAL_THRESHOLD}
                    estimateSize={45}
                    getItemKey={(item) => item.id}
                    renderItem={renderDrillItem}
                    itemClassName="pb-1"
                    viewportHeight="min(54vh, 520px)"
                  />
                ) : (
                  searchFiltered.map((item) => (
                    <div key={item.id}>{renderDrillItem(item)}</div>
                  ))
                )}
              </nav>
            </>
          );
        })()

        /* ── Style 2 Drill-in: Libraries view (Style 2 only) ── */
        : menuCollectionStyle === 'style2' && activeDrillCatId ? (() => {
          const cat = categoryStats.find((c) => c.id === activeDrillCatId);
          if (!cat) return null;
          const catPath = `/collections/${cat.slug}`;
          const CatIcon = getCategoryIcon(cat.icon);

          return (
            <>
              <BackButton label={t('nav.collections')} onClick={() => navigate('/collections')} />

              <SectionHeader label={cat.name} count={cat.count} icon={CatIcon} />

              <nav className="space-y-0.5" aria-label={cat.name}>
                <button
                  type="button"
                  onClick={() => navigate(`${catPath}?library=all`)}
                  aria-current={activeLibraryParam === 'all' ? 'page' : undefined}
                  className={getSecondaryNavClass(activeLibraryParam === 'all')}
                >
                  <NavIconTile icon={FolderOpen} active={activeLibraryParam === 'all'} />
                  <span className="min-w-0 flex-1 truncate">{t('common.all')}</span>
                  <CountBadge value={cat.count} />
                </button>
                {cat.libraries.map((lib) => (
                  <button
                    type="button"
                    key={lib.id}
                    onClick={() => navigate(`${catPath}?library=${lib.id}`)}
                    aria-current={activeLibraryParam === lib.id ? 'page' : undefined}
                    className={getSecondaryNavClass(activeLibraryParam === lib.id)}
                  >
                    <NavIconTile icon={Library} active={activeLibraryParam === lib.id} />
                    <span className="min-w-0 flex-1 truncate">{lib.name}</span>
                    <CountBadge value={lib.count} />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => navigate(`${catPath}?library=unassigned`)}
                  aria-current={activeLibraryParam === 'unassigned' ? 'page' : undefined}
                  className={getSecondaryNavClass(activeLibraryParam === 'unassigned')}
                >
                  <NavIconTile icon={Inbox} active={activeLibraryParam === 'unassigned'} />
                  <span className="min-w-0 flex-1 truncate">{t('nav.sidebar.unassigned')}</span>
                  <CountBadge value={cat.unassignedCount} />
                </button>
              </nav>
            </>
          );
        })()

        /* ── Default: Top nav + Collections list (Style 1 tree or Style 2 flat) ── */
        : (
          <>
            <nav className="space-y-0.5" aria-label={t('nav.sidebar.pages')}>
              {baseNavItems.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  location.pathname.startsWith(item.path + '/');
                return (
                  <button
                    type="button"
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    aria-current={isActive ? 'page' : undefined}
                    className={getPrimaryNavClass(isActive)}
                  >
                    <NavIconTile icon={item.icon} active={isActive} onBrand />
                    <span className="truncate">{t(item.labelKey)}</span>
                    {isActive && (
                      <ChevronRight aria-hidden="true" className="ml-auto size-3.5 opacity-60" />
                    )}
                  </button>
                );
              })}
            </nav>

            <Separator className="my-4 opacity-60" />

            <SectionHeader label={t('nav.collections')} count={categories.length}>
              {menuCollectionStyle === 'style1' && categories.length > 1 && (
                <button
                  type="button"
                  onClick={() => setReorderMode((v) => !v)}
                  aria-pressed={reorderMode}
                  title={reorderMode ? t('nav.sidebar.doneReordering') : t('nav.sidebar.reorderCategories')}
                  className={cn(
                    'flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-medium transition-colors',
                    focusRing,
                    reorderMode
                      ? 'border-primary/20 bg-primary/10 text-primary'
                      : 'border-transparent text-sidebar-foreground/65 hover:border-border/70 hover:text-foreground',
                  )}
                >
                  <GripVertical aria-hidden="true" className="size-3" />
                  {reorderMode ? t('nav.sidebar.done') : <span className="sr-only">{t('nav.sidebar.reorder')}</span>}
                </button>
              )}
            </SectionHeader>

            <nav className="space-y-0.5" aria-label={t('nav.collections')}>
              {categoryStats.map((cat, idx) => {
                const Icon = getCategoryIcon(cat.icon);
                const catPath = `/collections/${cat.slug}`;
                const isActive = location.pathname === catPath;
                const hasLibraries = cat.libraries.length > 0;

                if (menuCollectionStyle === 'style2') {
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => navigate(catPath)}
                      aria-current={isActive ? 'page' : undefined}
                      className={getSecondaryNavClass(isActive)}
                    >
                      <NavIconTile icon={Icon} active={isActive} />
                      <span className="min-w-0 flex-1 truncate">{cat.name}</span>
                      {hasLibraries && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 opacity-40" />}
                      <CountBadge value={cat.count} />
                    </button>
                  );
                }

                const isExpanded = isActive && expandedCatId === cat.id;
                return (
                  <div key={cat.id}>
                    <div className="flex items-center gap-0.5">
                      {reorderMode && (
                        <div className="flex shrink-0 flex-col">
                          <button
                            type="button"
                            onClick={() => handleMove(idx, 'up')}
                            disabled={idx === 0}
                            aria-label={t('nav.sidebar.moveUp', { name: cat.name })}
                            className={cn(
                              'flex size-5 items-center justify-center rounded-md text-sidebar-foreground/45 transition-colors hover:bg-primary/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-20',
                              focusRing,
                            )}
                          >
                            <ChevronUp aria-hidden="true" className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMove(idx, 'down')}
                            disabled={idx === categoryStats.length - 1}
                            aria-label={t('nav.sidebar.moveDown', { name: cat.name })}
                            className={cn(
                              'flex size-5 items-center justify-center rounded-md text-sidebar-foreground/45 transition-colors hover:bg-primary/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-20',
                              focusRing,
                            )}
                          >
                            <ChevronDown aria-hidden="true" className="size-3" />
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (isActive && hasLibraries) { setExpandedCatId(isExpanded ? null : cat.id); }
                          else { navigate(catPath); if (hasLibraries) setExpandedCatId(cat.id); else setExpandedCatId(null); }
                          setExpandedLibId(null);
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        aria-expanded={hasLibraries ? isExpanded : undefined}
                        className={cn(getSecondaryNavClass(isActive), 'min-w-0 flex-1')}
                      >
                        <NavIconTile icon={Icon} active={isActive} />
                        <span className="min-w-0 flex-1 truncate">{cat.name}</span>
                        <CountBadge value={cat.count} />
                      </button>
                    </div>
                    {isExpanded && (() => {
                      const catItems = getCategoryItems(cat.id);
                      const allExpanded = expandedLibId === '_all_' + cat.id;
                      const unassignedExpanded = expandedLibId === '_unassigned_' + cat.id;
                      return (
                        <div className="ml-10 space-y-1 border-l border-border/60 py-1 pl-3">
                          <div>
                            <button
                              type="button"
                              onClick={() => setExpandedLibId(allExpanded ? null : '_all_' + cat.id)}
                              aria-expanded={allExpanded}
                              className={getTreeNavClass(isActive && activeLibraryParam === 'all')}
                            >
                              <FolderOpen aria-hidden="true" className="size-3.5 shrink-0" />
                              <span className="min-w-0 flex-1 truncate">{t('common.all')}</span>
                              <CountBadge value={cat.count} small />
                            </button>
                            {allExpanded && (
                              <SidebarItemList
                                items={catItems}
                                catPath={catPath}
                                navigate={navigate}
                                libraryParam="all"
                                activeItemId={activeDetailItemId}
                              />
                            )}
                          </div>
                          {cat.libraries.map((lib) => {
                            const libExpanded = expandedLibId === lib.id;
                            const libItems = catItems.filter((i) => i.libraryId === lib.id);
                            const libActive = isActive && activeLibraryParam === lib.id;
                            return (
                              <div key={lib.id}>
                                <button
                                  type="button"
                                  onClick={() => setExpandedLibId(libExpanded ? null : lib.id)}
                                  aria-expanded={libExpanded}
                                  className={getTreeNavClass(libActive)}
                                >
                                  <Library aria-hidden="true" className="size-3.5 shrink-0" />
                                  <span className="min-w-0 flex-1 truncate">{lib.name}</span>
                                  <CountBadge value={lib.count} small />
                                </button>
                                {libExpanded && (
                                  <SidebarItemList
                                    items={libItems}
                                    catPath={catPath}
                                    navigate={navigate}
                                    libraryParam={lib.id}
                                    activeItemId={activeDetailItemId}
                                  />
                                )}
                              </div>
                            );
                          })}
                          <div>
                            <button
                              type="button"
                              onClick={() => setExpandedLibId(unassignedExpanded ? null : '_unassigned_' + cat.id)}
                              aria-expanded={unassignedExpanded}
                              className={getTreeNavClass(isActive && activeLibraryParam === 'unassigned')}
                            >
                              <Inbox aria-hidden="true" className="size-3.5 shrink-0" />
                              <span className="min-w-0 flex-1 truncate">{t('nav.sidebar.unassigned')}</span>
                              <CountBadge value={cat.unassignedCount} small />
                            </button>
                            {unassignedExpanded && (
                              <SidebarItemList
                                items={catItems.filter((item) => isItemUnassignedForCategory(item, cat.id, libraries))}
                                catPath={catPath}
                                navigate={navigate}
                                libraryParam="unassigned"
                                activeItemId={activeDetailItemId}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </nav>

            {savedViews.length > 0 && (
              <>
                <Separator className="my-4 opacity-60" />
                <SectionHeader label={t('nav.savedViews')} count={savedViews.length} />
                <nav className="space-y-0.5" aria-label={t('nav.savedViews')}>
                  {savedViews.map((view) => {
                    const href = getSavedViewHref(view, categories);
                    if (!href) return null;
                    const isActive = `${location.pathname}${location.search}` === href;
                    return (
                      <button
                        type="button"
                        key={view.id}
                        onClick={() => navigate(href)}
                        aria-current={isActive ? 'page' : undefined}
                        className={getSecondaryNavClass(isActive)}
                      >
                        <NavIconTile icon={Bookmark} active={isActive} />
                        <span className="min-w-0 flex-1 truncate">{view.name}</span>
                      </button>
                    );
                  })}
                </nav>
              </>
            )}
          </>
        )}
      </ScrollArea>

    </aside>
    </>
  );
};

export default Sidebar;
