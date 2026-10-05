import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Clock,
  Presentation,
  CornerDownLeft,
  FolderOpen,
  Heart,
  Languages,
  LayoutDashboard,
  Library as LibraryIcon,
  Moon,
  Package,
  Plus,
  ScanQrCode,
  Search,
  Send,
  Settings,
  Star,
  Sun,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { getCategoryIcon } from '@/lib/icons';
import { libraryMatchesCategory } from '@/lib/libraries';
import { canEditContent } from '@/lib/permissions';
import {
  describeSearchMatch,
  matchesQuery,
  searchCategories,
  searchItems,
  searchLibraries,
} from '@/lib/search';
import { cn } from '@/lib/utils';
import { LANGUAGES, useLanguageStore, useT } from '@/i18n';
import { useAuthStore } from '@/store/useAuthStore';
import { useCollectionStore } from '@/store/useCollectionStore';

type PaletteGroup = 'items' | 'categories' | 'libraries' | 'navigation' | 'actions';

interface PaletteEntry {
  id: string;
  group: PaletteGroup;
  label: string;
  hint?: string;
  icon: LucideIcon;
  /** Extra words (both languages) that should find this command. */
  keywords?: string;
  run: () => void;
}

const GROUP_ORDER: PaletteGroup[] = ['items', 'categories', 'libraries', 'navigation', 'actions'];

const GROUP_LABEL_KEYS: Record<PaletteGroup, string> = {
  items: 'nav.search.items',
  categories: 'nav.search.categories',
  libraries: 'nav.search.libraries',
  navigation: 'nav.palette.goTo',
  actions: 'nav.palette.actions',
};

const NAV_COMMANDS: { id: string; labelKey: string; path: string; icon: LucideIcon; keywords: string }[] = [
  { id: 'collections', labelKey: 'nav.collections', path: '/collections', icon: FolderOpen, keywords: 'collections koleksiyonlar categories' },
  { id: 'dashboard', labelKey: 'nav.statistics', path: '/dashboard', icon: LayoutDashboard, keywords: 'statistics dashboard istatistikler pano' },
  { id: 'favorites', labelKey: 'nav.favorites', path: '/favorites', icon: Star, keywords: 'favorites starred favoriler' },
  { id: 'wishlist', labelKey: 'nav.wishlist', path: '/wishlist', icon: Heart, keywords: 'wishlist istek listesi' },
  { id: 'lending', labelKey: 'nav.lending', path: '/lending', icon: Send, keywords: 'lending loans borrowed odunc' },
  { id: 'activity', labelKey: 'nav.activity', path: '/activity', icon: Clock, keywords: 'activity log history etkinlik gecmis' },
  { id: 'exhibition', labelKey: 'nav.exhibition', path: '/exhibition', icon: Presentation, keywords: 'exhibition slideshow present showcase sergi sunum slayt' },
  { id: 'settings', labelKey: 'nav.settings', path: '/settings', icon: Settings, keywords: 'settings preferences ayarlar' },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the QR/barcode "scan to open" dialog. */
  onScan?: () => void;
}

export function CommandPalette({ open, onOpenChange, onScan }: CommandPaletteProps) {
  const t = useT();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="surface-3 fixed inset-x-4 top-16 z-50 mx-auto flex max-w-xl flex-col overflow-hidden rounded-2xl border text-popover-foreground shadow-[0_24px_60px_rgba(15,23,42,0.28)] backdrop-blur-xl duration-200 focus:outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:top-24"
        >
          <DialogPrimitive.Title className="sr-only">{t('nav.palette.title')}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{t('nav.palette.description')}</DialogPrimitive.Description>
          <PaletteBody onClose={() => onOpenChange(false)} onScan={onScan} />
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}

/** Mounted only while the dialog is open, so query/selection reset on every open. */
function PaletteBody({ onClose, onScan }: { onClose: () => void; onScan?: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const items = useCollectionStore((s) => s.items);
  const categories = useCollectionStore((s) => s.categories);
  const libraries = useCollectionStore((s) => s.libraries);
  const theme = useCollectionStore((s) => s.theme);
  const toggleTheme = useCollectionStore((s) => s.toggleTheme);
  const openItemDialog = useCollectionStore((s) => s.openItemDialog);
  const role = useAuthStore((s) => s.user?.role ?? 'viewer');
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const [query, setQuery] = useState('');
  const [active, setActive] = useState({ query: '', index: 0 });
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const commands = useMemo<PaletteEntry[]>(() => {
    const go = (path: string) => () => navigate(path);
    const entries: PaletteEntry[] = NAV_COMMANDS.map((command) => ({
      id: `nav:${command.id}`,
      group: 'navigation',
      label: t(command.labelKey),
      icon: command.icon,
      keywords: command.keywords,
      run: go(command.path),
    }));

    if (canEditContent(role)) {
      entries.push({
        id: 'action:add-item',
        group: 'actions',
        label: t('nav.palette.addItem'),
        icon: Plus,
        keywords: 'add new item create esya ekle yeni',
        run: () => {
          const slug = location.pathname.match(/^\/collections\/([^/]+)$/)?.[1];
          const category = slug ? categories.find((c) => c.slug === slug) : undefined;
          if (category) openItemDialog(category.id);
          else navigate('/items/new');
        },
      });
    }

    if (onScan) {
      entries.push({
        id: 'action:scan',
        group: 'actions',
        label: t('nav.palette.scan'),
        icon: ScanQrCode,
        keywords: 'scan qr barcode label camera tara barkod etiket kamera',
        run: onScan,
      });
    }

    entries.push({
      id: 'action:theme',
      group: 'actions',
      label: theme === 'dark' ? t('nav.theme.switchToLight') : t('nav.theme.switchToDark'),
      icon: theme === 'dark' ? Sun : Moon,
      keywords: 'theme dark light mode tema koyu acik',
      run: toggleTheme,
    });

    const nextLanguage = LANGUAGES.find((entry) => entry.value !== language) ?? LANGUAGES[0];
    entries.push({
      id: 'action:language',
      group: 'actions',
      label: t('nav.palette.switchLanguage', { language: nextLanguage.label }),
      icon: Languages,
      keywords: 'language dil english turkish turkce ingilizce',
      run: () => setLanguage(nextLanguage.value),
    });

    return entries;
  }, [t, role, onScan, theme, toggleTheme, language, setLanguage, navigate, location.pathname, categories, openItemDialog]);

  const trimmed = query.trim();

  const entries = useMemo<PaletteEntry[]>(() => {
    if (!trimmed) return commands;

    const itemEntries: PaletteEntry[] = searchItems(items, trimmed, { limit: 8 }).map(({ item, match }) => {
      const category = categoryById.get(item.categoryId);
      const hintParts = [category?.name, match ? describeSearchMatch(match, category, t) : undefined].filter(Boolean);
      return {
        id: `item:${item.id}`,
        group: 'items',
        label: item.title || t('common.untitled'),
        hint: hintParts.join(' · '),
        icon: category ? getCategoryIcon(category.icon) : Package,
        run: () => navigate(`/items/${item.id}`),
      };
    });

    const categoryEntries: PaletteEntry[] = searchCategories(categories, trimmed, 4).map((category) => ({
      id: `category:${category.id}`,
      group: 'categories',
      label: category.name,
      hint: category.description || undefined,
      icon: getCategoryIcon(category.icon),
      run: () => navigate(`/collections/${category.slug}`),
    }));

    const libraryEntries: PaletteEntry[] = searchLibraries(libraries, trimmed, 4).flatMap((library) => {
      const category = categories.find((c) => libraryMatchesCategory(library, c.id));
      if (!category) return [];
      return [{
        id: `library:${library.id}`,
        group: 'libraries' as const,
        label: library.name,
        hint: category.name,
        icon: LibraryIcon,
        run: () => navigate(`/collections/${category.slug}?library=${library.id}`),
      }];
    });

    const commandEntries = commands.filter((command) => matchesQuery(trimmed, command.label, command.keywords));

    return [...itemEntries, ...categoryEntries, ...libraryEntries, ...commandEntries];
  }, [trimmed, commands, items, categories, libraries, categoryById, navigate, t]);

  const grouped = useMemo(
    () => GROUP_ORDER
      .map((group) => ({ group, entries: entries.filter((entry) => entry.group === group) }))
      .filter((section) => section.entries.length > 0),
    [entries],
  );

  // Flat order (as rendered) for keyboard navigation.
  const flat = useMemo(() => grouped.flatMap((section) => section.entries), [grouped]);
  const indexById = useMemo(() => new Map(flat.map((entry, index) => [entry.id, index])), [flat]);
  const activeIndex = active.query === query ? Math.min(active.index, Math.max(flat.length - 1, 0)) : 0;

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  const runEntry = (entry: PaletteEntry | undefined) => {
    if (!entry) return;
    onClose();
    entry.run();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (flat.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive({ query, index: (activeIndex + 1) % flat.length });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive({ query, index: (activeIndex - 1 + flat.length) % flat.length });
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive({ query, index: 0 });
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive({ query, index: flat.length - 1 });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      runEntry(flat[activeIndex]);
    }
  };

  return (
    <>
      <div className="relative flex items-center gap-3 overflow-hidden border-b border-border/70 px-4">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_45%)]" />
        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Search aria-hidden="true" className="size-4" />
        </span>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('nav.palette.placeholder')}
          role="combobox"
          aria-label={t('nav.palette.placeholder')}
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={flat.length > 0 ? optionId(activeIndex) : undefined}
          className="relative h-14 min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground"
        />
        <kbd className="relative hidden rounded-md border border-border/70 bg-background/60 px-1.5 py-0.5 font-sans text-[10px] font-semibold shadow-sm text-muted-foreground sm:inline-block">
          Esc
        </kbd>
      </div>

      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={t('nav.palette.results')}
        className="max-h-96 overflow-y-auto overscroll-contain p-2 scrollbar-thin"
      >
        {flat.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-3 py-10 text-center" role="status">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-muted/40">
              <Search aria-hidden="true" className="size-5 text-primary/70" />
            </span>
            <p className="text-sm text-muted-foreground">{t('nav.search.noResults', { query: trimmed })}</p>
          </div>
        ) : (
          grouped.map((section) => {
            const headingId = `${baseId}-${section.group}`;
            return (
              <div key={section.group} role="group" aria-labelledby={headingId} className="pb-1">
                <div id={headingId} className="px-3 pb-1.5 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t(GROUP_LABEL_KEYS[section.group])}
                </div>
                {section.entries.map((entry) => {
                  const index = indexById.get(entry.id) ?? 0;
                  const isActive = index === activeIndex;
                  const Icon = entry.icon;
                  return (
                    <div
                      key={entry.id}
                      id={optionId(index)}
                      data-index={index}
                      role="option"
                      aria-selected={isActive}
                      onMouseMove={() => { if (!isActive) setActive({ query, index }); }}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => runEntry(entry)}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-xl border px-2.5 py-2 text-sm transition-all duration-150',
                        isActive
                          ? 'surface-2 border-primary/20 text-foreground'
                          : 'border-transparent text-foreground/90',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors',
                          isActive ? 'bg-primary text-primary-foreground shadow-[0_6px_16px_rgba(79,70,229,0.3)]' : 'bg-primary/10 text-primary',
                        )}
                      >
                        <Icon aria-hidden="true" className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{entry.label}</p>
                        {entry.hint && <p className="truncate text-xs text-muted-foreground">{entry.hint}</p>}
                      </div>
                      {isActive && (
                        <CornerDownLeft aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      <div className="hidden items-center gap-4 border-t border-border/70 bg-background/30 px-4 py-2.5 text-[11px] text-muted-foreground sm:flex">
        <span className="flex items-center gap-1.5">
          <kbd className="rounded-md border border-border/70 bg-background/60 px-1.5 py-0.5 font-sans text-[10px] font-semibold shadow-sm">↑</kbd>
          <kbd className="rounded-md border border-border/70 bg-background/60 px-1.5 py-0.5 font-sans text-[10px] font-semibold shadow-sm">↓</kbd>
          {t('nav.palette.hintNavigate')}
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="rounded-md border border-border/70 bg-background/60 px-1.5 py-0.5 font-sans text-[10px] font-semibold shadow-sm">↵</kbd>
          {t('nav.palette.hintOpen')}
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="rounded-md border border-border/70 bg-background/60 px-1.5 py-0.5 font-sans text-[10px] font-semibold shadow-sm">Esc</kbd>
          {t('nav.palette.hintClose')}
        </span>
      </div>
    </>
  );
}
