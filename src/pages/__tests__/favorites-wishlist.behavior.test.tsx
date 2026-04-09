import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Favorites from '@/pages/Favorites';
import Wishlist from '@/pages/Wishlist';
import { seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useCollectionStore } from '@/store/useCollectionStore';

describe('favorites and wishlist behaviors', () => {
  beforeEach(() => {
    seedCollectionStore(buildSeedData());
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
  });

  it('shows a loading skeleton before favorites hydrate and routes empty-state actions', async () => {
    const seed = buildSeedData();
    seedCollectionStore({
      categories: seed.categories,
      items: [],
      libraries: seed.libraries,
      contributors: seed.contributors,
      wishlist: seed.wishlist,
      activityLog: seed.activityLog,
    });
    useCollectionStore.setState({
      ownerUserId: 'contrib-1',
      isRemoteDataLoading: true,
    });

    const loadingView = render(
      <MemoryRouter initialEntries={['/favorites']}>
        <Routes>
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/collections" element={<div>Collections Landing</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(loadingView.container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    loadingView.unmount();

    const emptySeed = buildSeedData();
    seedCollectionStore({
      categories: emptySeed.categories,
      items: emptySeed.items.map((item) => ({ ...item, isFavorite: false })),
      libraries: emptySeed.libraries,
      contributors: emptySeed.contributors,
      wishlist: emptySeed.wishlist,
      activityLog: emptySeed.activityLog,
    });
    useCollectionStore.setState({
      ownerUserId: 'contrib-1',
      isRemoteDataLoading: false,
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/favorites']}>
        <Routes>
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/collections" element={<div>Collections Landing</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /browse collections/i }));
    expect(await screen.findByText('Collections Landing')).toBeInTheDocument();
  });

  it('supports favorites list mode actions for view, edit, and unfavorite', async () => {
    const user = userEvent.setup();
    const toggleFavorite = vi.fn();
    const openItemDialog = vi.fn();
    useCollectionStore.setState({ toggleFavorite, openItemDialog });

    const view = render(<MemoryRouter><Favorites /></MemoryRouter>);
    const allButtons = () => Array.from(view.container.querySelectorAll('button')) as HTMLButtonElement[];

    const listToggle = allButtons().find((button) => button.querySelector('.lucide-list'));
    expect(listToggle).toBeDefined();
    await user.click(listToggle!);

    const menuTriggers = Array.from(
      view.container.querySelectorAll('button[aria-haspopup="menu"]'),
    ) as HTMLButtonElement[];
    const menuTrigger = menuTriggers.at(-1) ?? null;
    expect(menuTrigger).toBeDefined();
    await user.click(menuTrigger!);
    await user.click(await screen.findByRole('menuitem', { name: /view/i }));

    expect(await screen.findByText(/purchase information/i)).toBeInTheDocument();

    await user.click(menuTrigger!);
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(openItemDialog).toHaveBeenCalledWith('cat-books', expect.objectContaining({ id: 'item-1' }));

    await user.click(menuTrigger!);
    await user.click(await screen.findByRole('menuitem', { name: /unfavorite/i }));
    expect(toggleFavorite).toHaveBeenCalledWith('item-1');
  });

  it('covers wishlist loading, acquired visibility, and delete confirmation', async () => {
    const seed = buildSeedData();
    seedCollectionStore({
      categories: [],
      items: seed.items,
      libraries: seed.libraries,
      contributors: seed.contributors,
      wishlist: [],
      activityLog: seed.activityLog,
    });
    useCollectionStore.setState({
      ownerUserId: 'contrib-1',
      isRemoteDataLoading: true,
    });

    const loadingView = render(<MemoryRouter><Wishlist /></MemoryRouter>);
    expect(loadingView.container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    loadingView.unmount();

    const deleteWishlistItem = vi.fn();
    const updateWishlistItem = vi.fn();
    const loadedSeed = buildSeedData();
    loadedSeed.wishlist.push({
      ...loadedSeed.wishlist[0],
      id: 'wish-2',
      title: 'Acquired Camera',
      isAcquired: true,
    });
    seedCollectionStore(loadedSeed);
    useCollectionStore.setState({
      ownerUserId: 'contrib-1',
      isRemoteDataLoading: false,
      deleteWishlistItem,
      updateWishlistItem,
    });

    const user = userEvent.setup();
    const view = render(<MemoryRouter><Wishlist /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: /show acquired/i }));
    expect(await screen.findByText('Acquired Camera')).toBeInTheDocument();

    const actionButtons = Array.from(view.container.querySelectorAll('button')) as HTMLButtonElement[];
    const deleteButton = actionButtons.reverse().find((button) => button.querySelector('.lucide-trash2'));
    expect(deleteButton).toBeDefined();
    await user.click(deleteButton!);
    await user.click(screen.getByRole('button', { name: /^remove$/i }));

    expect(deleteWishlistItem).toHaveBeenCalled();
    expect(updateWishlistItem).not.toHaveBeenCalled();
  });
});
