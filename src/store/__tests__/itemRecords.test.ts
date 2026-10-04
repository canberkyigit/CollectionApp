import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCollectionStore } from '../useCollectionStore';
import { createMockItem } from '@/test/helpers';
import { todayISO } from '@/lib/utils';

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return {
    ...actual,
    toast: {
      success: mocks.toastSuccess,
      info: mocks.toastInfo,
      error: mocks.toastError,
    },
  };
});

function seedItem(overrides: Parameters<typeof createMockItem>[0] = {}) {
  useCollectionStore.setState({
    items: [],
    categories: [],
    libraries: [],
    wishlist: [],
    activityLog: [],
    contributors: [],
  });
  return useCollectionStore.getState().addItem(createMockItem({ title: 'Pocket watch', ...overrides }));
}

function getItem(id: string) {
  return useCollectionStore.getState().items.find((item) => item.id === id)!;
}

describe('item record store actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateMaintenanceEntry', () => {
    it('patches a single entry, keeps its id and logs activity', () => {
      const item = seedItem();
      const store = useCollectionStore.getState();
      store.addMaintenanceEntry(item.id, { date: '2025-01-10', type: 'inspection', description: 'Initial check' });
      store.addMaintenanceEntry(item.id, { date: '2025-02-10', type: 'cleaning', description: 'Dusted' });
      const [first, second] = getItem(item.id).maintenanceLog;

      useCollectionStore.getState().updateMaintenanceEntry(item.id, first.id, {
        type: 'repair',
        description: 'Replaced crystal',
        cost: 80,
        currency: 'EUR',
        provider: 'Watchmaker',
        nextScheduled: '2026-01-10',
      });

      const log = getItem(item.id).maintenanceLog;
      expect(log).toHaveLength(2);
      expect(log[0]).toEqual({
        id: first.id,
        date: '2025-01-10',
        type: 'repair',
        description: 'Replaced crystal',
        cost: 80,
        currency: 'EUR',
        provider: 'Watchmaker',
        nextScheduled: '2026-01-10',
      });
      expect(log[1]).toEqual(second);
      expect(useCollectionStore.getState().activityLog[0]).toMatchObject({
        action: 'item_updated',
        entityId: item.id,
        details: 'Maintenance updated: Replaced crystal',
      });
    });

    it('ignores unknown entries without logging', () => {
      const item = seedItem();
      const before = useCollectionStore.getState().activityLog.length;
      useCollectionStore.getState().updateMaintenanceEntry(item.id, 'missing', { description: 'Nope' });
      expect(useCollectionStore.getState().activityLog).toHaveLength(before);
    });
  });

  describe('addLendingRecord guard', () => {
    it('refuses to lend an item that already has an open loan', () => {
      const item = seedItem({ lendingHistory: [] });
      const record = {
        borrowerName: 'Ayşe',
        lentDate: '2025-03-01',
        expectedReturnDate: '2025-03-20',
        condition: 'pending' as const,
      };

      useCollectionStore.getState().addLendingRecord(item.id, record);
      useCollectionStore.getState().addLendingRecord(item.id, { ...record, borrowerName: 'Mehmet' });

      const history = getItem(item.id).lendingHistory;
      expect(history).toHaveLength(1);
      expect(history[0].borrowerName).toBe('Ayşe');
      expect(mocks.toastError).toHaveBeenCalledWith('"Pocket watch" is already on loan. Mark it returned first.');
    });

    it('allows a new loan once the previous one is returned (stamped with the local date)', () => {
      const item = seedItem({ lendingHistory: [] });
      const record = {
        borrowerName: 'Ayşe',
        lentDate: '2025-03-01',
        expectedReturnDate: '2025-03-20',
        condition: 'pending' as const,
      };
      useCollectionStore.getState().addLendingRecord(item.id, record);
      const [open] = getItem(item.id).lendingHistory;

      useCollectionStore.getState().returnLendingRecord(item.id, open.id, 'same');
      expect(getItem(item.id).lendingHistory[0].actualReturnDate).toBe(todayISO());

      useCollectionStore.getState().addLendingRecord(item.id, { ...record, borrowerName: 'Mehmet' });
      expect(getItem(item.id).lendingHistory).toHaveLength(2);
      expect(mocks.toastError).not.toHaveBeenCalled();
    });
  });

  describe('addValuationEntry', () => {
    it('appends a dated valuation, keeps history sorted and updates the current value when newest', () => {
      const item = seedItem({
        valuationInfo: {
          currentEstimatedValue: 100,
          currentValueCurrency: 'USD',
          currentExchangeRate: 1,
          valueHistory: [{ date: '2024-01-01', value: 100, currency: 'USD' }],
        },
      });

      useCollectionStore.getState().addValuationEntry(item.id, {
        date: '2025-06-01',
        value: 150,
        currency: 'EUR',
        source: 'Auction estimate',
      });

      const valuation = getItem(item.id).valuationInfo;
      expect(valuation.currentEstimatedValue).toBe(150);
      expect(valuation.currentValueCurrency).toBe('EUR');
      expect(valuation.valueHistory.map((entry) => entry.date)).toEqual(['2024-01-01', '2025-06-01']);
      expect(valuation.valueHistory[1]).toMatchObject({ source: 'Auction estimate' });
    });

    it('back-dated valuations extend the history without replacing the current value', () => {
      const item = seedItem({
        valuationInfo: {
          currentEstimatedValue: 100,
          currentValueCurrency: 'USD',
          currentExchangeRate: 1,
          valueHistory: [{ date: '2024-01-01', value: 100, currency: 'USD' }],
        },
      });

      useCollectionStore.getState().addValuationEntry(item.id, { date: '2023-05-01', value: 60, currency: 'USD' });

      const valuation = getItem(item.id).valuationInfo;
      expect(valuation.currentEstimatedValue).toBe(100);
      expect(valuation.valueHistory.map((entry) => entry.date)).toEqual(['2023-05-01', '2024-01-01']);
    });
  });

  describe('item documents', () => {
    it('adds and removes provenance documents', () => {
      const item = seedItem({ documents: [] });

      const created = useCollectionStore.getState().addItemDocument(item.id, {
        type: 'certificate',
        title: 'Certificate of authenticity',
        url: 'data:application/pdf;base64,AAAA',
        mimeType: 'application/pdf',
        size: 3,
      });

      expect(created).toMatchObject({ type: 'certificate', title: 'Certificate of authenticity' });
      expect(created?.id).toBeTruthy();
      expect(created?.uploadedAt).toBeTruthy();
      expect(getItem(item.id).documents).toEqual([created]);
      expect(useCollectionStore.getState().activityLog[0]).toMatchObject({
        action: 'item_updated',
        details: 'Document added: Certificate of authenticity',
      });

      useCollectionStore.getState().removeItemDocument(item.id, created!.id);
      expect(getItem(item.id).documents).toEqual([]);
    });

    it('returns null for unknown items', () => {
      seedItem();
      expect(
        useCollectionStore.getState().addItemDocument('missing', { type: 'other', title: 'X', url: 'data:,' }),
      ).toBeNull();
    });
  });
});
