import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';

import Topbar from '@/components/layout/Topbar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useCollectionStore } from '@/store/useCollectionStore';
import { useSyncStore } from '@/store/useSyncStore';
import { useLanguageStore } from '@/i18n';

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    start = vi.fn().mockRejectedValue(new Error('NotFound'));
    stop = vi.fn().mockResolvedValue(undefined);
    clear = vi.fn();
    getState = vi.fn(() => 1);
  },
}));

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return { ...actual, toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() }, Toaster: () => null };
});

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
};

function renderTopbar(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Topbar />
      </TooltipProvider>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('topbar navigation & search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedCollectionStore(buildSeedData());
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
    useCollectionStore.setState({
      searchQuery: '',
      readNotificationIds: [],
      notifications: { valueChangeAlerts: true, newItemReminders: true, collectionMilestones: true },
    });
    useSyncStore.getState().reset();
    act(() => useLanguageStore.getState().setLanguage('en'));
  });

  it('gives every icon-only control an accessible name', () => {
    renderTopbar();
    for (const name of [/toggle sidebar/i, /open search/i, /scan qr label/i, /sync status/i, /toggle theme/i, /open notifications/i, /open account menu/i]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('matches custom fields accent-insensitively and opens the highlighted result with Enter', async () => {
    const user = userEvent.setup();
    renderTopbar();

    const input = screen.getByRole('combobox', { name: /search the collection/i });
    await user.type(input, 'HERBERT');
    const listbox = await screen.findByRole('listbox', { name: /search results/i });
    expect(within(listbox).getByText('Dune')).toBeInTheDocument();
    expect(within(listbox).getByText(/Author: Frank Herbert/)).toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(screen.getByTestId('location')).toHaveTextContent('/items/item-1');
    expect(useCollectionStore.getState().searchQuery).toBe('');
  });

  it('moves through results with the arrow keys and shows an empty state', async () => {
    const user = userEvent.setup();
    renderTopbar();
    const input = screen.getByRole('combobox', { name: /search the collection/i });

    await user.type(input, 'book');
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    const active = screen.getAllByRole('option').find((option) => option.getAttribute('aria-selected') === 'true');
    expect(input).toHaveAttribute('aria-activedescendant', active?.id);

    await user.clear(input);
    await user.type(input, 'zzqx');
    expect(screen.getByText('No results for “zzqx”')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
  });

  it('opens the command palette with Ctrl+K and runs commands from the keyboard', async () => {
    const user = userEvent.setup();
    renderTopbar();

    await user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: /command palette/i });
    expect(within(dialog).getByRole('option', { name: /add item/i })).toBeInTheDocument();

    const input = within(dialog).getByRole('combobox');
    await user.type(input, 'favor');
    expect(within(dialog).getByRole('option', { name: /favorites/i })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('dialog', { name: /command palette/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/favorites');
  });

  it('finds items, categories and libraries in the palette and switches language', async () => {
    const user = userEvent.setup();
    renderTopbar();

    await user.keyboard('{Meta>}k{/Meta}');
    let dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('combobox'), 'jazz');
    expect(within(dialog).getByText('Libraries')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('option', { name: /jazz cabinet/i }));
    expect(screen.getByTestId('location')).toHaveTextContent('/collections/vinyl?library=lib-vinyl');

    await user.keyboard('{Meta>}k{/Meta}');
    dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('combobox'), 'türkçe');
    await user.click(within(dialog).getByRole('option', { name: /switch language to türkçe/i }));
    expect(useLanguageStore.getState().language).toBe('tr');
    expect(screen.getByRole('button', { name: /kenar çubuğunu/i })).toBeInTheDocument();
  });

  it('hides "Add item" from viewers', async () => {
    const user = userEvent.setup();
    seedAuthStore({ uid: 'contrib-2', displayName: 'Grace Guest', role: 'viewer' });
    renderTopbar();

    await user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('option', { name: /add item/i })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: /statistics/i })).toBeInTheDocument();
  });

  it('shows loan reminders in the bell and counts overdue ones as unread', async () => {
    const user = userEvent.setup();
    renderTopbar();

    // Every seeded activity entry is unread, plus one overdue loan (Dune).
    const expectedUnread = useCollectionStore.getState().activityLog.length + 1;
    const bell = screen.getByRole('button', { name: /open notifications/i });
    expect(bell).toHaveAccessibleName(`Open notifications (${expectedUnread} unread)`);
    await user.click(bell);

    const reminders = await screen.findByRole('region', { name: 'Reminders' });
    expect(within(reminders).getByText('Dune')).toBeInTheDocument();
    expect(within(reminders).getByText(/^Overdue by \d+ days$/)).toBeInTheDocument();
    expect(within(reminders).getByText('Lent to John Reader')).toBeInTheDocument();

    await user.click(within(reminders).getByRole('button', { name: /dune/i }));
    expect(screen.getByTestId('location')).toHaveTextContent('/items/item-1');
  });

  it('hides reminders when loan & maintenance reminders are turned off', async () => {
    const user = userEvent.setup();
    useCollectionStore.setState({
      notifications: { valueChangeAlerts: true, newItemReminders: false, collectionMilestones: true },
    });
    renderTopbar();

    await user.click(screen.getByRole('button', { name: /open notifications/i }));
    expect(await screen.findByText('Notifications')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Reminders' })).not.toBeInTheDocument();
  });

  it('opens the QR scanner from the topbar and navigates to a pasted label link', async () => {
    const user = userEvent.setup();
    renderTopbar();

    await user.click(screen.getByRole('button', { name: /scan qr label/i }));
    const dialog = await screen.findByRole('dialog', { name: /scan item label/i });
    await user.click(within(dialog).getByRole('button', { name: /manual/i }));
    await user.type(within(dialog).getByLabelText(/label link or item id/i), 'https://another-host.app/items/item-2');
    await user.click(within(dialog).getByRole('button', { name: /^open$/i }));

    expect(screen.getByTestId('location')).toHaveTextContent('/items/item-2');
  });
});
