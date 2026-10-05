import { describe, expect, it } from 'vitest';

import { DEFAULT_FILTERS } from '@/components/shared/advancedFilters.types';
import {
  clearDraftParams,
  draftSignature,
  normaliseFilters,
  parseDraft,
  parseSortParams,
  signatureOfDraft,
  withRangeBounds,
  writeDraftParams,
  writeSortParams,
} from '@/lib/collectionViewParams';

describe('collection view URL params', () => {
  it('round-trips search and every filter kind through the query string', () => {
    const draft = {
      search: 'şeker portakalı',
      filters: {
        ...DEFAULT_FILTERS,
        conditions: ['Mint', 'Near Mint'],
        tags: ['signed'],
        currencies: ['EUR'],
        priceRange: [10, 200] as [number, number],
        valueRange: [0, 500] as [number, number],
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        favoritesOnly: true,
        hasImages: false,
        readStatus: 'unread' as const,
        customSelects: { binding: ['Hardcover', 'Paperback'] },
        customBooleans: { signed: true, sealed: false, ignored: null },
      },
    };

    const params = new URLSearchParams('library=lib-1&detail=item-9');
    writeDraftParams(params, draft);
    const parsed = parseDraft(new URLSearchParams(params.toString()));

    expect(parsed.search).toBe('şeker portakalı');
    expect(parsed.filters).toEqual({
      ...draft.filters,
      customBooleans: { signed: true, sealed: false },
    });
    // Unrelated params survive.
    expect(params.get('library')).toBe('lib-1');
    expect(params.get('detail')).toBe('item-9');
  });

  it('writes nothing for default filters and clears only draft keys', () => {
    const params = new URLSearchParams('library=all&q=old&cond=Mint&f.binding=Hardcover&sort=title&order=asc');
    writeDraftParams(params, { search: '', filters: DEFAULT_FILTERS });
    expect(params.toString()).toBe('library=all&sort=title&order=asc');

    const again = new URLSearchParams('q=x&tag=a&b.signed=1&view=covers');
    clearDraftParams(again);
    expect(again.toString()).toBe('view=covers');
  });

  it('normalises slider ranges so unbounded ranges stay out of the URL', () => {
    const bounds = { maxPrice: 300, maxValue: 900 };
    const normalised = normaliseFilters(
      { ...DEFAULT_FILTERS, priceRange: [0, 300], valueRange: [50, 900] },
      bounds,
    );
    expect(normalised.priceRange).toEqual([0, 0]);
    expect(normalised.valueRange).toEqual([50, 0]);
    expect(withRangeBounds(normalised, bounds).priceRange).toEqual([0, 300]);
    expect(withRangeBounds(normalised, bounds).valueRange).toEqual([50, 900]);
    expect(signatureOfDraft({ search: '', filters: normalised })).toBe('value=50-0');
  });

  it('produces order-independent signatures and parses sort', () => {
    expect(draftSignature(new URLSearchParams('tag=b&q=x&detail=1'))).toBe(
      draftSignature(new URLSearchParams('q=x&tag=b&library=2')),
    );

    const params = new URLSearchParams();
    writeSortParams(params, { field: 'title', order: 'asc' });
    expect(parseSortParams(params)).toEqual({ field: 'title', order: 'asc' });
    writeSortParams(params, null);
    expect(parseSortParams(params)).toBeNull();
  });
});
