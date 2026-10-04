import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import AdminArchive from '@/pages/AdminArchive';
import { seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useCollectionStore } from '@/store/useCollectionStore';

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
}));

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return {
    ...actual,
    toast: {
      success: mocks.toastSuccess,
    },
  };
});

describe('AdminArchive behaviors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
    const seed = buildSeedData();
    seed.items.push({
      ...seed.items[0],
      id: 'item-4',
      title: 'Archived Vinyl',
      categoryId: 'cat-vinyl',
      isArchived: true,
      archivedAt: '2024-05-10',
      updatedAt: '2024-05-10',
      images: [],
    });
    seedCollectionStore(seed);
  });

  it('supports filtering, bulk recover, single delete, and empty archive actions', async () => {
    const user = userEvent.setup();
    const recoverItems = vi.fn();
    const permanentDeleteItem = vi.fn();
    const permanentDeleteItems = vi.fn();

    useCollectionStore.setState({
      recoverItems,
      permanentDeleteItem,
      permanentDeleteItems,
    });

    render(
      <MemoryRouter initialEntries={['/admin/archive?from=settings']}>
        <Routes>
          <Route path="/admin/archive" element={<AdminArchive />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Archive' })).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/search archive/i), 'missing');
    expect(screen.getByText(/no items match your filters/i)).toBeInTheDocument();
    await user.clear(screen.getByPlaceholderText(/search archive/i));

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Books' }));
    expect(screen.getByText('Archived Book')).toBeInTheDocument();
    expect(screen.queryByText('Archived Vinyl')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /select all/i }));
    await user.click(screen.getAllByRole('button', { name: /^recover$/i })[0]);
    expect(recoverItems).toHaveBeenCalledWith(['item-3']);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'All categories' }));

    const archivedRow = screen.getByText('Archived Book').closest('tr');
    expect(archivedRow).not.toBeNull();
    await user.click(within(archivedRow as HTMLElement).getAllByRole('button')[1]);

    const deleteOneDialog = screen.getByRole('dialog');
    await user.click(within(deleteOneDialog).getByRole('button', { name: /delete forever/i }));
    expect(permanentDeleteItem).toHaveBeenCalledWith('item-3');

    await user.click(screen.getByRole('button', { name: /empty archive/i }));
    const deleteAllDialog = screen.getByRole('dialog');
    await user.click(within(deleteAllDialog).getByRole('button', { name: /delete forever/i }));
    expect(permanentDeleteItems).toHaveBeenCalledWith(
      expect.arrayContaining(['item-3', 'item-4']),
    );
  });

  it('renders a recovery empty state when no archived items exist', async () => {
    const user = userEvent.setup();
    seedCollectionStore({
      ...buildSeedData(),
      items: buildSeedData().items.filter((item) => !item.isArchived),
    });

    render(
      <MemoryRouter initialEntries={['/admin/archive?from=settings']}>
        <Routes>
          <Route path="/admin/archive" element={<AdminArchive />} />
          <Route path="/settings" element={<div>Settings Landing</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/archive is empty/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /back to admin/i }));
    expect(await screen.findByText('Settings Landing')).toBeInTheDocument();
  });
});
