import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ItemDetail from '@/pages/ItemDetail';
import { seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useCollectionStore } from '@/store/useCollectionStore';

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return {
    ...actual,
    toast: {
      success: mocks.toastSuccess,
      info: mocks.toastInfo,
    },
  };
});

describe('ItemDetail behaviors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
    seedCollectionStore(buildSeedData());
  });

  it('shows a loading skeleton during remote boot and a not-found state for missing items', () => {
    seedCollectionStore({});
    useCollectionStore.setState({
      ownerUserId: 'contrib-1',
      isRemoteDataLoading: true,
    });

    const loadingView = render(
      <MemoryRouter initialEntries={['/items/item-404']}>
        <Routes>
          <Route path="/items/:itemId" element={<ItemDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Loading item' })).toBeInTheDocument();
    loadingView.unmount();

    seedCollectionStore(buildSeedData());
    render(
      <MemoryRouter initialEntries={['/items/missing-item']}>
        <Routes>
          <Route path="/items/:itemId" element={<ItemDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Item not found' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse collections/i })).toBeInTheDocument();
  });

  it('supports gallery browsing, favorites, editing, maintenance, notes, and deleting', async () => {
    const user = userEvent.setup();

    const toggleFavorite = vi.fn();
    const openItemDialog = vi.fn();
    const addMaintenanceEntry = vi.fn();
    const removeMaintenanceEntry = vi.fn();
    const updateItem = vi.fn();
    const deleteItem = vi.fn();

    useCollectionStore.setState({
      toggleFavorite,
      openItemDialog,
      addMaintenanceEntry,
      removeMaintenanceEntry,
      updateItem,
      deleteItem,
    });

    render(
      <MemoryRouter initialEntries={['/items/item-1']}>
        <Routes>
          <Route path="/items/:itemId" element={<ItemDetail />} />
          <Route path="/collections/books" element={<div>Books Landing</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByAltText('Thumbnail 2'));
    expect(screen.getByAltText('Dune - 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /starred/i }));
    expect(toggleFavorite).toHaveBeenCalledWith('item-1');
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Removed from favorites');

    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(openItemDialog).toHaveBeenCalledWith(
      'cat-books',
      expect.objectContaining({ id: 'item-1', title: 'Dune' }),
    );

    await user.click(screen.getByRole('tab', { name: /maintenance/i }));
    await user.click(screen.getByRole('button', { name: /add entry/i }));
    const maintenanceDialog = screen.getByRole('dialog');
    await user.click(within(maintenanceDialog).getByRole('button', { name: /add entry/i }));
    expect(within(maintenanceDialog).getByRole('alert')).toHaveTextContent(/describe what was done/i);
    expect(addMaintenanceEntry).not.toHaveBeenCalled();
    await user.type(within(maintenanceDialog).getByLabelText(/description/i), 'Checked binding');
    await user.type(within(maintenanceDialog).getByLabelText(/^cost$/i), '12.5');
    await user.type(within(maintenanceDialog).getByLabelText(/provider/i), 'Local bindery');
    await user.click(within(maintenanceDialog).getByRole('button', { name: /add entry/i }));
    expect(addMaintenanceEntry).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({
        type: 'inspection',
        description: 'Checked binding',
        cost: 12.5,
        provider: 'Local bindery',
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Maintenance entry added');

    act(() => {
      useCollectionStore.setState({
        items: useCollectionStore.getState().items.map((item) => (
          item.id === 'item-1'
            ? {
                ...item,
                maintenanceLog: [
                  {
                    id: 'maint-1',
                    date: '2024-05-01',
                    type: 'repair',
                    description: 'Repaired dust jacket',
                  },
                ],
              }
            : item
        )),
      });
    });

    await user.click(screen.getByRole('tab', { name: /notes/i }));
    await user.clear(screen.getByPlaceholderText(/add notes about this item/i));
    await user.type(screen.getByPlaceholderText(/add notes about this item/i), 'Updated shelf notes');
    await user.click(screen.getByRole('button', { name: /save notes/i }));

    await waitFor(() => {
      expect(updateItem).toHaveBeenCalledWith('item-1', { notes: 'Updated shelf notes' });
    });
    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith('Notes saved successfully');
    });

    await user.click(screen.getByRole('tab', { name: /maintenance/i }));
    expect(screen.getByText('Repaired dust jacket')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete entry' }));
    expect(removeMaintenanceEntry).toHaveBeenCalledWith('item-1', 'maint-1');

    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    expect(deleteItem).toHaveBeenCalledWith('item-1');
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Item deleted successfully');
    expect(await screen.findByText('Books Landing')).toBeInTheDocument();
  });

  it('shows lending and projection details for items with history', async () => {
    const user = userEvent.setup();
    useCollectionStore.setState({
      items: useCollectionStore.getState().items.map((item) => (
        item.id === 'item-1'
          ? {
              ...item,
              valuationInfo: {
                ...item.valuationInfo,
                targetYearProjection: 2030,
                targetEstimatedValue: 95,
              },
            }
          : item
      )),
    });

    render(
      <MemoryRouter initialEntries={['/items/item-1']}>
        <Routes>
          <Route path="/items/:itemId" element={<ItemDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/current valuation/i)).toBeInTheDocument();
    expect(screen.getByText(/projected value/i)).toBeInTheDocument();
    // A USD-valued item shown in USD needs no separate USD equivalent or 1:1 rate rows.
    expect(screen.queryByText(/usd equivalent/i)).not.toBeInTheDocument();
    expect(screen.queryByText('1 USD = 1.0000 USD')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /lending/i }));
    expect(screen.getByText('John Reader')).toBeInTheDocument();
    expect(screen.getByText(/handle carefully/i)).toBeInTheDocument();
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('shows empty lending state and custom field fallbacks when item data is sparse', async () => {
    const user = userEvent.setup();

    useCollectionStore.setState({
      items: useCollectionStore.getState().items.map((item) => (
        item.id === 'item-1'
          ? {
              ...item,
              customFields: { title: 'Dune', signed: false, acquiredOn: '2024-02-10', appraised: 80 },
              notes: '',
              lendingHistory: [],
            }
          : item
      )),
      categories: useCollectionStore.getState().categories.map((category) => (
        category.id === 'cat-books'
          ? {
              ...category,
              fields: [
                ...category.fields,
                { id: 'signed', key: 'signed', label: 'Signed', type: 'boolean', required: false, order: 4 },
                { id: 'acquiredOn', key: 'acquiredOn', label: 'Acquired On', type: 'date', required: false, order: 5 },
                { id: 'appraised', key: 'appraised', label: 'Appraised', type: 'currency', required: false, order: 6 },
              ],
            }
          : category
      )),
    });

    render(
      <MemoryRouter initialEntries={['/items/item-1']}>
        <Routes>
          <Route path="/items/:itemId" element={<ItemDetail />} />
          <Route path="/lending" element={<div>Lending Landing</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('tab', { name: /custom fields/i }));
    expect(screen.getByText('Signed')).toBeInTheDocument();
    expect(screen.getByText('Acquired On')).toBeInTheDocument();
    expect(screen.getByText('Appraised')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /lending/i }));
    expect(screen.getByText(/no lending records/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /lending tracker/i }));
    expect(await screen.findByText('Lending Landing')).toBeInTheDocument();
  });
});
