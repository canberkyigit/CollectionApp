import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminBulkActions from '@/pages/AdminBulkActions';
import { renderWithRouter, seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useCollectionStore } from '@/store/useCollectionStore';

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return { ...actual, toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } };
});

describe('AdminBulkActions bulk edits', () => {
  beforeEach(() => {
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
    seedCollectionStore(buildSeedData());
  });

  it('sets location and current value for the selection', async () => {
    const user = userEvent.setup();
    const bulkUpdateItems = vi.fn();
    const bulkSetCurrentValue = vi.fn();
    useCollectionStore.setState({ bulkUpdateItems, bulkSetCurrentValue });
    renderWithRouter(<AdminBulkActions />);

    await user.click(screen.getByRole('checkbox', { name: /select all/i }));
    await user.click(screen.getByRole('button', { name: /set location/i }));
    await user.type(screen.getByLabelText(/location for selected items/i), 'Study shelf');
    await user.click(screen.getByRole('button', { name: /^apply$/i }));
    expect(bulkUpdateItems).toHaveBeenCalledWith(
      expect.arrayContaining(['item-1', 'item-2']),
      { location: 'Study shelf' },
      expect.any(String),
    );

    await user.click(screen.getByRole('checkbox', { name: /select all/i }));
    await user.click(screen.getByRole('button', { name: /set current value/i }));
    await user.type(screen.getByLabelText(/amount/i), '125,5');
    await user.click(screen.getByRole('button', { name: /^apply$/i }));
    expect(bulkSetCurrentValue).toHaveBeenCalledWith(expect.arrayContaining(['item-1']), 125.5, 'USD');
  });

  it('removes a tag, sets a category field, and moves items into a library', async () => {
    const user = userEvent.setup();
    const bulkRemoveTag = vi.fn();
    const bulkSetCustomField = vi.fn();
    const bulkTransferToLibrary = vi.fn();
    useCollectionStore.setState({ bulkRemoveTag, bulkSetCustomField, bulkTransferToLibrary });
    renderWithRouter(<AdminBulkActions />);

    // Field editing needs a category filter.
    await user.click(screen.getByRole('combobox', { name: /filter by category/i }));
    await user.click(await screen.findByRole('option', { name: 'Books' }));
    await user.click(screen.getByRole('checkbox', { name: /select all/i }));

    await user.click(screen.getByRole('combobox', { name: /remove tag/i }));
    await user.click(await screen.findByRole('option', { name: 'test' }));
    expect(bulkRemoveTag).toHaveBeenCalledWith(expect.arrayContaining(['item-1']), 'test');

    await user.click(screen.getByRole('checkbox', { name: /select all/i }));
    await user.click(screen.getByRole('button', { name: /set field/i }));
    await user.click(screen.getByRole('combobox', { name: /^field$/i }));
    await user.click(await screen.findByRole('option', { name: 'Publisher' }));
    await user.type(screen.getByLabelText(/^value$/i), 'Gollancz');
    await user.click(screen.getByRole('button', { name: /^apply$/i }));
    expect(bulkSetCustomField).toHaveBeenCalledWith(expect.arrayContaining(['item-1']), 'publisher', 'Gollancz');

    await user.click(screen.getByRole('checkbox', { name: /select all/i }));
    await user.click(screen.getByRole('combobox', { name: /set library/i }));
    await user.click(await screen.findByRole('option', { name: 'Main Shelf' }));
    expect(bulkTransferToLibrary).toHaveBeenCalledWith(expect.arrayContaining(['item-1']), 'lib-books');
  });

  it('renames tags through the tag manager, merging into existing tags', async () => {
    const user = userEvent.setup();
    const seed = buildSeedData();
    seedCollectionStore({
      ...seed,
      items: seed.items.map((item, index) => ({ ...item, tags: index === 0 ? ['scifi', 'classic'] : ['classic'] })),
    });
    renderWithRouter(<AdminBulkActions />);

    await user.click(screen.getByRole('button', { name: /manage tags/i }));
    const dialog = await screen.findByRole('dialog', { name: /manage tags/i });
    expect(within(dialog).getByText('scifi')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /rename scifi/i }));
    const input = within(dialog).getByRole('textbox', { name: /rename scifi/i });
    await user.clear(input);
    await user.type(input, 'classic');
    expect(within(dialog).getByText(/will merge into the existing tag/i)).toBeInTheDocument();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(useCollectionStore.getState().items.find((item) => item.id === 'item-1')?.tags).toEqual(['classic']);
    });

    await user.click(within(dialog).getByRole('button', { name: /delete classic/i }));
    const confirm = (await screen.findAllByRole('dialog')).find((node) => /delete “classic”/i.test(node.textContent ?? ''));
    await user.click(within(confirm as HTMLElement).getByRole('button', { name: /^delete$/i }));
    await waitFor(() => {
      expect(useCollectionStore.getState().items.every((item) => !item.tags.includes('classic'))).toBe(true);
    });
  });
});
