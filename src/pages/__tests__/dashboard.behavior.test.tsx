import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Dashboard from '@/pages/Dashboard';
import { renderWithRouter, seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';

describe('Dashboard', () => {
  beforeEach(() => {
    seedCollectionStore(buildSeedData());
    window.scrollTo = vi.fn();
  });

  it('applies the library scope to item widgets, not just the summary', async () => {
    const user = userEvent.setup();
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
    renderWithRouter(<Dashboard />);

    const recent = screen.getByRole('region', { name: 'Recently added' });
    expect(within(recent).getByText('Dune')).toBeInTheDocument();
    expect(within(recent).getByText('Kind of Blue')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Jazz Cabinet' }));
    expect(screen.getByRole('button', { name: 'Jazz Cabinet' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(recent).queryByText('Dune')).not.toBeInTheDocument();
    expect(within(recent).getByText('Kind of Blue')).toBeInTheDocument();
  });

  it('hides "Add item" from viewers', () => {
    seedAuthStore({ uid: 'contrib-1', displayName: 'Viewer', role: 'viewer' });
    renderWithRouter(<Dashboard />);
    expect(screen.queryByRole('button', { name: 'Add item' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wishlist' })).toBeInTheDocument();
  });

  it('shows "Add item" to editors', () => {
    seedAuthStore({ uid: 'contrib-1', displayName: 'Editor', role: 'editor' });
    renderWithRouter(<Dashboard />);
    expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New category' })).not.toBeInTheDocument();
  });
});
