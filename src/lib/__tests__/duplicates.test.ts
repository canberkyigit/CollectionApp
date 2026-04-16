import { describe, expect, it } from 'vitest';

import {
  mergeDuplicateItems,
  normalizeISBNForDuplicate,
  normalizeTitleForDuplicate,
} from '@/lib/duplicates';
import { createMockItem } from '@/test/helpers';
import type { CollectionItem } from '@/types';

function item(overrides: Partial<CollectionItem>): CollectionItem {
  return {
    ...createMockItem(),
    id: overrides.id ?? 'item-1',
    createdAt: overrides.createdAt ?? '2024-01-01',
    updatedAt: overrides.updatedAt ?? '2024-01-01',
    ...overrides,
  };
}

describe('duplicate helpers', () => {
  it('normalizes ISBNs and titles before matching', () => {
    expect(normalizeISBNForDuplicate('978-0-446-67550-5')).toBe('9780446675505');
    expect(normalizeISBNForDuplicate('ISBN 0 8044 2957 X')).toBe('080442957X');
    expect(normalizeTitleForDuplicate('  Dune: Deluxe Edition! ')).toBe('dune deluxe edition');
  });

  it('merges duplicate records while preserving unique history and attachments', () => {
    const primary = item({
      id: 'primary',
      title: 'Dune',
      notes: 'Primary note',
      tags: ['classic'],
      images: ['cover-a.jpg'],
      quantity: 1,
      valuationInfo: {
        currentEstimatedValue: 25,
        currentValueCurrency: 'USD',
        currentExchangeRate: 1,
        valueHistory: [{ date: '2024-01-01', value: 25, currency: 'USD' }],
      },
      maintenanceLog: [{ id: 'maint-1', date: '2024-01-02', type: 'cleaning', description: 'Dust jacket', cost: 0 }],
      lendingHistory: [],
      documents: [{ id: 'doc-1', type: 'receipt', title: 'Receipt', url: 'receipt.pdf', uploadedAt: '2024-01-01' }],
      updatedAt: '2024-01-01',
    });
    const duplicate = item({
      id: 'duplicate',
      title: 'Dune First Printing',
      notes: 'Duplicate note',
      tags: ['classic', 'signed'],
      images: ['cover-a.jpg', 'cover-b.jpg'],
      quantity: 2,
      customFields: { isbn: '9780441172719', publisher: 'Ace' },
      valuationInfo: {
        currentEstimatedValue: 40,
        currentValueCurrency: 'USD',
        currentExchangeRate: 1,
        valueHistory: [
          { date: '2024-01-01', value: 25, currency: 'USD' },
          { date: '2024-03-01', value: 40, currency: 'USD' },
        ],
      },
      lendingHistory: [{
        id: 'lend-1',
        borrowerName: 'Paul',
        lentDate: '2024-02-01',
        expectedReturnDate: '2024-02-15',
        condition: 'same',
      }],
      updatedAt: '2024-04-01',
    });

    const merged = mergeDuplicateItems(primary, [duplicate]);

    expect(merged.title).toBe('Dune First Printing');
    expect(merged.tags).toEqual(['classic', 'signed']);
    expect(merged.images).toEqual(['cover-a.jpg', 'cover-b.jpg']);
    expect(merged.quantity).toBe(3);
    expect(merged.notes).toContain('Primary note');
    expect(merged.notes).toContain('Duplicate note');
    expect(merged.customFields).toMatchObject({ isbn: '9780441172719', publisher: 'Ace' });
    expect(merged.valuationInfo?.valueHistory).toHaveLength(2);
    expect(merged.maintenanceLog).toHaveLength(1);
    expect(merged.lendingHistory).toHaveLength(1);
    expect(merged.documents).toHaveLength(1);
  });
});
