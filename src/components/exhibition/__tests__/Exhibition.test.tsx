import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import Exhibition from '@/pages/Exhibition';
import { renderWithRouter, seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';

describe('Exhibition page', () => {
  beforeEach(() => {
    localStorage.removeItem('curio-exhibition-prefs');
    const seed = buildSeedData();
    seedCollectionStore({
      ...seed,
      items: seed.items.map((item, index) => ({ ...item, images: [`https://example.com/photo-${index}.jpg`] })),
    });
    seedAuthStore({ role: 'admin' });
  });

  it('starts a full-screen show, moves with the arrow keys and closes with Escape', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Exhibition />);

    expect(screen.getByRole('heading', { name: 'Exhibition mode' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /all collections/i })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: /start exhibition/i }));
    const stage = await screen.findByRole('dialog', { name: 'Exhibition' });
    expect(stage).toBeInTheDocument();
    expect(screen.getByText(/^1 \/ \d+$/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByText(/^2 \/ \d+$/)).toBeInTheDocument());

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => expect(screen.getByText(/^1 \/ \d+$/)).toBeInTheDocument());

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Exhibition' })).not.toBeInTheDocument());
  });

  it('lets you pick a single collection and remembers settings', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Exhibition />);

    await user.click(screen.getByRole('radio', { name: /vinyl/i }));
    expect(screen.getByRole('radio', { name: /vinyl/i })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('switch', { name: /show values/i }));
    expect(JSON.parse(localStorage.getItem('curio-exhibition-prefs') ?? '{}').showValues).toBe(true);
  });
});
