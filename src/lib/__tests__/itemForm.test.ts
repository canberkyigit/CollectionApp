import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/storageService', () => ({
  storageService: {
    isAvailable: vi.fn(() => true),
    uploadBase64: vi.fn(async (_userId: string, image: string) => `https://cdn.test/${image.slice(0, 12)}`),
    deleteImage: vi.fn(async () => undefined),
  },
}));

describe('itemForm helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('builds purchase rate maps and equivalent values from historical TRY rates', async () => {
    vi.resetModules();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        date: '2023-06-08',
        rates: {
          GBP: 0.03432,
          USD: 0.0428,
          EUR: 0.03986,
        },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const {
      getHistoricalPurchaseRates,
      buildPurchaseRatesMap,
      buildCurrencyEquivalents,
      getEquivalentForDisplay,
      getPurchaseExchangeRateToUsd,
    } = await import('@/lib/itemForm');

    const rates = await getHistoricalPurchaseRates('2023-06-08');
    expect(rates).toEqual({
      gbpRate: 29.1375,
      usdRate: 23.3645,
      eurRate: 25.0878,
    });

    const ratesMap = buildPurchaseRatesMap(rates ?? {});
    const equivalents = buildCurrencyEquivalents(100, 'USD', ratesMap);
    const eurEquivalent = equivalents.find((entry) => entry.currency === 'EUR');
    expect(eurEquivalent?.value).toBeCloseTo(93.13, 2);
    expect(getEquivalentForDisplay(100, 'USD', 'GBP', ratesMap)).toBeCloseTo(80.19, 2);
    expect(getPurchaseExchangeRateToUsd('GBP', ratesMap)).toBeCloseTo(1.24708, 5);
  });

  it('falls back to live rate logic when historical data is missing', async () => {
    vi.resetModules();
    const fetchMock = vi.fn(async () => ({ ok: false }));
    vi.stubGlobal('fetch', fetchMock);
    const { getHistoricalPurchaseRates, getPurchaseExchangeRateToUsd } = await import('@/lib/itemForm');

    expect(await getHistoricalPurchaseRates('2023-06-08')).toBeNull();
    expect(getPurchaseExchangeRateToUsd('USD', { TRY: 1, GBP: 0, USD: 0, EUR: 0 })).toBe(1);
  });

  it('keeps current valuation in the purchase currency when no explicit current value was entered', async () => {
    vi.resetModules();
    const { resolveCurrentValuationInput } = await import('@/lib/itemForm');

    expect(resolveCurrentValuationInput(
      {
        currentValue: undefined,
        currentValueCurrency: 'TRY',
        purchaseCurrency: 'USD',
      },
      200,
    )).toMatchObject({
      currentEstimatedValue: 200,
      currentValueCurrency: 'USD',
    });
  });

  it('heals malformed current valuation currency when loading an item into the form', async () => {
    vi.resetModules();
    const { itemToFormValues } = await import('@/lib/itemForm');
    const { createMockItem, createMockCategory } = await import('@/test/helpers');

    const item = {
      ...createMockItem({
        purchaseInfo: {
          purchasedAt: '2021-06-08T00:00:00Z',
          purchasePrice: 200,
          purchaseCurrency: 'USD',
          exchangeRateAtPurchase: 1,
          currencyEquivalents: [],
        },
        valuationInfo: {
          currentEstimatedValue: 200,
          currentValueCurrency: 'TRY',
          currentExchangeRate: 1,
          valueHistory: [{ date: '2021-06-08', value: 200, currency: 'TRY' }],
        },
      }),
      id: 'broken-item',
      createdAt: '2021-06-08T00:00:00Z',
      updatedAt: '2021-06-08T00:00:00Z',
    };
    const category = {
      ...createMockCategory(),
      id: 'cat-books',
      order: 0,
      createdAt: '2021-06-08T00:00:00Z',
      updatedAt: '2021-06-08T00:00:00Z',
    };

    expect(itemToFormValues(item, category.fields).currentValueCurrency).toBe('USD');
  });

  it('uploads only base64 images and deletes removed firebase images', async () => {
    vi.resetModules();
    const { persistItemImages } = await import('@/lib/itemForm');
    const { storageService } = await import('@/services/storageService');

    const finalImages = await persistItemImages(
      'user-1',
      ['data:image/png;base64,abc123', 'https://example.com/external.jpg'],
      ['https://firebasestorage.googleapis.com/v0/b/old.png', 'https://example.com/external.jpg'],
    );

    expect(storageService.uploadBase64).toHaveBeenCalledTimes(1);
    expect(storageService.deleteImage).toHaveBeenCalledTimes(1);
    expect(finalImages[0]).toContain('https://cdn.test/');
    expect(finalImages[1]).toBe('https://example.com/external.jpg');
  });

  it('normalizes legacy built-in custom field keys without losing category fields', async () => {
    vi.resetModules();
    const { normalizeItemCustomFields, getMissingItemFormFields } = await import('@/lib/itemForm');
    const { createMockCategory } = await import('@/test/helpers');

    const category = createMockCategory({
      fields: [
        { id: 'title', key: 'title', label: 'Title', type: 'text', required: true, order: 0 },
        { id: 'condition', key: 'condition', label: 'Condition', type: 'text', required: true, order: 1 },
        { id: 'author', key: 'author', label: 'Author', type: 'text', required: true, order: 2 },
      ],
    });

    expect(normalizeItemCustomFields({
      title: 'Legacy Title',
      condition: 'Mint',
      purchasePrice: 20,
      author: 'Octavia Butler',
    })).toEqual({ author: 'Octavia Butler' });

    expect(getMissingItemFormFields(category.fields, {
      title: 'Kindred',
      condition: 'Good',
      customFields: { author: '' },
    })).toEqual(['Author']);
  });

  it('builds the shared item submit payload with canonical fields, source metadata, and uploaded images', async () => {
    vi.resetModules();
    const { buildItemFormSubmission } = await import('@/lib/itemForm');
    const { createMockCategory } = await import('@/test/helpers');

    const category = {
      ...createMockCategory({
        fields: [
          { id: 'title', key: 'title', label: 'Title', type: 'text', required: true, order: 0 },
          { id: 'author', key: 'author', label: 'Author', type: 'text', required: true, order: 1 },
          { id: 'isbn', key: 'isbn', label: 'ISBN', type: 'text', required: false, order: 2 },
        ],
      }),
      id: 'cat-books',
      order: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const payload = await buildItemFormSubmission({
      category,
      fields: category.fields,
      data: {
        title: 'Parable of the Sower',
        description: 'Earthseed begins.',
        condition: 'Good',
        tags: 'sci-fi, signed',
        customFields: {
          title: 'Legacy duplicate',
          author: 'Octavia Butler',
          isbn: '9780446675505',
        },
        purchaseDate: '2024-02-01',
        purchasePrice: 18,
        purchaseCurrency: 'USD',
        currentValueCurrency: 'USD',
        targetYear: 2030,
      },
      itemImages: ['https://example.com/external.jpg', 'data:image/png;base64,cover'],
      coverIndex: 1,
      currentUserId: 'user-1',
      sourceMetadata: {
        provider: 'openlibrary',
        externalId: 'isbn:9780446675505',
        importedAt: '2024-02-01T00:00:00Z',
        confidence: 0.9,
        fields: ['title', 'isbn'],
      },
    });

    expect(payload.title).toBe('Parable of the Sower');
    expect(payload.customFields).toEqual({
      author: 'Octavia Butler',
      isbn: '9780446675505',
    });
    expect(payload.images[0]).toContain('https://cdn.test/');
    expect(payload.images[1]).toBe('https://example.com/external.jpg');
    expect(payload.sourceMetadata?.provider).toBe('openlibrary');
    expect(payload.documents).toEqual([]);
  });
});

describe('itemForm valuation, location and prefill helpers', () => {
  it('seeds new item values from a wishlist prefill', async () => {
    const { buildEmptyFormValues } = await import('@/lib/itemForm');
    const values = buildEmptyFormValues(
      [
        { id: 'author', key: 'author', label: 'Author', type: 'text', required: false, order: 1 },
        { id: 'signed', key: 'signed', label: 'Signed', type: 'boolean', required: false, order: 2 },
      ],
      {
        title: 'Neuromancer',
        description: 'First edition',
        tags: ['cyberpunk', 'signed'],
        notes: 'Seen at fair',
        purchasePrice: 120,
        purchaseCurrency: 'GBP',
        purchaseDate: '2024-05-01T10:00:00Z',
        purchasePlace: 'Hay-on-Wye',
      },
    );

    expect(values).toMatchObject({
      title: 'Neuromancer',
      description: 'First edition',
      tags: 'cyberpunk, signed',
      notes: 'Seen at fair',
      purchasePrice: 120,
      purchaseCurrency: 'GBP',
      purchaseDate: '2024-05-01',
      purchaseLocation: 'Hay-on-Wye',
      customFields: { author: '', signed: false },
    });
    expect(buildEmptyFormValues([]).purchaseCurrency).toBe('TRY');
  });

  it('suggests distinct locations including parent paths', async () => {
    const { getLocationSuggestions } = await import('@/lib/itemForm');
    expect(getLocationSuggestions([
      { location: 'Study / Cabinet A / Shelf 2' },
      { location: 'study/cabinet a/Shelf 3' },
      { location: '  ' },
      { location: undefined },
      { location: 'Attic' },
    ])).toEqual([
      'Attic',
      'Study',
      'Study / Cabinet A',
      'Study / Cabinet A / Shelf 2',
      'study / cabinet a / Shelf 3',
    ]);
  });

  it('appends a value history point when the current value changes and replaces same-day points', async () => {
    const { buildNextValueHistory } = await import('@/lib/itemForm');
    const { createMockItem } = await import('@/test/helpers');
    const item = { ...createMockItem(), id: 'i1', createdAt: '2024-01-01', updatedAt: '2024-01-01' };

    expect(buildNextValueHistory(undefined, { value: 50, currency: 'USD', valuedAt: '2024-06-01' }))
      .toEqual([{ date: '2024-06-01', value: 50, currency: 'USD' }]);

    // unchanged value → history untouched
    expect(buildNextValueHistory(item, { value: 30, currency: 'USD' })).toBe(item.valuationInfo.valueHistory);

    const next = buildNextValueHistory(item, { value: 45, currency: 'USD', valuedAt: '2024-07-01', source: 'Auction' });
    expect(next).toEqual([
      { date: '2024-01-01', value: 25, currency: 'USD' },
      { date: '2024-07-01', value: 45, currency: 'USD', source: 'Auction' },
    ]);

    const sameDay = buildNextValueHistory(
      { ...item, valuationInfo: { ...item.valuationInfo, currentEstimatedValue: 45, valueHistory: next } },
      { value: 48, currency: 'USD', valuedAt: '2024-07-01' },
    );
    expect(sameDay).toHaveLength(2);
    expect(sameDay[1]).toEqual({ date: '2024-07-01', value: 48, currency: 'USD' });
  });

  it('stores valuation metadata and dates a changed value today when the valued-on date is stale', async () => {
    const { buildItemFormSubmission, itemToFormValues } = await import('@/lib/itemForm');
    const { createMockItem, createMockCategory } = await import('@/test/helpers');
    const { todayISO } = await import('@/lib/utils');
    const category = { ...createMockCategory(), id: 'cat-books', order: 0, createdAt: '', updatedAt: '' };
    const item = {
      ...createMockItem({
        valuationInfo: {
          currentEstimatedValue: 30,
          currentValueCurrency: 'USD',
          currentExchangeRate: 1,
          valueHistory: [{ date: '2024-01-01', value: 30, currency: 'USD' }],
          valuedAt: '2024-01-01',
          valuationSource: 'Old guide',
        },
      }),
      id: 'i1',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const values = itemToFormValues(item, category.fields);
    expect(values.valuedAt).toBe('2024-01-01');
    expect(values.valuationSource).toBe('Old guide');

    const payload = await buildItemFormSubmission({
      category,
      fields: category.fields,
      data: { ...values, currentValue: 75, valuationSource: 'Christie’s appraisal', targetValue: 120, targetYear: 2032 },
      itemImages: [],
      coverIndex: 0,
      currentUserId: null,
      existingItem: item,
    });

    expect(payload.valuationInfo).toMatchObject({
      currentEstimatedValue: 75,
      currentValueCurrency: 'USD',
      valuedAt: todayISO(),
      valuationSource: 'Christie’s appraisal',
      targetEstimatedValue: 120,
      targetYearProjection: 2032,
    });
    expect(payload.valuationInfo.valueHistory.at(-1)).toEqual({
      date: todayISO(),
      value: 75,
      currency: 'USD',
      source: 'Christie’s appraisal',
    });
  });
});
