import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import Sidebar from '@/components/layout/Sidebar';
import CollectionDetail from '@/pages/CollectionDetail';
import Favorites from '@/pages/Favorites';
import AdminBulkActions from '@/pages/AdminBulkActions';
import { createMockItem } from '@/test/helpers';
import { buildSeedData } from '@/test/seed';
import { renderRoute, renderWithRouter, seedAuthStore, seedCollectionStore } from '@/test/render';
import { useCollectionStore } from '@/store/useCollectionStore';
import type { CollectionItem } from '@/types';

vi.mock('@/components/shared/ItemDetailPanel', () => ({
  ItemDetailPanel: ({
    itemId,
    onClose,
  }: {
    itemId: string;
    onClose: () => void;
  }) => (
    <div>
      <p>Detail Panel for {itemId}</p>
      <button type="button" onClick={onClose}>
        Close Detail Panel
      </button>
    </div>
  ),
}));

function buildLargeBookItems(count: number, overrides: Partial<CollectionItem> = {}): CollectionItem[] {
  return Array.from({ length: count }, (_, index) => ({
    ...createMockItem({
      title: `Scale Book ${String(index).padStart(3, '0')}`,
      categoryId: 'cat-books',
      libraryId: 'lib-books',
      isFavorite: true,
      customFields: {
        author: `Author ${index}`,
        isbn: `978000000${String(index).padStart(4, '0')}`,
      },
      ...overrides,
    }),
    id: `scale-item-${index}`,
    createdAt: new Date(Date.UTC(2024, 0, 1, 0, 0, count - index)).toISOString(),
    updatedAt: new Date(Date.UTC(2024, 1, 1, 0, 0, count - index)).toISOString(),
  }));
}

function seedLargeCollection(count: number, overrides: Partial<CollectionItem> = {}) {
  const seed = buildSeedData();
  seedCollectionStore({
    ...seed,
    items: buildLargeBookItems(count, overrides),
  });
}

describe('Scale Pack virtualized surfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
  });

  it('virtualizes collection detail grid and keeps select all scoped to all filtered items', async () => {
    const user = userEvent.setup();
    seedLargeCollection(150);
    useCollectionStore.setState({
      viewMode: 'grid',
      sortField: 'title',
      sortOrder: 'asc',
      deleteItem: vi.fn(),
      deleteItems: vi.fn(),
      bulkTransferToLibrary: vi.fn(),
      openItemDialog: vi.fn(),
    });

    const gridView = renderRoute({
      path: '/collections/:categorySlug',
      initialEntry: '/collections/books',
      ui: <CollectionDetail />,
    });

    expect(gridView.container.querySelector('[data-virtualized="true"]')).toBeInTheDocument();
    expect(screen.getByText('Scale Book 000')).toBeInTheDocument();
    expect(screen.queryByText('Scale Book 149')).not.toBeInTheDocument();
    gridView.unmount();

    useCollectionStore.setState({
      viewMode: 'table',
      sortField: 'title',
      sortOrder: 'asc',
    });

    renderRoute({
      path: '/collections/:categorySlug',
      initialEntry: '/collections/books',
      ui: <CollectionDetail />,
    });

    await user.click(screen.getByRole('checkbox', { name: /select all items/i }));
    expect(screen.getByText(/150 items selected/i)).toBeInTheDocument();
  });

  it('virtualizes favorites while preserving detail and favorite toggles', async () => {
    const user = userEvent.setup();
    seedLargeCollection(150, { isFavorite: true });

    const view = renderWithRouter(<Favorites />);

    expect(view.container.querySelector('[data-virtualized="true"]')).toBeInTheDocument();
    const firstCard = screen.getByText('Scale Book 000').closest('[class*="group"]');
    expect(firstCard).not.toBeNull();

    await user.click(screen.getByText('Scale Book 000'));
    expect(screen.getByText('Detail Panel for scale-item-0')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close detail panel/i }));

    await user.click(within(firstCard as HTMLElement).getByRole('button', { name: /remove .* from favorites/i }));
    expect(useCollectionStore.getState().items.find((item) => item.id === 'scale-item-0')?.isFavorite).toBe(false);
  });

  it('keeps admin bulk select all and condition updates working with virtual rows', async () => {
    const user = userEvent.setup();
    const bulkUpdateCondition = vi.fn();
    seedLargeCollection(200);
    useCollectionStore.setState({
      deleteItems: vi.fn(),
      bulkMoveItems: vi.fn(),
      bulkUpdateCondition,
      bulkAddTag: vi.fn(),
      bulkToggleFavorite: vi.fn(),
    });

    const view = renderWithRouter(<AdminBulkActions />);

    expect(view.container.querySelector('[data-virtualized="true"]')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /select all/i }));
    await user.click(screen.getAllByRole('combobox')[2]);
    await user.click(await screen.findByRole('option', { name: 'Poor' }));

    expect(bulkUpdateCondition).toHaveBeenCalledWith(
      expect.arrayContaining(['scale-item-0', 'scale-item-199']),
      'Poor',
    );
  });

  it('virtualizes sidebar drill-down lists while search still scans all items', async () => {
    const user = userEvent.setup();
    seedLargeCollection(150);
    useCollectionStore.setState({
      sidebarOpen: true,
      menuCollectionStyle: 'style2',
    });

    const LocationProbe = () => {
      const location = useLocation();
      return <div data-testid="location">{location.pathname}{location.search}</div>;
    };

    const view = render(
      <MemoryRouter initialEntries={['/collections/books?library=all']}>
        <Routes>
          <Route path="/collections/:categorySlug" element={<><Sidebar /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(view.container.querySelector('[data-virtualized="true"]')).toBeInTheDocument();
    expect(screen.getByText('Scale Book 000')).toBeInTheDocument();
    expect(screen.queryByText('Scale Book 149')).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/search/i), 'Scale Book 149');
    expect(screen.getByText('Scale Book 149')).toBeInTheDocument();
    await user.click(screen.getByText('Scale Book 149'));
    expect(screen.getByTestId('location')).toHaveTextContent('/collections/books?library=all&detail=scale-item-149');
  });
});
