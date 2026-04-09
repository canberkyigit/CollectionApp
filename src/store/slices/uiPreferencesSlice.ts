import type { CollectionStoreCreator, CollectionStoreDependencies, UiPreferencesSlice } from '@/store/collectionStore.types';

export function createUiPreferencesSlice(
  dependencies: CollectionStoreDependencies,
): CollectionStoreCreator<UiPreferencesSlice> {
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

    setViewMode: (mode) => set({ viewMode: mode }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setSortField: (field) => set({ sortField: field }),
    setSortOrder: (order) => set({ sortOrder: order }),
    setSelectedTags: (tags) => set({ selectedTags: tags }),
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
    openItemDialog: (categoryId, item) => {
      if (!dependencies.ensurePermission('content:edit')) return;
      set({
        itemDialogOpen: true,
        itemDialogCategoryId: categoryId,
        itemDialogItem: item ?? null,
      });
    },
    closeItemDialog: () => set({
      itemDialogOpen: false,
      itemDialogCategoryId: null,
      itemDialogItem: null,
    }),
  });
}
