import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ItemDetailPanel } from '@/components/shared/ItemDetailPanel';
import { renderWithRouter, seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useCollectionStore } from '@/store/useCollectionStore';

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mocks.toastSuccess,
  },
}));

describe('ItemDetailPanel', () => {
  beforeEach(() => {
    const seed = buildSeedData();
    seedCollectionStore(seed);
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
    vi.clearAllMocks();

    useCollectionStore.setState({
      toggleFavorite: vi.fn(),
      toggleRead: vi.fn(),
      deleteItem: vi.fn(),
      updateItem: vi.fn(),
      openItemDialog: vi.fn(),
    });

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:qr');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('renders item details and supports editing notes, favoriting, and edit actions', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithRouter(<ItemDetailPanel itemId="item-1" onClose={onClose} />);

    expect(screen.getAllByText('Dune')[0]).toBeInTheDocument();
    expect(screen.getByText('Purchase information')).toBeInTheDocument();
    expect(screen.getByText('Value at purchase date')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /edit/i })[0]);
    expect(onClose).toHaveBeenCalled();
    expect(useCollectionStore.getState().openItemDialog).toHaveBeenCalledWith('cat-books', expect.objectContaining({ id: 'item-1' }));

    await user.click(screen.getByRole('button', { name: /starred/i }));
    expect(useCollectionStore.getState().toggleFavorite).toHaveBeenCalledWith('item-1');

    await user.click(screen.getByRole('button', { name: /read/i }));
    expect(useCollectionStore.getState().toggleRead).toHaveBeenCalledWith('item-1');

    await user.click(screen.getAllByRole('button', { name: /edit/i })[1]);
    await user.clear(screen.getByPlaceholderText(/add notes about this item/i));
    await user.type(screen.getByPlaceholderText(/add notes about this item/i), 'Updated panel notes');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(useCollectionStore.getState().updateItem).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({
        notes: 'Updated panel notes',
        customFields: expect.objectContaining({ notes: 'Updated panel notes' }),
      }),
    );
  });

  it('supports image browsing, svg download, and archive confirmation', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const createElementSpy = vi.spyOn(document, 'createElement');
    const anchorClick = vi.fn();
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return { click: anchorClick, href: '', download: '' } as unknown as HTMLAnchorElement;
      }
      return document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as unknown as HTMLElement;
    });

    renderWithRouter(<ItemDetailPanel itemId="item-1" onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /download svg/i }));
    expect(anchorClick).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(screen.getByText(/archive item/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /archive/i }));

    await waitFor(() => {
      expect(useCollectionStore.getState().deleteItem).toHaveBeenCalledWith('item-1');
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows healed current valuation amounts when old items carry the broken TRY fallback', () => {
    const seed = buildSeedData();
    seed.items[0] = {
      ...seed.items[0],
      purchaseInfo: {
        ...seed.items[0].purchaseInfo,
        purchasedAt: '2021-06-08',
        purchasePrice: 200,
        purchaseCurrency: 'USD',
        currencyEquivalents: [
          { currency: 'USD', rate: 8.59, value: 200 },
          { currency: 'EUR', rate: 10.47, value: 164.17 },
          { currency: 'GBP', rate: 12.16, value: 141.35 },
        ],
      },
      valuationInfo: {
        ...seed.items[0].valuationInfo,
        currentEstimatedValue: 200,
        currentValueCurrency: 'TRY',
        valueHistory: [{ date: '2021-06-08', value: 200, currency: 'TRY' }],
      },
    };
    seedCollectionStore(seed);

    renderWithRouter(<ItemDetailPanel itemId="item-1" onClose={vi.fn()} />);

    expect(screen.getAllByText(/\$200(?:\.00)?/i).length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText(/Purchased:\s*\$200(?:\.00)?/i)).toBeInTheDocument();
  });
});
