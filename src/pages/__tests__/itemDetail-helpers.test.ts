import { describe, expect, it } from 'vitest';

import { buildItemChartData, getSortedValueHistory } from '@/pages/itemDetail-helpers';
import {
  combineIcsEvents,
  daysUntil,
  getNextScheduledMaintenance,
  getOpenLoan,
  getScheduleState,
} from '@/components/items/itemSchedule';
import { buildIcsEvent } from '@/lib/reminders';
import { createMockItem } from '@/test/helpers';
import type { CollectionItem } from '@/types';

function item(overrides: Partial<CollectionItem> = {}): CollectionItem {
  return { ...createMockItem(overrides), id: 'item-x', createdAt: '2024-01-01', updatedAt: '2024-01-01' };
}

describe('buildItemChartData', () => {
  it('uses the full history sorted by date and starts at the purchase price', () => {
    const data = buildItemChartData(
      item({
        purchaseInfo: { purchasedAt: '2023-06-01', purchasePrice: 20, purchaseCurrency: 'USD', exchangeRateAtPurchase: 1 },
        valuationInfo: {
          currentEstimatedValue: 50,
          currentValueCurrency: 'USD',
          currentExchangeRate: 1,
          valueHistory: [
            { date: '2025-01-01', value: 50, currency: 'USD' },
            { date: '2024-01-01', value: 30, currency: 'USD' },
            { date: '2024-01-01', value: 35, currency: 'USD' },
          ],
        },
      }),
      'USD',
    );

    expect(data).toEqual([
      { date: '2023-06-01', value: 20 },
      { date: '2024-01-01', value: 35 },
      { date: '2025-01-01', value: 50 },
    ]);
  });

  it('does not duplicate the purchase point when history already starts there', () => {
    const data = buildItemChartData(
      item({
        purchaseInfo: { purchasedAt: '2024-01-01T00:00:00Z', purchasePrice: 25, purchaseCurrency: 'USD', exchangeRateAtPurchase: 1 },
      }),
      'USD',
    );
    expect(data).toEqual([{ date: '2024-01-01', value: 25 }]);
  });

  it('lists value history newest first', () => {
    const sorted = getSortedValueHistory(
      item({
        valuationInfo: {
          currentEstimatedValue: 1,
          currentValueCurrency: 'USD',
          currentExchangeRate: 1,
          valueHistory: [
            { date: '2022-01-01', value: 1, currency: 'USD' },
            { date: '2024-01-01', value: 3, currency: 'USD' },
          ],
        },
      }),
    );
    expect(sorted.map((entry) => entry.date)).toEqual(['2024-01-01', '2022-01-01']);
  });
});

describe('itemSchedule helpers', () => {
  it('computes day offsets and schedule states', () => {
    expect(daysUntil('2025-03-10', '2025-03-07')).toBe(3);
    expect(daysUntil('2025-03-01', '2025-03-07')).toBe(-6);
    expect(getScheduleState(-1)).toBe('overdue');
    expect(getScheduleState(0)).toBe('today');
    expect(getScheduleState(5)).toBe('soon');
    expect(getScheduleState(30)).toBe('upcoming');
  });

  it('uses only the latest maintenance entry with a schedule', () => {
    const next = getNextScheduledMaintenance({
      maintenanceLog: [
        { id: 'a', date: '2024-01-01', type: 'cleaning', description: 'Old', nextScheduled: '2024-06-01' },
        { id: 'b', date: '2025-01-01', type: 'inspection', description: 'New', nextScheduled: '2026-01-01' },
        { id: 'c', date: '2025-06-01', type: 'repair', description: 'No plan' },
      ],
    });
    expect(next?.id).toBe('b');
  });

  it('finds the open loan', () => {
    expect(
      getOpenLoan({
        lendingHistory: [
          { id: 'old', borrowerName: 'A', lentDate: '2024-01-01', expectedReturnDate: '2024-01-10', actualReturnDate: '2024-01-09', condition: 'same' },
          { id: 'open', borrowerName: 'B', lentDate: '2024-02-01', expectedReturnDate: '2024-02-10', condition: 'pending' },
        ],
      })?.id,
    ).toBe('open');
  });

  it('merges several events into a single calendar', () => {
    const ics = combineIcsEvents([
      buildIcsEvent({ uid: 'one', title: 'First', date: '2025-05-01' }),
      buildIcsEvent({ uid: 'two', title: 'Second', date: '2025-05-02' }),
    ]);
    const lines = ics.split('\r\n');
    expect(lines.filter((line) => line === 'BEGIN:VCALENDAR')).toHaveLength(1);
    expect(lines.filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(2);
    expect(lines).toContain('UID:one@curio');
    expect(lines).toContain('UID:two@curio');
    expect(lines.at(-2)).toBe('END:VCALENDAR');
  });
});
