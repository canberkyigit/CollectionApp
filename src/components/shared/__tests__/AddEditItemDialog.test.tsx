import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddEditItemDialog } from '@/components/shared/AddEditItemDialog';
import { renderWithRouter, seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useCollectionStore } from '@/store/useCollectionStore';
import { currencyService } from '@/services/currencyService';

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  searchMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock('@/services/bookSearchService', () => ({
  bookSearchService: {
    search: mocks.searchMock,
  },
}));

describe('AddEditItemDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const seed = buildSeedData();
    seedCollectionStore(seed);
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });

    useCollectionStore.setState({
      itemDialogOpen: true,
      itemDialogCategoryId: 'cat-books',
      itemDialogItem: null,
      addItem: vi.fn(),
      updateItem: vi.fn(),
      closeItemDialog: vi.fn(),
    });

    vi.spyOn(currencyService, 'getHistoricalRates').mockResolvedValue({
      USD: 1 / 31,
      EUR: 1 / 34,
      GBP: 1 / 39,
    });
  });

  it('adds a new item and shows purchase-date currency equivalents', async () => {
    const user = userEvent.setup();
    renderWithRouter(<AddEditItemDialog />);

    await user.type(screen.getByLabelText(/^title/i), 'Foundation');
    await user.type(screen.getByLabelText(/^author/i), 'Isaac Asimov');

    await user.click(screen.getByRole('combobox', { name: /condition/i }));
    await user.click(await screen.findByRole('option', { name: 'Good' }));

    fireEvent.change(screen.getByLabelText(/purchase date/i), { target: { value: '2024-06-08' } });
    fireEvent.change(screen.getByLabelText(/purchase price/i), { target: { value: '100' } });

    await waitFor(() => {
      expect(currencyService.getHistoricalRates).toHaveBeenCalledWith('2024-06-08', 'TRY');
    });

    expect(screen.getByText(/1 USD = 31\.00 TL/i)).toBeInTheDocument();
    expect(screen.getByText(/\$3\.23/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save item/i }));

    await waitFor(() => {
      expect(useCollectionStore.getState().addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Foundation',
          categoryId: 'cat-books',
          purchaseInfo: expect.objectContaining({
            purchasePrice: 100,
            purchaseCurrency: 'TRY',
          }),
        }),
      );
    });
    expect(useCollectionStore.getState().closeItemDialog).toHaveBeenCalled();
  }, 15000);

  it('stores current valuation in the purchase currency for new non-TRY items', async () => {
    const user = userEvent.setup();
    renderWithRouter(<AddEditItemDialog />);

    await user.type(screen.getByLabelText(/^title/i), 'Hyperion');
    await user.type(screen.getByLabelText(/^author/i), 'Dan Simmons');

    await user.click(screen.getByRole('combobox', { name: /condition/i }));
    await user.click(await screen.findByRole('option', { name: 'Good' }));

    const currencyField = screen.getByText(/^Currency$/).parentElement?.querySelector('[role="combobox"]');
    expect(currencyField).not.toBeNull();
    await user.click(currencyField as HTMLElement);
    await user.click(await screen.findByText(/\$ USD/i));

    fireEvent.change(screen.getByLabelText(/purchase price/i), { target: { value: '200' } });
    await user.click(screen.getByRole('button', { name: /save item/i }));

    await waitFor(() => {
      expect(useCollectionStore.getState().addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          purchaseInfo: expect.objectContaining({
            purchasePrice: 200,
            purchaseCurrency: 'USD',
          }),
          valuationInfo: expect.objectContaining({
            currentEstimatedValue: 200,
            currentValueCurrency: 'USD',
          }),
        }),
      );
    });
  });

  it('loads book search results into the form and updates existing items', async () => {
    const user = userEvent.setup();
    mocks.searchMock.mockResolvedValue([
      {
        key: '/works/OL1W',
        title: 'The Left Hand of Darkness',
        author: 'Ursula K. Le Guin',
        publishYear: 1969,
        publisher: 'Ace',
        pageCount: 320,
        isbn: '9780441478125',
        coverUrl: '',
        coverUrlLarge: 'https://example.com/cover.jpg',
        languages: ['English'],
      },
    ]);

    const existingItem = buildSeedData().items[0];
    useCollectionStore.setState({
      itemDialogOpen: true,
      itemDialogCategoryId: 'cat-books',
      itemDialogItem: existingItem,
      updateItem: vi.fn(),
      closeItemDialog: vi.fn(),
    });

    renderWithRouter(<AddEditItemDialog />);

    await user.click(screen.getByRole('button', { name: /search open library/i }));
    await user.type(screen.getByPlaceholderText(/type at least 3 characters/i), 'left hand');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mocks.searchMock).toHaveBeenCalledWith('left hand', 12);
    });

    await user.click(screen.getByRole('button', { name: /the left hand of darkness/i }));
    expect(screen.getByDisplayValue('The Left Hand of Darkness')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ursula K. Le Guin')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /update item/i }));

    await waitFor(() => {
      expect(useCollectionStore.getState().updateItem).toHaveBeenCalledWith(
        existingItem.id,
        expect.objectContaining({
          title: 'The Left Hand of Darkness',
        }),
      );
    });
  });
});
