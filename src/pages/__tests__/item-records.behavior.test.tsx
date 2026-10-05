import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ItemDetail from '@/pages/ItemDetail';
import LendingTracker from '@/pages/LendingTracker';
import Wishlist from '@/pages/Wishlist';
import { todayISO } from '@/lib/utils';
import { renderWithRouter, seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useCollectionStore } from '@/store/useCollectionStore';

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock('@/services/storageService', async () => {
  const actual = await vi.importActual<typeof import('@/services/storageService')>('@/services/storageService');
  return {
    ...actual,
    // Behave like offline mode (inline data URL) without touching Firebase.
    uploadDocument: vi.fn(async (_userId: string | null | undefined, file: File) => {
      actual.validateDocumentFile(file, true);
      return `data:${file.type};base64,JVBERi0xLjQ=`;
    }),
    storageService: { ...actual.storageService, isAvailable: () => false, deleteImage: vi.fn(async () => {}) },
  };
});

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return {
    ...actual,
    toast: {
      success: mocks.toastSuccess,
      error: mocks.toastError,
      info: mocks.toastInfo,
    },
  };
});

function shiftDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return todayISO(date);
}

function renderItemDetail() {
  return render(
    <MemoryRouter initialEntries={['/items/item-1']}>
      <Routes>
        <Route path="/items/:itemId" element={<ItemDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('item records (maintenance, valuation, documents, loans, wishlist)', () => {
  let anchorClick: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
    seedCollectionStore(buildSeedData());
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('edits a maintenance entry and shows the next service with a calendar export', async () => {
    const user = userEvent.setup();
    const nextService = shiftDays(-3);
    useCollectionStore.setState({
      items: useCollectionStore.getState().items.map((item) =>
        item.id === 'item-1'
          ? {
              ...item,
              maintenanceLog: [
                { id: 'maint-1', date: '2024-05-01', type: 'repair', description: 'Repaired spine', nextScheduled: nextService },
              ],
            }
          : item,
      ),
    });

    renderItemDetail();

    expect(screen.getByText('Next service')).toBeInTheDocument();
    expect(screen.getByText('Overdue by 3 days')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add to calendar/i }));
    expect(anchorClick).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('tab', { name: /maintenance/i }));
    await user.click(screen.getByRole('button', { name: 'Edit entry' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText(/description/i)).toHaveValue('Repaired spine');
    await user.clear(within(dialog).getByLabelText(/description/i));
    await user.type(within(dialog).getByLabelText(/description/i), 'Rebound spine');
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    const entry = useCollectionStore.getState().items.find((item) => item.id === 'item-1')!.maintenanceLog[0];
    expect(entry).toMatchObject({ id: 'maint-1', description: 'Rebound spine', type: 'repair', nextScheduled: nextService });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Maintenance entry updated');
  });

  it('adds a dated valuation that becomes the current value', async () => {
    const user = userEvent.setup();
    renderItemDetail();

    await user.click(screen.getByRole('button', { name: /add valuation/i }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /save valuation/i }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/greater than zero/i);

    await user.type(within(dialog).getByLabelText(/^value$/i), '75');
    await user.type(within(dialog).getByLabelText(/source/i), 'Dealer appraisal');
    await user.click(within(dialog).getByRole('button', { name: /save valuation/i }));

    const item = useCollectionStore.getState().items.find((entry) => entry.id === 'item-1')!;
    expect(item.valuationInfo.currentEstimatedValue).toBe(75);
    expect(item.valuationInfo.valueHistory.at(-1)).toMatchObject({ value: 75, source: 'Dealer appraisal', date: todayISO() });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Valuation added');
    expect(await screen.findByText('Dealer appraisal')).toBeInTheDocument();
  });

  it('uploads a document offline, lists it and deletes it', async () => {
    const user = userEvent.setup();
    renderItemDetail();

    await user.click(screen.getByRole('tab', { name: /documents/i }));
    expect(screen.getByText('No documents yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add document/i }));

    const dialog = screen.getByRole('dialog');
    const file = new File(['%PDF-1.4'], 'receipt-2024.pdf', { type: 'application/pdf' });
    await user.upload(within(dialog).getByLabelText(/^file$/i), file);
    expect(within(dialog).getByLabelText(/title/i)).toHaveValue('receipt-2024');
    await user.click(within(dialog).getByRole('button', { name: /^upload$/i }));

    await waitFor(() => {
      expect(useCollectionStore.getState().items.find((item) => item.id === 'item-1')!.documents ?? []).toHaveLength(1);
    });
    const [document] = useCollectionStore.getState().items.find((item) => item.id === 'item-1')!.documents!;
    expect(document).toMatchObject({ type: 'receipt', title: 'receipt-2024', mimeType: 'application/pdf' });
    expect(document.url.startsWith('data:application/pdf')).toBe(true);

    expect(await screen.findByRole('button', { name: 'receipt-2024' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete receipt-2024' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i }));
    expect(useCollectionStore.getState().items.find((item) => item.id === 'item-1')!.documents).toHaveLength(0);
  });

  it('rejects unsupported document types with a clear message', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderItemDetail();

    await user.click(screen.getByRole('tab', { name: /documents/i }));
    await user.click(screen.getByRole('button', { name: /add document/i }));
    const dialog = screen.getByRole('dialog');
    await user.upload(within(dialog).getByLabelText(/^file$/i), new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Only PDF, JPG, PNG and WebP files are supported.');
  });

  it('shows due-soon and overdue loans with calendar exports', async () => {
    const user = userEvent.setup();
    const seed = buildSeedData();
    seed.items[1] = {
      ...seed.items[1],
      lendingHistory: [
        { id: 'lend-2', borrowerName: 'Selin', lentDate: shiftDays(-5), expectedReturnDate: shiftDays(2), condition: 'pending' },
      ],
    };
    seedCollectionStore(seed);

    renderWithRouter(<LendingTracker />);

    expect(screen.getByText('Due soon and overdue')).toBeInTheDocument();
    expect(screen.getByText('2 loans need attention.')).toBeInTheDocument();
    expect(screen.getAllByText('Due in 2 days').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /add all to calendar/i }));
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Exported 2 loan reminders');

    await user.click(screen.getAllByRole('button', { name: 'Add Kind of Blue due date to calendar' })[0]);
    expect(anchorClick).toHaveBeenCalledTimes(2);
  });

  it('turns a wishlist entry into a new item via the item editor', async () => {
    const user = userEvent.setup();
    const openItemDialog = vi.fn();
    useCollectionStore.setState({ openItemDialog });

    renderWithRouter(<Wishlist />);

    await user.click(screen.getByRole('button', { name: /^acquire$/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText(/add to collection/i)).toHaveTextContent('Books');
    await user.click(within(dialog).getByRole('button', { name: /create item/i }));

    expect(openItemDialog).toHaveBeenCalledWith('cat-books', undefined, {
      prefill: expect.objectContaining({
        title: 'Neuromancer',
        description: 'Need a first edition',
        tags: ['cyberpunk'],
        notes: 'Look for signed copy',
        purchasePrice: 35,
        purchaseCurrency: 'USD',
        purchasePlace: 'Local store',
      }),
      wishlistId: 'wish-1',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('links acquired wishlist entries to the created item', async () => {
    const user = userEvent.setup();
    const seed = buildSeedData();
    seedCollectionStore({
      ...seed,
      wishlist: [{ ...seed.wishlist[0], isAcquired: true, acquiredItemId: 'item-1' }],
    });

    renderWithRouter(<Wishlist />);
    await user.click(screen.getByRole('button', { name: /show acquired/i }));

    expect(screen.getByText('Acquired')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view item/i })).toHaveAttribute('href', '/items/item-1');
    expect(screen.getByRole('button', { name: 'Edit Neuromancer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Neuromancer' })).toBeInTheDocument();
  });
});
