import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import CollectionDetail from '@/pages/CollectionDetail';
import { useSavedViewsStore } from '@/lib/savedViews';
import { createMockItem } from '@/test/helpers';
import { seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return { ...actual, toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } };
});

vi.mock('@/components/shared/ItemDetailPanel', () => ({
  ItemDetailPanel: ({ itemId }: { itemId: string }) => <p>Detail Panel for {itemId}</p>,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

function renderCollection(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/collections/:categorySlug" element={<><CollectionDetail /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('collection view state in the URL and saved views', () => {
  beforeEach(() => {
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
    const seed = buildSeedData();
    seed.items.push({
      ...createMockItem({
        title: 'Şeker Portakalı',
        categoryId: 'cat-books',
        customFields: { title: 'Şeker Portakalı', author: 'José Mauro de Vasconcelos' },
      }),
      id: 'item-seker',
      createdAt: '2024-04-01',
      updatedAt: '2024-04-01',
    });
    seedCollectionStore(seed);
    useSavedViewsStore.setState({ savedViews: [] });
  });

  it('restores search and filters from the query string (accent-insensitive)', () => {
    renderCollection('/collections/books?q=seker%20portakali&view=table');

    expect(screen.getByPlaceholderText(/search books/i)).toHaveValue('seker portakali');
    expect(screen.getByText('Şeker Portakalı')).toBeInTheDocument();
    expect(screen.queryByText('Dune')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('writes edits back to the URL and applies saved views', async () => {
    const user = userEvent.setup();
    renderCollection('/collections/books');

    await user.type(screen.getByPlaceholderText(/search books/i), 'dune');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('q=dune'));
    expect(screen.queryByText('Şeker Portakalı')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^views$/i }));
    await user.click(await screen.findByRole('menuitem', { name: /save current view/i }));
    await user.type(screen.getByLabelText(/^name$/i), 'Just Dune');
    await user.click(screen.getByRole('button', { name: /^save view$/i }));

    const [saved] = useSavedViewsStore.getState().savedViews;
    expect(saved).toEqual(expect.objectContaining({ name: 'Just Dune', categoryId: 'cat-books', search: 'dune' }));
    expect(screen.getByRole('button', { name: /just dune/i })).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText(/search books/i));
    expect(await screen.findByText('Şeker Portakalı')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^views$/i }));
    await user.click(await screen.findByRole('menuitem', { name: /just dune/i }));

    expect(screen.getByPlaceholderText(/search books/i)).toHaveValue('dune');
    expect(screen.queryByText('Şeker Portakalı')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('q=dune');
  });
});
