import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ItemForm from '@/pages/ItemForm';
import { currencyService } from '@/services/currencyService';
import { bookSearchService } from '@/services/bookSearchService';
import { seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useCollectionStore } from '@/store/useCollectionStore';

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

describe('ItemForm behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const seed = buildSeedData();
    seedCollectionStore(seed);
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
    useCollectionStore.setState({
      addItem: vi.fn((item) => ({
        ...item,
        id: 'created-item',
        createdAt: '2024-06-08T00:00:00.000Z',
        updatedAt: '2024-06-08T00:00:00.000Z',
      })),
      updateItem: vi.fn(),
    });

    vi.spyOn(currencyService, 'getHistoricalRates').mockResolvedValue({
      USD: 1 / 31,
      EUR: 1 / 34,
      GBP: 1 / 39,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderItemForm(initialEntry: string, path: string, initialEntries?: string[], initialIndex?: number) {
    return render(
      <MemoryRouter initialEntries={initialEntries ?? [initialEntry]} initialIndex={initialIndex}>
        <Routes>
          <Route path={path} element={<ItemForm />} />
          <Route path="/items/:itemId" element={<div>Item Detail Route</div>} />
          <Route path="/collections/:categorySlug" element={<div>Collection Detail Route</div>} />
          <Route path="/collections" element={<div>Collections Route</div>} />
          <Route path="/admin/categories/new" element={<div>Create Category Route</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('creates a new item with purchase-date rates and purchase-currency valuation defaults', async () => {
    const user = userEvent.setup();

    renderItemForm('/items/new?category=books', '/items/new');

    await user.type(screen.getByLabelText(/^title/i), 'Foundation');
    await user.click(screen.getByRole('combobox', { name: /condition/i }));
    await user.click(await screen.findByRole('option', { name: 'Good' }));

    await user.click(screen.getByRole('combobox', { name: /purchase currency/i }));
    await user.click(await screen.findByRole('option', { name: /\$ USD/i }));

    fireEvent.change(screen.getByLabelText(/purchase date/i), { target: { value: '2024-06-08' } });
    fireEvent.change(screen.getByLabelText(/purchase price/i), { target: { value: '200' } });

    await waitFor(() => {
      expect(currencyService.getHistoricalRates).toHaveBeenCalledWith('2024-06-08', 'TRY');
    });

    expect(document.querySelector('label[for="usdRate"]')?.textContent).toContain('1 USD = 31.00 TL');

    await user.click(screen.getByRole('button', { name: /save item/i }));

    await waitFor(() => {
      expect(useCollectionStore.getState().addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Foundation',
          categoryId: 'cat-books',
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

  it('updates an existing item while preserving the edit route flow', async () => {
    const user = userEvent.setup();

    renderItemForm('/items/item-1/edit', '/items/:itemId/edit');

    const titleField = screen.getByLabelText(/^title/i);
    await user.clear(titleField);
    await user.type(titleField, 'Dune Messiah');
    fireEvent.change(screen.getByLabelText(/purchase price/i), { target: { value: '45' } });

    await user.click(screen.getByRole('button', { name: /update item/i }));

    await waitFor(() => {
      expect(useCollectionStore.getState().updateItem).toHaveBeenCalledWith(
        'item-1',
        expect.objectContaining({
          title: 'Dune Messiah',
          purchaseInfo: expect.objectContaining({
            purchasePrice: 45,
            purchaseCurrency: 'USD',
          }),
        }),
      );
    });
  });

  it('shows the category chooser when no category is selected and can move into a category form', async () => {
    const user = userEvent.setup();

    renderItemForm('/items/new', '/items/new');

    expect(screen.getByText(/choose a collection to add your item to/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /books/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /books/i }));

    expect(await screen.findByText(/purchase information/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search open library/i })).toBeInTheDocument();
  });

  it('shows the empty-category CTA when no categories exist', () => {
    seedCollectionStore({ categories: [], items: [], libraries: [], contributors: [] });

    renderItemForm('/items/new', '/items/new');

    expect(screen.getByText(/no categories yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create category/i })).toHaveAttribute('href', '/admin/categories/new');
  });

  it('auto-fills book data from the search dialog', async () => {
    const user = userEvent.setup();
    vi.spyOn(bookSearchService, 'search').mockResolvedValue([
      {
        key: '/works/OL123W',
        title: 'Hyperion',
        author: 'Dan Simmons',
        publishYear: 1989,
        publisher: 'Doubleday',
        isbn: '9780553283686',
        pageCount: 482,
        coverUrl: 'https://example.com/hyperion.jpg',
        coverUrlLarge: 'https://example.com/hyperion-large.jpg',
        languages: ['English'],
        subjects: ['Science fiction'],
      },
    ]);

    renderItemForm('/items/new?category=books', '/items/new');

    await user.click(screen.getByRole('button', { name: /search open library/i }));
    const searchInput = await screen.findByPlaceholderText(/type at least 3 characters to search/i);
    await user.type(searchInput, 'hyperion');
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByText('Hyperion')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /hyperion/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^title/i)).toHaveValue('Hyperion');
    });
    expect(screen.getByDisplayValue('Dan Simmons')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doubleday')).toBeInTheDocument();
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Filled form with "Hyperion"');
  });

  it('shows the empty-search state when the book search returns no results', async () => {
    const user = userEvent.setup();
    vi.spyOn(bookSearchService, 'search').mockResolvedValue([]);

    renderItemForm('/items/new?category=books', '/items/new');

    await user.click(screen.getByRole('button', { name: /search open library/i }));
    const searchInput = await screen.findByPlaceholderText(/type at least 3 characters to search/i);
    await user.type(searchInput, 'zzz');
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByText(/no results found/i)).toBeInTheDocument();
    expect(screen.getByText(/try a different search term/i)).toBeInTheDocument();
  });

  it('rejects unsupported and oversized image uploads', async () => {
    renderItemForm('/items/new?category=books', '/items/new');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const invalidFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    const largeFile = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'poster.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith('notes.txt: Unsupported format');
      expect(mocks.toastError).toHaveBeenCalledWith('poster.png: File too large (max 10MB)');
    });
  });

  it('prompts before leaving with unsaved changes and can stay or leave', async () => {
    const user = userEvent.setup();

    renderItemForm(
      '/items/new?category=books',
      '/items/new',
      ['/collections/books', '/items/new?category=books'],
      1,
    );

    await user.type(screen.getByLabelText(/^title/i), 'Left Hand of Darkness');
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(await screen.findByRole('heading', { name: /unsaved changes/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /stay on page/i }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /unsaved changes/i })).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await user.click(await screen.findByRole('button', { name: /leave page/i }));

    expect(await screen.findByText('Collection Detail Route')).toBeInTheDocument();
  });

  it('supports save and add another by resetting the form after create', async () => {
    const user = userEvent.setup();

    renderItemForm('/items/new?category=books', '/items/new');

    await user.type(screen.getByLabelText(/^title/i), 'Snow Crash');
    await user.click(screen.getByRole('combobox', { name: /condition/i }));
    await user.click(await screen.findByRole('option', { name: 'Fair' }));
    fireEvent.change(screen.getByLabelText(/purchase price/i), { target: { value: '18' } });

    await user.click(screen.getByRole('button', { name: /save & add another/i }));

    await waitFor(() => {
      expect(useCollectionStore.getState().addItem).toHaveBeenCalled();
    });

    expect(screen.getByLabelText(/^title/i)).toHaveValue('');
    expect(screen.queryByText('Item Detail Route')).not.toBeInTheDocument();
  });
});
