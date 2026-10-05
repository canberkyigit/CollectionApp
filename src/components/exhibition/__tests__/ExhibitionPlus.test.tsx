import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExhibitionStage } from '@/components/exhibition/ExhibitionStage';
import { buildExhibitionSlides } from '@/lib/exhibition';
import { useSavedExhibitionsStore } from '@/lib/savedExhibitions';
import Exhibition from '@/pages/Exhibition';
import { renderWithRouter, seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';

function seedWithPhotos() {
  const seed = buildSeedData();
  const items = seed.items.map((item, index) => ({ ...item, images: [`https://example.com/photo-${index}.jpg`] }));
  seedCollectionStore({ ...seed, items });
  seedAuthStore({ role: 'admin' });
  return { ...seed, items };
}

describe('Exhibition – saved exhibitions, QR and kiosk', () => {
  beforeEach(() => {
    localStorage.removeItem('curio-exhibition-prefs');
    useSavedExhibitionsStore.setState({ exhibitions: [] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a curated exhibition and plays it in the chosen order with a QR code', async () => {
    const user = userEvent.setup();
    const { items } = seedWithPhotos();
    renderWithRouter(<Exhibition />);

    await user.click(screen.getByRole('button', { name: /curate your own exhibition/i }));
    const dialog = await screen.findByRole('dialog', { name: /new exhibition/i });
    await user.type(within(dialog).getByLabelText(/exhibition name/i), 'Highlights');

    // Pick two pieces, then move the second one to the top.
    const [a, b] = items;
    await user.click(within(dialog).getByRole('button', { name: new RegExp(a.title) , pressed: false }));
    await user.click(within(dialog).getByRole('button', { name: new RegExp(b.title), pressed: false }));
    await user.click(within(dialog).getByRole('button', { name: `Move ${b.title} up` }));
    await user.click(within(dialog).getByRole('button', { name: /create exhibition/i }));

    const tile = await screen.findByRole('radio', { name: /highlights/i });
    expect(tile).toHaveAttribute('aria-checked', 'true');
    expect(useSavedExhibitionsStore.getState().exhibitions[0].itemIds).toEqual([b.id, a.id]);

    await user.click(screen.getByRole('button', { name: /start exhibition/i }));
    const stage = await screen.findByRole('dialog', { name: 'Exhibition' });
    expect(within(stage).getByRole('heading', { name: b.title })).toBeInTheDocument();
    expect(within(stage).getByRole('img', { name: `QR code for ${b.title}` })).toBeInTheDocument();
  });

  it('hides the controls in kiosk mode after a few idle seconds and shows them again on movement', () => {
    vi.useFakeTimers();
    const { items, categories } = seedWithPhotos();
    const slides = buildExhibitionSlides(items, categories, { source: 'all', onlyWithPhotos: true, shuffle: false });
    render(
      <ExhibitionStage
        slides={slides}
        intervalSeconds={60}
        autoplay={false}
        showValues={false}
        kiosk
        displayCurrency="USD"
        onExit={() => {}}
      />,
    );

    const controls = screen.getByRole('button', { name: 'Pause', hidden: true }).closest('div.absolute') as HTMLElement;
    expect(controls.className).not.toContain('opacity-0');

    act(() => { vi.advanceTimersByTime(3100); });
    expect(controls.className).toContain('opacity-0');

    act(() => { fireEvent.mouseMove(window); });
    expect(controls.className).not.toContain('opacity-0');
  });

  it('starts the show by itself when kiosk idle start is set', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    seedWithPhotos();
    localStorage.setItem('curio-exhibition-prefs', JSON.stringify({ kiosk: true, idleStartMinutes: 1 }));
    renderWithRouter(<Exhibition />);

    expect(screen.queryByRole('dialog', { name: 'Exhibition' })).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(61_000); });
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Exhibition' })).toBeInTheDocument());
  });
});
