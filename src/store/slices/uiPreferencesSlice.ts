import type { CollectionStoreCreator, CollectionStoreDependencies, UiPreferencesSlice } from '@/store/collectionStore.types';

const COMPACT_STORAGE_KEY = 'curio-compact-mode';

function readCompactMode(): boolean {
  try {
    return localStorage.getItem(COMPACT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function applyCompactModeToDocument(compact: boolean) {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('compact', compact);
}

export function createUiPreferencesSlice(
  dependencies: CollectionStoreDependencies,
): CollectionStoreCreator<UiPreferencesSlice> {
  const initialCompactMode = readCompactMode();
  applyCompactModeToDocument(initialCompactMode);

  return (set, get) => ({
    viewMode: 'grid',
    searchQuery: '',
    sortField: 'createdAt',
    sortOrder: 'desc',
    selectedTags: [],
    sidebarOpen: true,
    menuCollectionStyle: 'style1',
    theme: 'light',
    displayCurrency: 'USD',
    itemDialogOpen: false,
    itemDialogCategoryId: null,
    itemDialogItem: null,
    itemDialogOptions: null,
    compactMode: initialCompactMode,

    setViewMode: (mode) => set({ viewMode: mode }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setSortField: (field) => set({ sortField: field }),
    setSortOrder: (order) => set({ sortOrder: order }),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setMenuCollectionStyle: (style) => {
      set({ menuCollectionStyle: style });
      dependencies.syncSettings({ menuCollectionStyle: style });
    },
    toggleTheme: () => {
      const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
      dependencies.applyThemeToDocument(nextTheme);
      set({ theme: nextTheme });
      dependencies.syncSettings({ theme: nextTheme });
    },
    setDisplayCurrency: (currency) => {
      set({ displayCurrency: currency });
      dependencies.syncSettings({ displayCurrency: currency });
    },
    openItemDialog: (categoryId, item, options) => {
      if (!dependencies.ensurePermission('content:edit')) return;
      set({
        itemDialogOpen: true,
        itemDialogCategoryId: categoryId,
        itemDialogItem: item ?? null,
        itemDialogOptions: item ? null : options ?? null,
      });
    },
    setCompactMode: (compact) => {
      try {
        if (compact) localStorage.setItem(COMPACT_STORAGE_KEY, '1');
        else localStorage.removeItem(COMPACT_STORAGE_KEY);
      } catch {
        // storage unavailable — preference just won't persist
      }
      applyCompactModeToDocument(compact);
      set({ compactMode: compact });
    },
    closeItemDialog: () => set({
      itemDialogOpen: false,
      itemDialogCategoryId: null,
      itemDialogItem: null,
      itemDialogOptions: null,
    }),
  });
}
