import { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  LayoutDashboard,
  FolderOpen,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Heart,
  Star,
  Send,
  Clock,
  Download,
  Library,
  BookOpen,
  Inbox,
  Search,
} from 'lucide-react';
import { getCategoryIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCollectionStore } from '@/store/useCollectionStore';

const navItems = [
  { label: 'Collections', icon: FolderOpen, path: '/collections' },
  { label: 'Statistics', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Favorites', icon: Star, path: '/favorites' },
  { label: 'Wishlist', icon: Heart, path: '/wishlist' },
  { label: 'Lending', icon: Send, path: '/lending' },
  { label: 'Contributors', icon: Users, path: '/contributors' },
  { label: 'Activity', icon: Clock, path: '/activity' },
  { label: 'Admin', icon: Settings, path: '/admin' },
];

import type { CollectionItem } from '@/types';

function SidebarItemList({
  items: listItems,
  catPath,
  navigate,
}: {
  items: CollectionItem[];
  catPath: string;
  navigate: (path: string) => void;
}) {
  if (listItems.length === 0) {
    return (
      <p className="px-3 py-1.5 text-xs text-muted-foreground/60 italic">No items</p>
    );
  }
  return (
    <div className="ml-3 space-y-px border-l border-border/50 py-0.5 pl-2">
      {listItems.map((item) => (
        <button
          key={item.id}
          onClick={() => navigate(`${catPath}?detail=${item.id}`)}
          className="flex w-full items-start gap-1.5 rounded px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <BookOpen className="size-3 shrink-0 mt-0.5 opacity-50" />
          <span className="text-left leading-snug">{item.title}</span>
        </button>
      ))}
    </div>
  );
}

const Sidebar = () => {
  const sidebarOpen = useCollectionStore((s) => s.sidebarOpen);
  const menuCollectionStyle = useCollectionStore((s) => s.menuCollectionStyle) ?? 'style1';
  const categories = useCollectionStore((s) => s.categories);
  const items = useCollectionStore((s) => s.items);
  const getItemsByCategory = useCollectionStore((s) => s.getItemsByCategory);
  const reorderCategories = useCollectionStore((s) => s.reorderCategories);
  const location = useLocation();
  const navigate = useNavigate();
  const [reorderMode, setReorderMode] = useState(false);
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [expandedLibId, setExpandedLibId] = useState<string | null>(null);

  // Style 2 drill-in state
  const [drillCatId, setDrillCatId] = useState<string | null>(null);
  const [drillLibId, setDrillLibId] = useState<string | null>(null);
  const [groupByField, setGroupByField] = useState<string>('title');
  const [drillGroupValue, setDrillGroupValue] = useState<string | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState('');

  const libraries = useCollectionStore((s) => s.libraries);

  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches && useCollectionStore.getState().sidebarOpen) {
      useCollectionStore.setState({ sidebarOpen: false });
    }
  }, [location.pathname]);

  // Reset drill-in state when switching to Style 1
  useEffect(() => {
    if (menuCollectionStyle === 'style1') {
      setDrillCatId(null);
      setDrillLibId(null);
    }
  }, [menuCollectionStyle]);

  // Auto-drill into category when URL matches and Style 2 is active
  useEffect(() => {
    if (menuCollectionStyle !== 'style2') return;
    const match = location.pathname.match(/^\/collections\/([^/]+)$/);
    if (match) {
      const slug = match[1];
      const cat = categories.find((c) => c.slug === slug);
      if (cat) {
        const hasLibs = libraries.some((l) => l.categoryId === cat.id);
        if (hasLibs && drillCatId !== cat.id) {
          setDrillCatId(cat.id);
          setDrillLibId(null);
        }
      }
    }
  }, [location.pathname, menuCollectionStyle, categories, libraries]);

  const categoryStats = useMemo(
    () =>
      [...categories]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((cat) => {
          const catItems = getItemsByCategory(cat.id);
          return {
            ...cat,
            count: catItems.length,
            unassignedCount: catItems.filter((i) => !i.libraryId).length,
            libraries: libraries
              .filter((l) => l.categoryId === cat.id)
              .sort((a, b) => a.order - b.order)
              .map((lib) => ({
                ...lib,
                count: catItems.filter((i) => i.libraryId === lib.id).length,
              })),
          };
        }),
    [categories, items, libraries, getItemsByCategory],
  );

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const ids = categoryStats.map((c) => c.id);
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= ids.length) return;
    [ids[index], ids[swapIdx]] = [ids[swapIdx], ids[index]];
    reorderCategories(ids);
  };

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
        'flex h-full flex-col bg-sidebar border-r border-border transition-all duration-300 ease-in-out',
        'fixed inset-y-0 left-0 z-50 md:relative md:z-auto',
        sidebarOpen ? 'w-64' : 'w-0 overflow-hidden',
      )}
    >
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
          <Layers className="h-5 w-5 text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold tracking-tight text-foreground">
            CollectVault
          </span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Premium
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        {/* ── Drill-in: Library items view (Style 2 only) ── */}
        {menuCollectionStyle === 'style2' && drillCatId && drillLibId ? (() => {
          const cat = categoryStats.find((c) => c.id === drillCatId);
          if (!cat) return null;
          const catPath = `/collections/${cat.slug}`;
          const isAll = drillLibId === '_all';
          const isUnassigned = drillLibId === '_unassigned';
          const lib = cat.libraries.find((l) => l.id === drillLibId);
          const label = isAll ? 'All' : isUnassigned ? 'Unassigned' : lib?.name ?? '';
          const drillItems = isAll
            ? getItemsByCategory(cat.id)
            : isUnassigned
              ? getItemsByCategory(cat.id).filter((i) => !i.libraryId)
              : getItemsByCategory(cat.id).filter((i) => i.libraryId === drillLibId);

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

          return (
            <>
              {/* Back button */}
              <button
                onClick={() => {
                  if (showGroupItems) {
                    setDrillGroupValue(null);
                  } else {
                    setDrillLibId(null);
                    setGroupByField('none');
                    setDrillGroupValue(null);
                    setSidebarSearch('');
                  }
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-2"
              >
                <ChevronLeft className="size-4" />
                <span>{showGroupItems ? groupField.label : cat.name}</span>
              </button>

              {/* Header: label */}
              <div className="mb-2 px-3 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {showGroupItems ? drillGroupValue : label}
                </span>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {showGroupItems ? groupItems.length : searchFiltered.length}
                </Badge>
              </div>

              {/* Group dropdown */}
              {!showGroupItems && textFields.length > 0 && (
                <div className="mb-2 px-3">
                  <select
                    value={groupByField}
                    onChange={(e) => { setGroupByField(e.target.value); setDrillGroupValue(null); }}
                    className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
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
                  <Search className="absolute left-5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
                  <input
                    type="text"
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    placeholder="Search..."
                    className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-ring"
                  />
                </div>
              )}

              {/* Content */}
              <nav className="space-y-0.5">
                {showGroupItems ? (
                  groupItems.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-muted-foreground/60 italic">No items</p>
                  ) : (
                    groupItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => navigate(`${catPath}?detail=${item.id}`)}
                        className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <BookOpen className="size-3.5 shrink-0 mt-0.5 opacity-50" />
                        <span className="text-left leading-snug">{item.title}</span>
                      </button>
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
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <Layers className="size-3.5 shrink-0 opacity-50" />
                        <span className="flex-1 text-left leading-snug">{g.label}</span>
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{g.count}</Badge>
                      </button>
                    ))
                  )
                ) : searchFiltered.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground/60 italic">
                    {sidebarSearch ? 'No results' : 'No items in this library'}
                  </p>
                ) : (
                  searchFiltered.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => navigate(`${catPath}?detail=${item.id}`)}
                      className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <BookOpen className="size-3.5 shrink-0 mt-0.5 opacity-50" />
                      <span className="text-left leading-snug">{item.title}</span>
                    </button>
                  ))
                )}
              </nav>
            </>
          );
        })()

        /* ── Style 2 Drill-in: Libraries view (Style 2 only) ── */
        : menuCollectionStyle === 'style2' && drillCatId ? (() => {
          const cat = categoryStats.find((c) => c.id === drillCatId);
          if (!cat) return null;
          const catPath = `/collections/${cat.slug}`;
          const CatIcon = getCategoryIcon(cat.icon);

          return (
            <>
              <button
                onClick={() => { setDrillCatId(null); setDrillLibId(null); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-2"
              >
                <ChevronLeft className="size-4" />
                <span>Collections</span>
              </button>

              <div className="mb-2 flex items-center gap-2 px-3">
                <CatIcon className="size-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {cat.name}
                </span>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{cat.count}</Badge>
              </div>

              <nav className="space-y-0.5">
                <button
                  onClick={() => { setDrillLibId('_all'); navigate(`${catPath}?library=all`); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <FolderOpen className="size-4 shrink-0" />
                  <span className="flex-1 text-left">All</span>
                  <Badge variant="secondary" className="h-5 min-w-[1.25rem] justify-center px-1.5 text-[10px]">{cat.count}</Badge>
                </button>
                {cat.libraries.map((lib) => (
                  <button
                    key={lib.id}
                    onClick={() => { setDrillLibId(lib.id); navigate(`${catPath}?library=${lib.id}`); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Library className="size-4 shrink-0" />
                    <span className="flex-1 text-left truncate">{lib.name}</span>
                    <Badge variant="secondary" className="h-5 min-w-[1.25rem] justify-center px-1.5 text-[10px]">{lib.count}</Badge>
                  </button>
                ))}
                <button
                  onClick={() => { setDrillLibId('_unassigned'); navigate(`${catPath}?library=unassigned`); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Inbox className="size-4 shrink-0" />
                  <span className="flex-1 text-left">Unassigned</span>
                  <Badge variant="secondary" className="h-5 min-w-[1.25rem] justify-center px-1.5 text-[10px]">{cat.unassignedCount}</Badge>
                </button>
              </nav>
            </>
          );
        })()

        /* ── Default: Top nav + Collections list (Style 1 tree or Style 2 flat) ── */
        : (
          <>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  location.pathname.startsWith(item.path + '/');
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={cn(
                      'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                    )}
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {isActive && (
                      <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />
                    )}
                  </button>
                );
              })}
            </nav>

            <Separator className="my-4" />

            <div className="mb-2 flex items-center justify-between px-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Collections
              </span>
              <div className="flex items-center gap-1">
                {menuCollectionStyle === 'style1' && (
                  <button
                    onClick={() => setReorderMode((v) => !v)}
                    className={cn(
                      'flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-medium transition-colors',
                      reorderMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
                    )}
                    title={reorderMode ? 'Done reordering' : 'Reorder categories'}
                  >
                    <GripVertical className="size-3" />
                    {reorderMode ? 'Done' : ''}
                  </button>
                )}
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
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
                      onClick={() => {
                        navigate(catPath);
                        if (hasLibraries) { setDrillCatId(cat.id); setDrillLibId(null); }
                      }}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate text-left">{cat.name}</span>
                      {hasLibraries && <ChevronRight className="size-3.5 opacity-40" />}
                      <Badge variant="secondary" className="h-5 min-w-[1.25rem] justify-center px-1.5 text-[10px]">{cat.count}</Badge>
                    </button>
                  );
                }

                const isExpanded = isActive && expandedCatId === cat.id;
                return (
                  <div key={cat.id}>
                    <div className="flex items-center gap-0.5">
                      {reorderMode && (
                        <div className="flex shrink-0 flex-col">
                          <button onClick={() => handleMove(idx, 'up')} disabled={idx === 0} className="flex size-4 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:text-foreground disabled:opacity-20"><ChevronUp className="size-3" /></button>
                          <button onClick={() => handleMove(idx, 'down')} disabled={idx === categoryStats.length - 1} className="flex size-4 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:text-foreground disabled:opacity-20"><ChevronDown className="size-3" /></button>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          if (isActive && hasLibraries) { setExpandedCatId(isExpanded ? null : cat.id); }
                          else { navigate(catPath); if (hasLibraries) setExpandedCatId(cat.id); else setExpandedCatId(null); }
                          setExpandedLibId(null);
                        }}
                        className={cn(
                          'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate text-left">{cat.name}</span>
                        <Badge variant="secondary" className="h-5 min-w-[1.25rem] justify-center px-1.5 text-[10px]">{cat.count}</Badge>
                      </button>
                    </div>
                    {isExpanded && (() => {
                      const catItems = getItemsByCategory(cat.id);
                      const allExpanded = expandedLibId === '_all_' + cat.id;
                      const unassignedExpanded = expandedLibId === '_unassigned_' + cat.id;
                      return (
                        <div className="ml-9 space-y-0.5 border-l border-border py-1 pl-2">
                          <div>
                            <button
                              onClick={() => setExpandedLibId(allExpanded ? null : '_all_' + cat.id)}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            >
                              <FolderOpen className="size-3.5 shrink-0" />
                              <span className="flex-1 truncate text-left">All</span>
                              <Badge variant="secondary" className="h-4 px-1 text-[10px]">{cat.count}</Badge>
                            </button>
                            {allExpanded && (
                              <SidebarItemList items={catItems} catPath={catPath} navigate={navigate} />
                            )}
                          </div>
                          {cat.libraries.map((lib) => {
                            const libExpanded = expandedLibId === lib.id;
                            const libItems = catItems.filter((i) => i.libraryId === lib.id);
                            return (
                              <div key={lib.id}>
                                <button
                                  onClick={() => setExpandedLibId(libExpanded ? null : lib.id)}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                >
                                  <Library className="size-3.5 shrink-0" />
                                  <span className="flex-1 truncate text-left">{lib.name}</span>
                                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">{lib.count}</Badge>
                                </button>
                                {libExpanded && (
                                  <SidebarItemList items={libItems} catPath={catPath} navigate={navigate} />
                                )}
                              </div>
                            );
                          })}
                          <div>
                            <button
                              onClick={() => setExpandedLibId(unassignedExpanded ? null : '_unassigned_' + cat.id)}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            >
                              <Inbox className="size-3.5 shrink-0" />
                              <span className="flex-1 truncate text-left">Unassigned</span>
                              <Badge variant="secondary" className="h-4 px-1 text-[10px]">{cat.unassignedCount}</Badge>
                            </button>
                            {unassignedExpanded && (
                              <SidebarItemList items={catItems.filter((i) => !i.libraryId)} catPath={catPath} navigate={navigate} />
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

      <Separator />

      <div className="shrink-0 space-y-0.5 p-3">
        <button
          onClick={() => navigate('/export')}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            location.pathname === '/export'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <Download className="h-4 w-4 shrink-0" />
          <span>Import / Export</span>
        </button>
        <button
          onClick={() => navigate('/settings')}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            location.pathname === '/settings'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
