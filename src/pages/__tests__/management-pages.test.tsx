import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import AdminBulkActions from '@/pages/AdminBulkActions';
import AdminCategories from '@/pages/AdminCategories';
import AdminCategoryForm from '@/pages/AdminCategoryForm';
import AdminDuplicates from '@/pages/AdminDuplicates';
import Admin from '@/pages/Admin';
import { AdminPanelSection } from '@/components/settings/AdminPanelSection';
import Contributors from '@/pages/Contributors';
import Settings from '@/pages/Settings';
import { exportService } from '@/services/exportService';
import { renderRoute, renderWithRouter, seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useCollectionStore } from '@/store/useCollectionStore';

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
  exportToCSV: vi.fn(),
  exportToJSON: vi.fn(),
}));

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return {
    ...actual,
    toast: {
      success: mocks.toastSuccess,
      error: mocks.toastError,
      warning: mocks.toastWarning,
    },
  };
});

vi.mock('@/services/exportService', () => ({
  exportService: {
    exportToCSV: mocks.exportToCSV,
    exportToJSON: mocks.exportToJSON,
    exportCategoryToCSV: mocks.exportToCSV,
  },
  getDefaultCsvDelimiter: () => ',',
}));

describe('management pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const seed = buildSeedData();
    seedCollectionStore(seed);
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
  });

  it('renders contributor metrics and links to filtered collections', async () => {
    const user = userEvent.setup();

    renderWithRouter(<Contributors />);

    expect(screen.getByRole('heading', { name: 'Contributors' })).toBeInTheDocument();
    expect(screen.getAllByText('Ada Curator')[0]).toBeInTheDocument();
    expect(screen.queryByText(/jazz cabinet/i)).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('link', { name: /view items/i })[0]);
  });

  it('updates settings preferences and resets all data', async () => {
    const user = userEvent.setup();
    const wipeAllData = vi.fn(async () => undefined);
    useCollectionStore.setState({ wipeAllData });

    renderRoute({
      path: '/settings',
      initialEntry: '/settings',
      ui: <Settings />,
    });

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^admin$/i })).toHaveAttribute('data-state', 'active');
    await user.click(screen.getByRole('tab', { name: /appearance/i }));
    await user.click(screen.getAllByRole('switch')[0]);
    expect(useCollectionStore.getState().theme).toBe('dark');
    await user.click(screen.getByRole('combobox', { name: /display currency/i }));
    await user.click(await screen.findByText(/€ EUR/i));
    expect(useCollectionStore.getState().displayCurrency).toBe('EUR');

    await user.click(screen.getByRole('tab', { name: /data/i }));
    await user.click(screen.getByRole('button', { name: /reset all data/i }));
    await user.click(screen.getByRole('button', { name: /reset data/i }));

    await waitFor(() => {
      expect(wipeAllData).toHaveBeenCalled();
    });
  });

  it('supports export, import, and destructive reset flows inside settings data tab', async () => {
    const user = userEvent.setup();
    const wipeAllData = vi.fn(async () => undefined);
    const bulkAddItems = vi.fn(() => 1);
    const logActivity = vi.fn();

    class MockFileReader {
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;

      readAsText() {
        this.onload?.({
          target: {
            result: JSON.stringify([
              {
                title: 'Foundation',
                categoryId: 'cat-books',
                description: 'Imported classic',
              },
            ]),
          },
        } as ProgressEvent<FileReader>);
      }
    }

    const originalFileReader = window.FileReader;
    vi.stubGlobal('FileReader', MockFileReader as unknown as typeof FileReader);

    useCollectionStore.setState({
      wipeAllData,
      bulkAddItems,
      logActivity,
    });

    const view = renderRoute({
      path: '/settings',
      initialEntry: '/settings?section=data&dataTab=export',
      ui: <Settings />,
    });

    await user.click(screen.getAllByRole('button', { name: /export as csv/i })[0]);
    expect(exportService.exportToCSV).toHaveBeenCalled();

    await user.click(screen.getAllByRole('button', { name: /export as json/i })[0]);
    expect(exportService.exportToJSON).toHaveBeenCalled();

    await user.click(screen.getByRole('tab', { name: /^import$/i }));

    const jsonInput = view.container.querySelector('input[accept=".json"]');
    expect(jsonInput).not.toBeNull();
    await user.upload(jsonInput as HTMLInputElement, new File(['[]'], 'items.json', { type: 'application/json' }));

    expect(await screen.findByText(/1 items found/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /import 1 items/i }));

    await waitFor(() => {
      expect(bulkAddItems).toHaveBeenCalledWith([
        expect.objectContaining({
          categoryId: 'cat-books',
          title: 'Foundation',
        }),
      ]);
    });

    await user.click(screen.getByRole('button', { name: /reset all data/i }));
    expect(wipeAllData).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /reset data/i }));

    await waitFor(() => {
      expect(wipeAllData).toHaveBeenCalledTimes(1);
    });

    vi.stubGlobal('FileReader', originalFileReader);
  });

  it('supports bulk admin actions across items', async () => {
    const user = userEvent.setup();
    useCollectionStore.setState({
      deleteItems: vi.fn(),
      bulkMoveItems: vi.fn(),
      bulkUpdateCondition: vi.fn(),
      bulkAddTag: vi.fn(),
      bulkToggleFavorite: vi.fn(),
    });

    renderWithRouter(<AdminBulkActions />);

    expect(screen.getByRole('heading', { name: 'Bulk Actions' })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /select all/i }));
    await user.click(screen.getByRole('button', { name: /toggle favorite/i }));
    expect(useCollectionStore.getState().bulkToggleFavorite).toHaveBeenCalled();

    await user.click(screen.getByRole('checkbox', { name: /select all/i }));
    await user.click(screen.getByRole('button', { name: /add tag/i }));
    await user.type(screen.getByPlaceholderText(/enter tag name/i), 'classic');
    await user.click(screen.getAllByRole('button', { name: /^add tag$/i })[1]);

    expect(useCollectionStore.getState().bulkAddTag).toHaveBeenCalled();
  });

  it('covers bulk move, condition updates, delete confirmation, and empty filters', async () => {
    const user = userEvent.setup();
    useCollectionStore.setState({
      deleteItems: vi.fn(),
      bulkMoveItems: vi.fn(),
      bulkUpdateCondition: vi.fn(),
      bulkAddTag: vi.fn(),
      bulkToggleFavorite: vi.fn(),
    });

    renderWithRouter(<AdminBulkActions />);

    await user.click(screen.getByRole('checkbox', { name: /select all/i }));

    await user.click(screen.getAllByRole('combobox')[1]);
    await user.click(await screen.findByRole('option', { name: 'Vinyl' }));
    expect(useCollectionStore.getState().bulkMoveItems).toHaveBeenCalledWith(
      expect.arrayContaining(['item-1', 'item-2', 'item-3']),
      'cat-vinyl',
    );

    await user.click(screen.getByRole('checkbox', { name: /select all/i }));
    await user.click(screen.getAllByRole('combobox')[2]);
    await user.click(await screen.findByRole('option', { name: 'Poor' }));
    expect(useCollectionStore.getState().bulkUpdateCondition).toHaveBeenCalledWith(
      expect.arrayContaining(['item-1', 'item-2', 'item-3']),
      'Poor',
    );

    await user.click(screen.getByRole('checkbox', { name: /select all/i }));
    await user.click(screen.getByRole('button', { name: /delete selected/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(useCollectionStore.getState().deleteItems).toHaveBeenCalledWith(
      expect.arrayContaining(['item-1', 'item-2', 'item-3']),
    );

    await user.type(screen.getByPlaceholderText(/search items by name/i), 'does-not-exist');
    expect(await screen.findByText(/no items found matching your filters/i)).toBeInTheDocument();
  });

  it('renders category management and duplicate handling flows', async () => {
    const user = userEvent.setup();
    useCollectionStore.setState({
      deleteCategory: vi.fn(),
      deleteItem: vi.fn(),
    });

    const categoriesView = renderWithRouter(<AdminCategories />);
    expect(screen.getByRole('heading', { name: 'Categories' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button')[1]);
    categoriesView.unmount();

    const duplicateSeed = buildSeedData();
    duplicateSeed.items.push({
      ...duplicateSeed.items[0],
      id: 'item-dup',
      createdAt: '2024-04-10',
      updatedAt: '2024-04-10',
    });
    seedCollectionStore(duplicateSeed);

    renderWithRouter(<AdminDuplicates />);
    expect(screen.getByText(/potential duplicate group/i)).toBeInTheDocument();
    await user.click(screen.getAllByText('Dune')[0]);
    await user.click(screen.getAllByTitle(/delete item/i)[0]);
    await user.click(screen.getByRole('button', { name: /archive/i }));
    expect(useCollectionStore.getState().deleteItem).toHaveBeenCalled();
  });

  it('supports empty category state, category creation navigation, and delete confirmation', async () => {
    const user = userEvent.setup();
    const deleteCategory = vi.fn();
    useCollectionStore.setState({
      categories: [],
      items: [],
      deleteCategory,
    });

    render(
      <MemoryRouter initialEntries={['/admin/categories']}>
        <Routes>
          <Route path="/admin/categories" element={<AdminCategories />} />
          <Route path="/admin/categories/new" element={<div>Category Creator</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/no categories yet/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /create category/i }));
    expect(await screen.findByText('Category Creator')).toBeInTheDocument();

    const seed = buildSeedData();
    seedCollectionStore(seed);
    useCollectionStore.setState({ deleteCategory });

    const categoriesView = renderWithRouter(<AdminCategories />);
    const rowButtons = categoriesView.container.querySelectorAll('tbody button');
    expect(rowButtons.length).toBeGreaterThan(1);

    await user.click(rowButtons[1] as HTMLButtonElement);
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(deleteCategory).toHaveBeenCalledWith('cat-books');
  });

  it('creates and updates libraries with multiple category assignments', async () => {
    const user = userEvent.setup();
    const addLibrary = vi.fn();
    const updateLibrary = vi.fn();

    useCollectionStore.setState({
      addLibrary,
      updateLibrary,
      libraries: [
        {
          id: 'lib-shared',
          name: 'Shared Shelf',
          categoryIds: ['cat-books'],
          order: 0,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
    });

    renderWithRouter(<AdminPanelSection />);

    await user.click(screen.getByRole('button', { name: /add library/i }));
    await user.type(screen.getByLabelText(/library name/i), 'Cross Shelf');
    await user.click(screen.getByRole('checkbox', { name: /books/i }));
    await user.click(screen.getByRole('checkbox', { name: /vinyl/i }));
    await user.click(screen.getByRole('button', { name: /create library/i }));

    expect(addLibrary).toHaveBeenCalledWith({
      name: 'Cross Shelf',
      categoryIds: ['cat-books', 'cat-vinyl'],
    });

    await user.click(screen.getByRole('button', { name: /edit library shared shelf/i }));
    await user.click(screen.getByRole('checkbox', { name: /vinyl/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(updateLibrary).toHaveBeenCalledWith(
      'lib-shared',
      expect.objectContaining({
        name: 'Shared Shelf',
        categoryIds: ['cat-books', 'cat-vinyl'],
      }),
    );
  });

  it('shows a settings breadcrumb when admin routes are opened from settings', () => {
    renderRoute({
      path: '/admin/categories/new',
      initialEntry: '/admin/categories/new?from=settings',
      ui: <AdminCategoryForm />,
    });

    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getAllByText('Admin')[0]).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();
  });

  it('preserves settings context when opening manage categories from settings', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/settings?section=admin']}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin/categories" element={<AdminCategories />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByText('Manage categories'));

    expect(await screen.findByRole('heading', { name: 'Categories' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings?section=admin');
  });

  it('returns to settings when navigating back from a settings-launched admin child route', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/settings?section=admin']}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin/categories" element={<AdminCategories />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByText('Manage categories'));
    expect(await screen.findByRole('heading', { name: 'Categories' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^admin$/i })).toHaveAttribute('data-state', 'active');
  });

  it('redirects /admin to the Settings admin section', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^admin$/i })).toHaveAttribute('data-state', 'active');
  });

  it('falls back to a known section when ?section= is unknown', () => {
    renderRoute({
      path: '/settings',
      initialEntry: '/settings?section=bogus',
      ui: <Settings />,
    });

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^admin$/i })).toHaveAttribute('data-state', 'active');
  });
});
