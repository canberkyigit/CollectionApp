import { useCallback, useMemo, useState, useEffect } from 'react';
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
  Library,
  BookOpen,
  Inbox,
  Search,
} from 'lucide-react';
import brandLogo from '@/assets/logo.png';
import { getCategoryIcon } from '@/lib/icons';
import { isItemUnassignedForCategory, libraryMatchesCategory } from '@/lib/libraries';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VirtualList } from '@/components/shared';
import { useCollectionStore } from '@/store/useCollectionStore';

const baseNavItems = [
  { label: 'Collections', icon: FolderOpen, path: '/collections' },
  { label: 'Statistics', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Favorites', icon: Star, path: '/favorites' },
  { label: 'Wishlist', icon: Heart, path: '/wishlist' },
  { label: 'Lending', icon: Send, path: '/lending' },
  { label: 'Contributors', icon: Users, path: '/contributors' },
  { label: 'Activity', icon: Clock, path: '/activity' },
];

import type { CollectionItem } from '@/types';

const VIRTUAL_THRESHOLD = 80;

function getPrimaryNavClass(isActive: boolean) {
  return cn(
    'group relative flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-sm font-medium transition-all duration-200',
    isActive
      ? 'surface-brand border-primary/25 text-surface-brand-foreground'
      : 'border-transparent text-sidebar-foreground/85 hover:surface-1 hover:-translate-y-px hover:text-foreground',
  );
}

function getSecondaryNavClass(isActive: boolean) {
  return cn(
    'group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all duration-200',
    isActive
      ? 'surface-2 border-primary/20 text-primary shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05)]'
      : 'border-transparent text-sidebar-foreground/80 hover:surface-1 hover:text-foreground',
  );
}

function getTreeNavClass(isActive: boolean) {
  return cn(
    'group flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-[13px] transition-all duration-200',
    isActive
      ? 'surface-2 border-primary/18 text-primary'
      : 'border-transparent text-sidebar-foreground/78 hover:surface-1 hover:text-foreground',
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
  if (listItems.length === 0) {
    return (
      <p className="px-3 py-1.5 text-xs text-muted-foreground/60 italic">No items</p>
    );
  }

  const buildDetailPath = (itemId: string) => {
    const params = new URLSearchParams();
    if (libraryParam) {
      params.set('library', libraryParam);
    }
    params.set('detail', itemId);
    return `${catPath}?${params.toString()}`;
  };

  const renderItemButton = (item: CollectionItem) => (
    <button
      onClick={() => navigate(buildDetailPath(item.id))}
      className={cn(
        'group flex w-full items-start gap-2 rounded-lg border border-transparent px-2 py-1.5 text-xs transition-all duration-200',
        activeItemId === item.id
          ? 'surface-2 border-primary/15 text-primary'
          : 'text-sidebar-foreground/70 hover:surface-1 hover:text-foreground',
      )}
    >
      <BookOpen className="mt-0.5 size-3 shrink-0 opacity-50 transition-transform duration-200 group-hover:translate-x-0.5" />
      <span className="text-left leading-snug">{item.title}</span>
    </button>
  );

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

const Sidebar = () => {
  const sidebarOpen = useCollectionStore((s) => s.sidebarOpen);
  const menuCollectionStyle = useCollectionStore((s) => s.menuCollectionStyle) ?? 'style1';
  const categories = useCollectionStore((s) => s.categories);
  const items = useCollectionStore((s) => s.items);
  const reorderCategories = useCollectionStore((s) => s.reorderCategories);
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
  const navItems = useMemo(() => baseNavItems, []);
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
          onClick={() => useCollectionStore.setState({ sidebarOpen: false })}
        />
      )}
    </AnimatePresence>
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border/70 bg-sidebar/95 shadow-[18px_0_40px_rgb(0_0_0_/_0.08)] backdrop-blur-xl transition-all duration-300 ease-in-out',
        'fixed inset-y-0 left-0 z-50 md:relative md:z-auto',
        sidebarOpen ? 'w-64' : 'w-0 overflow-hidden',
      )}
    >
      <div className="desktop-titlebar-drag relative flex h-16 items-center overflow-hidden border-b border-border/70 px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative flex w-full items-center gap-3">
          <div className="flex h-14 w-20 shrink-0 items-center justify-center">
            <img src={brandLogo} alt="ESÇ logo" className="h-full w-full scale-[1.02] object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="brand-title-premium block text-[17px] leading-tight" data-text="ESÇ">
              ESÇ
            </span>
            <div className="mt-0.5 flex items-center">
              <span
                className="brand-subtitle-premium whitespace-nowrap text-[12px]"
                data-text="Private Collection"
              >
                Private Collection
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
          const label = isAll ? 'All' : isUnassigned ? 'Unassigned' : lib?.name ?? '';
          const drillItems = isAll
            ? getCategoryItems(cat.id)
            : isUnassigned
              ? getCategoryItems(cat.id).filter((item) => isItemUnassignedForCategory(item, cat.id, libraries))
              : getCategoryItems(cat.id).filter((i) => i.libraryId === activeDrillLibId);

          const textFields = (cat.fields ?? []).filter(
            (f) => (f.type === 'text' || f.type === 'select') && f.key !== 'title',
          );

          const searchFiltered = sidebarSearch
            ? drillItems.filter((item) => {
                const q = sidebarSearch.toLowerCase();
                if (item.title.toLowerCase().includes(q)) return true;
                return textFields.some((f) => {
                  const val = item.customFields?.[f.key];
                  return typeof val === 'string' && val.toLowerCase().includes(q);
                });
              })
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
          const renderDrillItem = (item: CollectionItem) => (
            <button
              onClick={() => navigate(`${catPath}?library=${libraryParam}&detail=${item.id}`)}
              className={cn(
                'group flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all duration-200',
                activeDetailItemId === item.id
                  ? 'surface-2 border-primary/18 text-primary'
                  : 'border-transparent text-sidebar-foreground/80 hover:surface-1 hover:text-foreground',
              )}
            >
              <BookOpen className="mt-0.5 size-3.5 shrink-0 opacity-50 transition-transform duration-200 group-hover:translate-x-0.5" />
              <span className="text-left leading-snug">{item.title}</span>
            </button>
          );

          return (
            <>
              {/* Back button */}
              <button
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
                className="mb-3 flex w-full items-center gap-2 rounded-2xl border border-transparent px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-all duration-200 hover:surface-1 hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
                <span>{showGroupItems ? groupField.label : cat.name}</span>
              </button>

              {/* Header: label */}
              <div className="mb-3 flex items-center gap-2 px-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/60">
                  {showGroupItems ? drillGroupValue : label}
                </span>
                <Badge variant="secondary" className="h-5 rounded-full border border-border/60 bg-background/55 px-1.5 text-[10px]">
                  {showGroupItems ? groupItems.length : searchFiltered.length}
                </Badge>
              </div>

              {/* Group dropdown */}
              {!showGroupItems && textFields.length > 0 && (
                <div className="mb-2 px-3">
                  <select
                    value={groupByField}
                    onChange={(e) => { setGroupByField(e.target.value); setDrillGroupValue(null); }}
                    className="surface-1 h-8 w-full rounded-xl border px-3 text-xs text-sidebar-foreground outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="title">Title</option>
                    {textFields.map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search */}
              {!showGroupItems && (
                <div className="relative mb-2 px-3">
                  <Search className="absolute left-5 top-1/2 size-3.5 -translate-y-1/2 text-sidebar-foreground/55" />
                  <input
                    type="text"
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    placeholder="Search..."
                    className="surface-1 h-9 w-full rounded-xl border pl-8 pr-3 text-xs outline-none placeholder:text-sidebar-foreground/50 focus:ring-1 focus:ring-ring"
                  />
                </div>
              )}

              {/* Content */}
              <nav className="space-y-0.5">
                {showGroupItems ? (
                  groupItems.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-muted-foreground/60 italic">No items</p>
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
                    <p className="px-3 py-3 text-xs text-muted-foreground/60 italic">No groups found</p>
                  ) : (
                    groupedEntries.map((g) => (
                      <button
                        key={g.key}
                        onClick={() => setDrillGroupValue(g.key)}
                        className="flex w-full items-center gap-2 rounded-xl border border-transparent px-3 py-2.5 text-sm text-sidebar-foreground/80 transition-all duration-200 hover:surface-1 hover:text-foreground"
                      >
                        <Layers className="size-3.5 shrink-0 opacity-50" />
                        <span className="flex-1 text-left leading-snug">{g.label}</span>
                        <Badge variant="secondary" className="h-5 rounded-full border border-border/60 bg-background/55 px-1.5 text-[10px]">{g.count}</Badge>
                      </button>
                    ))
                  )
                ) : searchFiltered.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground/60 italic">
                    {sidebarSearch ? 'No results' : 'No items in this library'}
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
              <button
                onClick={() => navigate('/collections')}
                className="mb-3 flex w-full items-center gap-2 rounded-2xl border border-transparent px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-all duration-200 hover:surface-1 hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
                <span>Collections</span>
              </button>

              <div className="mb-3 flex items-center gap-2 px-3">
                <div className="flex size-8 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <CatIcon className="size-4" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/60">
                  {cat.name}
                </span>
                <Badge variant="secondary" className="h-5 rounded-full border border-border/60 bg-background/55 px-1.5 text-[10px]">{cat.count}</Badge>
              </div>

              <nav className="space-y-0.5">
                <button
                  onClick={() => navigate(`${catPath}?library=all`)}
                  className={getSecondaryNavClass(activeLibraryParam === 'all')}
                >
                  <span className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors',
                    activeLibraryParam === 'all' ? 'bg-white/12 text-current' : 'bg-primary/10 text-primary',
                  )}>
                    <FolderOpen className="size-4 shrink-0" />
                  </span>
                  <span className="flex-1 text-left">All</span>
                  <Badge variant="secondary" className="h-5 min-w-[1.25rem] justify-center rounded-full border border-border/60 bg-background/55 px-1.5 text-[10px]">{cat.count}</Badge>
                </button>
                {cat.libraries.map((lib) => (
                  <button
                    key={lib.id}
                    onClick={() => navigate(`${catPath}?library=${lib.id}`)}
                    className={getSecondaryNavClass(activeLibraryParam === lib.id)}
                  >
                    <span className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors',
                      activeLibraryParam === lib.id ? 'bg-white/12 text-current' : 'bg-primary/10 text-primary',
                    )}>
                      <Library className="size-4 shrink-0" />
                    </span>
                    <span className="flex-1 text-left truncate">{lib.name}</span>
                    <Badge variant="secondary" className="h-5 min-w-[1.25rem] justify-center rounded-full border border-border/60 bg-background/55 px-1.5 text-[10px]">{lib.count}</Badge>
                  </button>
                ))}
                <button
                  onClick={() => navigate(`${catPath}?library=unassigned`)}
                  className={getSecondaryNavClass(activeLibraryParam === 'unassigned')}
                >
                  <span className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors',
                    activeLibraryParam === 'unassigned' ? 'bg-white/12 text-current' : 'bg-primary/10 text-primary',
                  )}>
                    <Inbox className="size-4 shrink-0" />
                  </span>
                  <span className="flex-1 text-left">Unassigned</span>
                  <Badge variant="secondary" className="h-5 min-w-[1.25rem] justify-center rounded-full border border-border/60 bg-background/55 px-1.5 text-[10px]">{cat.unassignedCount}</Badge>
                </button>
              </nav>
            </>
          );
        })()

        /* ── Default: Top nav + Collections list (Style 1 tree or Style 2 flat) ── */
        : (
          <>
            <nav className="space-y-0.5">
              {navItems.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  location.pathname.startsWith(item.path + '/');
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={getPrimaryNavClass(isActive)}
                  >
                    <span className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors',
                      isActive ? 'bg-white/12 text-current' : 'bg-primary/10 text-primary',
                    )}>
                      <Icon className="h-4 w-4 shrink-0" />
                    </span>
                    <span className="truncate">{item.label}</span>
                    {isActive && (
                      <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />
                    )}
                  </button>
                );
              })}
            </nav>

            <Separator className="my-4 opacity-60" />

            <div className="mb-2 flex items-center justify-between px-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/60">
                Collections
              </span>
              <div className="flex items-center gap-1">
                {menuCollectionStyle === 'style1' && (
                  <button
                    onClick={() => setReorderMode((v) => !v)}
                    className={cn(
                      'flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-medium transition-colors',
                      reorderMode ? 'border-primary/20 bg-primary/10 text-primary' : 'border-transparent text-sidebar-foreground/65 hover:border-border/70 hover:text-foreground',
                    )}
                    title={reorderMode ? 'Done reordering' : 'Reorder categories'}
                  >
                    <GripVertical className="size-3" />
                    {reorderMode ? 'Done' : ''}
                  </button>
                )}
                <Badge variant="secondary" className="h-5 rounded-full border border-border/60 bg-background/55 px-1.5 text-[10px]">
                  {categories.length}
                </Badge>
              </div>
            </div>

            <nav className="space-y-0.5">
              {categoryStats.map((cat, idx) => {
                const Icon = getCategoryIcon(cat.icon);
                const catPath = `/collections/${cat.slug}`;
                const isActive = location.pathname === catPath;
                const hasLibraries = cat.libraries.length > 0;

                if (menuCollectionStyle === 'style2') {
                  return (
                    <button
                      key={cat.id}
                      onClick={() => navigate(catPath)}
                      className={getSecondaryNavClass(isActive)}
                    >
                      <span className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors',
                        isActive ? 'bg-primary/12 text-current' : 'bg-primary/10 text-primary',
                      )}>
                        <Icon className="h-4 w-4 shrink-0" />
                      </span>
                      <span className="flex-1 truncate text-left">{cat.name}</span>
                      {hasLibraries && <ChevronRight className="size-3.5 opacity-40" />}
                      <Badge variant="secondary" className="h-5 min-w-[1.25rem] justify-center rounded-full border border-border/60 bg-background/55 px-1.5 text-[10px]">{cat.count}</Badge>
                    </button>
                  );
                }

                const isExpanded = isActive && expandedCatId === cat.id;
                return (
                  <div key={cat.id}>
                    <div className="flex items-center gap-0.5">
                      {reorderMode && (
                        <div className="flex shrink-0 flex-col">
                          <button onClick={() => handleMove(idx, 'up')} disabled={idx === 0} className="flex size-4 items-center justify-center rounded text-sidebar-foreground/45 transition-colors hover:text-foreground disabled:opacity-20"><ChevronUp className="size-3" /></button>
                          <button onClick={() => handleMove(idx, 'down')} disabled={idx === categoryStats.length - 1} className="flex size-4 items-center justify-center rounded text-sidebar-foreground/45 transition-colors hover:text-foreground disabled:opacity-20"><ChevronDown className="size-3" /></button>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          if (isActive && hasLibraries) { setExpandedCatId(isExpanded ? null : cat.id); }
                          else { navigate(catPath); if (hasLibraries) setExpandedCatId(cat.id); else setExpandedCatId(null); }
                          setExpandedLibId(null);
                        }}
                        className={getSecondaryNavClass(isActive)}
                      >
                        <span className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors',
                          isActive ? 'bg-primary/12 text-current' : 'bg-primary/10 text-primary',
                        )}>
                          <Icon className="h-4 w-4 shrink-0" />
                        </span>
                        <span className="flex-1 truncate text-left">{cat.name}</span>
                        <Badge variant="secondary" className="h-5 min-w-[1.25rem] justify-center rounded-full border border-border/60 bg-background/55 px-1.5 text-[10px]">{cat.count}</Badge>
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
                              onClick={() => setExpandedLibId(allExpanded ? null : '_all_' + cat.id)}
                              className={getTreeNavClass(isActive && activeLibraryParam === 'all')}
                            >
                              <FolderOpen className="size-3.5 shrink-0" />
                              <span className="flex-1 truncate text-left">All</span>
                              <Badge variant="secondary" className="h-4 rounded-full border border-border/60 bg-background/55 px-1 text-[10px]">{cat.count}</Badge>
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
                            return (
                              <div key={lib.id}>
                                <button
                                  onClick={() => setExpandedLibId(libExpanded ? null : lib.id)}
                                  className={getTreeNavClass(isActive && activeLibraryParam === lib.id)}
                                >
                                  <Library className="size-3.5 shrink-0" />
                                  <span className="flex-1 truncate text-left">{lib.name}</span>
                                  <Badge variant="secondary" className="h-4 rounded-full border border-border/60 bg-background/55 px-1 text-[10px]">{lib.count}</Badge>
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
                              onClick={() => setExpandedLibId(unassignedExpanded ? null : '_unassigned_' + cat.id)}
                              className={getTreeNavClass(isActive && activeLibraryParam === 'unassigned')}
                            >
                              <Inbox className="size-3.5 shrink-0" />
                              <span className="flex-1 truncate text-left">Unassigned</span>
                              <Badge variant="secondary" className="h-4 rounded-full border border-border/60 bg-background/55 px-1 text-[10px]">{cat.unassignedCount}</Badge>
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
          </>
        )}
      </ScrollArea>

    </aside>
    </>
  );
};

export default Sidebar;
