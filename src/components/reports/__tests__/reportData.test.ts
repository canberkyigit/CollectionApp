import { describe, expect, it } from 'vitest';

import {
  DEFAULT_REPORT_FILTERS,
  buildReportTotals,
  filterReportItems,
  getIdentifierFields,
  getKeyFields,
  getLastValuationDate,
} from '@/components/reports/reportData';
import { buildSeedData } from '@/test/seed';
import type { CategoryField, CollectionItem } from '@/types';

describe('reportData', () => {
  const seed = buildSeedData();
  const items = seed.items as CollectionItem[];

  it('filters by archive state, category, library and minimum value', () => {
    expect(filterReportItems(items, DEFAULT_REPORT_FILTERS, 'USD').map((item) => item.id)).toEqual(['item-1', 'item-2']);
    expect(filterReportItems(items, { ...DEFAULT_REPORT_FILTERS, includeArchived: true }, 'USD')).toHaveLength(3);
    expect(filterReportItems(items, { ...DEFAULT_REPORT_FILTERS, categoryId: 'cat-vinyl' }, 'USD').map((item) => item.id)).toEqual(['item-2']);
    expect(filterReportItems(items, { ...DEFAULT_REPORT_FILTERS, libraryId: 'lib-books' }, 'USD').map((item) => item.id)).toEqual(['item-1']);
    expect(filterReportItems(items, { ...DEFAULT_REPORT_FILTERS, minValue: 50 }, 'USD').map((item) => item.id)).toEqual(['item-2']);
  });

  it('totals purchase cost and current value per category', () => {
    const active = filterReportItems(items, DEFAULT_REPORT_FILTERS, 'USD');
    const totals = buildReportTotals(active, seed.categories, 'USD');
    expect(totals.count).toBe(2);
    expect(totals.purchaseTotal).toBeCloseTo(55);
    expect(totals.currentTotal).toBeCloseTo(95);
    expect(totals.byCategory.map((row) => [row.name, row.count])).toEqual([['Books', 1], ['Vinyl', 1]]);
  });

  it('separates identifier fields from descriptive key fields', () => {
    const fields = seed.categories[0].fields as CategoryField[];
    expect(getIdentifierFields(fields).map((field) => field.key)).toEqual(['isbn']);
    expect(getKeyFields(items[0], fields).map((field) => field.key)).toEqual(['author', 'publisher']);
    expect(getIdentifierFields([{ id: 's', key: 'series', label: 'Series', type: 'text', required: false, order: 0 }])).toEqual([]);
  });

  it('uses the newest value-history date as the last valuation', () => {
    expect(getLastValuationDate(items[0])).toBe('2024-02-01');
    expect(getLastValuationDate({ ...items[0], valuationInfo: { ...items[0].valuationInfo, valueHistory: [] } })).toBe('2024-01-01');
  });
});
