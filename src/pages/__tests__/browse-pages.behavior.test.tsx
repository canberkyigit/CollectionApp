import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import CollectionDetail from '@/pages/CollectionDetail';
import Favorites from '@/pages/Favorites';
import LendingTracker from '@/pages/LendingTracker';
import Wishlist from '@/pages/Wishlist';
import { createMockItem } from '@/test/helpers';
import { renderRoute, renderWithRouter, seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useCollectionStore } from '@/store/useCollectionStore';

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
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

describe('browse page behaviors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
  });

  it('lets users drill into collection libraries, clear filters, open details, and transfer selected items', async () => {
    const user = userEvent.setup();
    const seed = buildSeedData();
    seed.items.push({
      ...createMockItem({
        title: 'Shelfless Stories',
        categoryId: 'cat-books',
        libraryId: undefined,
        customFields: { title: 'Shelfless Stories', author: 'Nomad Writer' },
      }),
      id: 'item-unassigned',
      createdAt: '2024-04-01',
      updatedAt: '2024-04-01',
    });
    seedCollectionStore(seed);

    const bulkTransferToLibrary = vi.fn();
    useCollectionStore.setState({
      bulkTransferToLibrary,
      deleteItem: vi.fn(),
      deleteItems: vi.fn(),
      openItemDialog: vi.fn(),
    });

    renderRoute({
      path: '/collections/:categorySlug',
      initialEntry: '/collections/books',
      ui: <CollectionDetail />,
    });

    expect(screen.getByRole('heading', { name: 'Books' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /unassigned 1/i }));
    expect(screen.getByText('Shelfless Stories')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/search books/i), 'missing title');
    expect(await screen.findByText(/no matching items/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    await user.click(screen.getByText('Shelfless Stories'));
    expect(screen.getByText('Detail Panel for item-unassigned')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close detail panel/i }));

    const itemCard = screen.getByText('Shelfless Stories').closest('[class*="group"]');
    expect(itemCard).not.toBeNull();
    await user.click(within(itemCard as HTMLElement).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /^transfer$/i }));
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Main Shelf' }));
    await user.click(screen.getByRole('button', { name: /^transfer$/i }));

    expect(bulkTransferToLibrary).toHaveBeenCalledWith(['item-unassigned'], 'lib-books');
  });

  it('supports favorites filtering, empty-state recovery, and inline item details', async () => {
    const user = userEvent.setup();
    seedCollectionStore(buildSeedData());

    const firstView = renderWithRouter(<Favorites />);

    expect(screen.getByRole('heading', { name: 'Favorites' })).toBeInTheDocument();
    await user.click(screen.getByText('Dune'));
    expect(screen.getByText('Detail Panel for item-1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close detail panel/i }));

    await user.type(screen.getByPlaceholderText(/search favorites/i), 'zzzz');
    expect(await screen.findByText(/no matching favorites/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(screen.getByText('Dune')).toBeInTheDocument();

    firstView.unmount();
    seedCollectionStore({
      ...buildSeedData(),
      items: buildSeedData().items.map((item) => ({ ...item, isFavorite: false })),
    });

    renderWithRouter(<Favorites />);
    expect(await screen.findByText(/no favorites yet/i)).toBeInTheDocument();
  });

  it('covers wishlist add, validation, filter recovery, and acquisition flows', async () => {
    const user = userEvent.setup();
    seedCollectionStore(buildSeedData());

    const addWishlistItem = vi.fn();
    const updateWishlistItem = vi.fn();

    useCollectionStore.setState({
      addWishlistItem,
      updateWishlistItem,
      deleteWishlistItem: vi.fn(),
    });

    renderWithRouter(<Wishlist />);

    await user.click(screen.getByRole('button', { name: /add item/i }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /add to wishlist/i }));
    expect(mocks.toastError).toHaveBeenCalledWith('Title is required');

    await user.type(screen.getByLabelText(/title \*/i), 'Snow Crash');
    await user.type(screen.getByLabelText(/target price/i), '42');
    await user.click(screen.getAllByRole('combobox')[0]);
    await user.click(await screen.findByRole('option', { name: 'Books' }));
    await user.click(screen.getByRole('button', { name: /add to wishlist/i }));

    expect(addWishlistItem).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Snow Crash',
        categoryId: 'cat-books',
        targetPrice: 42,
      }),
    );

    await user.type(screen.getByPlaceholderText(/search wishlist/i), 'missing');
    expect(await screen.findByText(/no wishlist items/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    await user.click(screen.getByRole('button', { name: /^acquire$/i }));
    await user.click(screen.getByRole('button', { name: /just mark as acquired/i }));

    expect(updateWishlistItem).toHaveBeenCalledWith('wish-1', { isAcquired: true });
  });

  it('tracks lend and return flows while exposing lending history', async () => {
    const user = userEvent.setup();
    const seed = buildSeedData();
    seed.items[1] = {
      ...seed.items[1],
      lendingHistory: [
        {
          id: 'lend-history',
          borrowerName: 'Miles Fan',
          lentDate: '2024-03-01',
          expectedReturnDate: '2024-03-10',
          actualReturnDate: '2024-03-09',
          notes: 'Returned in great shape',
          condition: 'better',
        },
      ],
    };
    seedCollectionStore(seed);

    const addLendingRecord = vi.fn();
    const returnLendingRecord = vi.fn();
    useCollectionStore.setState({
      addLendingRecord,
      returnLendingRecord,
    });

    render(
      <MemoryRouter initialEntries={['/lending']}>
        <Routes>
          <Route path="/lending" element={<LendingTracker />} />
          <Route path="/collections" element={<div>Collections Landing</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getAllByRole('button', { name: /lend item/i })[0]);
    const lendDialog = screen.getByRole('dialog');
    await user.click(within(lendDialog).getByRole('button', { name: /lend item/i }));
    expect(mocks.toastError).toHaveBeenCalledWith('Please fill in all required fields');

    await user.click(within(lendDialog).getByRole('combobox'));
    // Dune already has an open loan, so it is listed but cannot be picked again.
    expect(await screen.findByRole('option', { name: 'Dune (on loan)' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(await screen.findByRole('option', { name: 'Kind of Blue' }));
    await user.type(screen.getByLabelText(/borrower name/i), 'Jane Reader');
    await user.type(screen.getByLabelText(/borrower contact/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/expected return date/i), '2099-12-31');
    await user.type(screen.getByLabelText(/notes/i), 'Keep dust jacket safe');
    await user.click(within(lendDialog).getByRole('button', { name: /lend item/i }));

    expect(addLendingRecord).toHaveBeenCalledWith(
      'item-2',
      expect.objectContaining({
        borrowerName: 'Jane Reader',
        borrowerContact: 'jane@example.com',
        expectedReturnDate: '2099-12-31',
      }),
    );

    await user.click(screen.getByRole('button', { name: /mark returned/i }));
    const returnDialog = screen.getByRole('dialog');
    await user.click(within(returnDialog).getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Damaged' }));
    await user.click(screen.getByRole('button', { name: /confirm return/i }));

    expect(returnLendingRecord).toHaveBeenCalledWith('item-1', 'lend-1', 'damaged');

    await user.click(screen.getByRole('tab', { name: /history/i }));
    expect(await screen.findByText('Miles Fan')).toBeInTheDocument();
  });
});
