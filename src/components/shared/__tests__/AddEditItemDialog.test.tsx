import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddEditItemDialog } from '@/components/shared/AddEditItemDialog';
import { renderWithRouter, seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useCollectionStore } from '@/store/useCollectionStore';
import { currencyService } from '@/services/currencyService';
import { aiCatalogService } from '@/services/aiCatalogService';
import { setIntegrationKey } from '@/lib/integrationKeys';

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

    await user.click(screen.getByRole('combobox', { name: /purchase currency/i }));
    await user.click(await screen.findByRole('option', { name: /\$ USD/i }));

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

  it('seeds a new item from a wishlist prefill and marks the wishlist entry acquired', async () => {
    const user = userEvent.setup();
    const acquireWishlistItem = vi.fn();
    const addItem = vi.fn((item) => ({ ...item, id: 'new-item-1', createdAt: '', updatedAt: '' }));
    useCollectionStore.setState({
      itemDialogOptions: {
        wishlistId: 'wish-1',
        prefill: {
          title: 'Neuromancer',
          notes: 'Spotted at the fair',
          tags: ['cyberpunk'],
          purchasePrice: 80,
          purchaseCurrency: 'GBP',
          purchasePlace: 'Hay-on-Wye',
          images: ['https://example.com/neuromancer.jpg'],
        },
      },
      addItem,
      acquireWishlistItem,
    });

    renderWithRouter(<AddEditItemDialog />);

    expect(screen.getByText(/filled in from your wishlist/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^title/i)).toHaveValue('Neuromancer');
    expect(screen.getByLabelText(/purchase location/i)).toHaveValue('Hay-on-Wye');
    expect(screen.getByAltText('Photo 1')).toHaveAttribute('src', 'https://example.com/neuromancer.jpg');

    await user.click(screen.getByRole('combobox', { name: /condition/i }));
    await user.click(await screen.findByRole('option', { name: 'Fine' }));
    await user.click(screen.getByRole('button', { name: /save item/i }));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Neuromancer',
        notes: 'Spotted at the fair',
        tags: ['cyberpunk'],
        condition: 'Fine',
        images: ['https://example.com/neuromancer.jpg'],
        purchaseInfo: expect.objectContaining({ purchasePrice: 80, purchaseCurrency: 'GBP', purchaseLocation: 'Hay-on-Wye' }),
      }));
    });
    expect(acquireWishlistItem).toHaveBeenCalledWith('wish-1', 'new-item-1');
    expect(useCollectionStore.getState().closeItemDialog).toHaveBeenCalled();
  });

  it('records location, current value and valuation details', async () => {
    const user = userEvent.setup();
    useCollectionStore.setState({
      items: [
        ...useCollectionStore.getState().items,
        { ...buildSeedData().items[0], id: 'loc-item', location: 'Study / Cabinet A / Shelf 2' },
      ],
    });

    renderWithRouter(<AddEditItemDialog />);

    const options = Array.from(document.querySelectorAll('#dlg-location-options option')).map((option) => option.getAttribute('value'));
    expect(options).toEqual(expect.arrayContaining(['Study', 'Study / Cabinet A', 'Study / Cabinet A / Shelf 2']));

    await user.type(screen.getByLabelText(/^title/i), 'Snow Crash');
    await user.click(screen.getByRole('combobox', { name: /condition/i }));
    await user.click(await screen.findByRole('option', { name: 'Good' }));
    await user.type(screen.getByLabelText(/^location/i), 'Study / Cabinet A / Shelf 3');
    fireEvent.change(screen.getByLabelText(/current value/i), { target: { value: '150' } });
    await user.type(screen.getByLabelText(/valuation source/i), 'Dealer quote');
    fireEvent.change(screen.getByLabelText(/target value/i), { target: { value: '300' } });

    await user.click(screen.getByRole('button', { name: /save item/i }));

    await waitFor(() => {
      expect(useCollectionStore.getState().addItem).toHaveBeenCalledWith(expect.objectContaining({
        location: 'Study / Cabinet A / Shelf 3',
        valuationInfo: expect.objectContaining({
          currentEstimatedValue: 150,
          valuationSource: 'Dealer quote',
          targetEstimatedValue: 300,
          valueHistory: [expect.objectContaining({ value: 150, source: 'Dealer quote' })],
        }),
      }));
    });
  });

  it('uses the category condition scale and offers the matching catalogue lookup', async () => {
    const user = userEvent.setup();
    useCollectionStore.setState({ itemDialogCategoryId: 'cat-vinyl' });

    renderWithRouter(<AddEditItemDialog />);

    expect(screen.getByRole('button', { name: /look up on discogs/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /search open library/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: /condition/i }));
    expect(await screen.findByRole('option', { name: 'VG+ · Very Good Plus' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Near Mint' })).not.toBeInTheDocument();
  });

  it('explains how to connect Claude when no API key is configured', async () => {
    const user = userEvent.setup();
    localStorage.removeItem('curio-integration:anthropic');
    renderWithRouter(<AddEditItemDialog />);

    await user.click(screen.getByRole('button', { name: /identify from photo/i }));

    expect(await screen.findByText(/connect claude first/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open integrations/i })).toHaveAttribute('href', '/settings?section=integrations');
  });

  it('asks before discarding unsaved changes', async () => {
    const user = userEvent.setup();
    renderWithRouter(<AddEditItemDialog />);

    await user.type(screen.getByLabelText(/^title/i), 'Draft');
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(await screen.findByRole('heading', { name: /unsaved changes/i })).toBeInTheDocument();
    expect(useCollectionStore.getState().closeItemDialog).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /discard changes/i }));
    expect(useCollectionStore.getState().closeItemDialog).toHaveBeenCalled();
  });

  it('reviews AI suggestions per field and never overwrites without consent', async () => {
    const user = userEvent.setup();
    setIntegrationKey('anthropic', 'sk-test');
    const identify = vi.spyOn(aiCatalogService, 'identify').mockResolvedValue({
      identified: true,
      notes: 'Recognised the cover art.',
      candidate: {
        provider: 'claude',
        title: 'Dune (Book Club Edition)',
        fields: [{ keys: ['publisher'], value: 'Chilton Books' }],
        tags: ['sci-fi'],
        confidence: 0.8,
      },
    });
    const existingItem = buildSeedData().items[0];
    useCollectionStore.setState({ itemDialogItem: existingItem, updateItem: vi.fn() });

    renderWithRouter(<AddEditItemDialog />);
    await user.click(screen.getByRole('button', { name: /identify from photo/i }));
    await user.click(await screen.findByRole('button', { name: /^identify$/i }));

    expect(identify).toHaveBeenCalledWith(expect.objectContaining({ image: 'https://example.com/dune.jpg' }));
    expect(await screen.findByText('Recognised the cover art.')).toBeInTheDocument();

    // Title and publisher would replace existing values → unticked; tags merge → ticked.
    expect(screen.getByRole('checkbox', { name: /title/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /publisher/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /tags/i })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: /publisher/i }));
    await user.click(screen.getByRole('button', { name: /apply 2 fields/i }));

    expect(screen.getByLabelText(/^title/i)).toHaveValue('Dune');
    expect(screen.getByDisplayValue('Chilton Books')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /update item/i }));
    await waitFor(() => {
      expect(useCollectionStore.getState().updateItem).toHaveBeenCalledWith(existingItem.id, expect.objectContaining({
        title: 'Dune',
        tags: ['test', 'sci-fi'],
        customFields: expect.objectContaining({ publisher: 'Chilton Books' }),
        sourceMetadata: expect.objectContaining({ provider: 'claude', confidence: 0.8, fields: ['publisher', 'tags'] }),
      }));
    });
    localStorage.removeItem('curio-integration:anthropic');
  });
});
