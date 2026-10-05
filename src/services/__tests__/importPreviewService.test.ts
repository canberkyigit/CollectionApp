import { describe, expect, it, vi } from 'vitest';

import {
  applyMappingOverrides,
  normalizeImportDate,
  parseLocaleNumber,
  buildAutoCsvMapping,
  buildCsvImportPreview,
  buildItemFromCsvPreviewRow,
} from '@/services/importPreviewService';
import { createMockCategory } from '@/test/helpers';

describe('importPreviewService', () => {
  it('maps CSV columns to built-in and category fields', () => {
    const category = {
      ...createMockCategory({
        fields: [
          { id: 'author', key: 'author', label: 'Author', type: 'text', required: true, order: 0 },
          { id: 'isbn', key: 'isbn', label: 'ISBN', type: 'text', required: false, order: 1 },
        ],
      }),
      id: 'cat-books',
      order: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const mapping = buildAutoCsvMapping(
      ['Name', 'Description', 'Price', 'Currency', 'Author', 'ISBN', 'Tags'],
      category,
    );

    expect(mapping).toMatchObject({
      categoryId: 'cat-books',
      builtInFields: {
        title: 'Name',
        description: 'Description',
        purchasePrice: 'Price',
        purchaseCurrency: 'Currency',
        tags: 'Tags',
      },
      customFields: {
        author: 'Author',
        isbn: 'ISBN',
      },
    });
  });

  it('previews validation issues and builds importable item payloads', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-04-01T10:00:00Z'));

    const category = {
      ...createMockCategory({
        fields: [
          { id: 'author', key: 'author', label: 'Author', type: 'text', required: true, order: 0 },
          { id: 'rating', key: 'rating', label: 'Rating', type: 'number', required: false, order: 1 },
        ],
      }),
      id: 'cat-books',
      order: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    const headers = ['Title', 'Author', 'Rating', 'Price', 'Tags'];
    const rows = [
      ['Dawn', 'Octavia Butler', '5', '12', 'sci-fi; trilogy'],
      ['', '', '', 'not-a-number', 'broken'],
    ];
    const mapping = buildAutoCsvMapping(headers, category);
    const preview = buildCsvImportPreview(headers, rows, category, mapping);

    expect(preview[0]).toMatchObject({
      title: 'Dawn',
      canImport: true,
      values: { author: 'Octavia Butler', rating: 5 },
    });
    expect(preview[1].canImport).toBe(false);
    expect(preview[1].issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'title', severity: 'error' }),
        expect.objectContaining({ field: 'author', severity: 'error' }),
        expect.objectContaining({ field: 'purchasePrice', severity: 'warning' }),
      ]),
    );

    const item = buildItemFromCsvPreviewRow(preview[0], headers, rows[0], mapping, 'contrib-1');
    expect(item).toMatchObject({
      title: 'Dawn',
      categoryId: 'cat-books',
      customFields: { author: 'Octavia Butler', rating: 5 },
      tags: ['sci-fi', 'trilogy'],
      purchaseInfo: { purchasePrice: 12, purchaseCurrency: 'USD' },
      sourceMetadata: {
        provider: 'csv',
        importedAt: '2024-04-01T10:00:00.000Z',
        fields: ['author', 'rating'],
      },
    });

    vi.useRealTimers();
  });
});

describe('importPreviewService mapping overrides and locale parsing', () => {
  const category = {
    ...createMockCategory({
      fields: [
        { id: 'author', key: 'author', label: 'Author', type: 'text', required: false, order: 0 },
        { id: 'pages', key: 'pages', label: 'Pages', type: 'number', required: false, order: 1 },
      ],
    }),
    id: 'cat-books',
    order: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };

  it('returns empty strings for undetected built-in columns', () => {
    const mapping = buildAutoCsvMapping(['description', 'price'], category);
    expect(mapping.builtInFields.title).toBe('');
    expect(mapping.builtInFields.purchasePrice).toBe('price');
  });

  it('matches Turkish headers, including dotted/dotless i', () => {
    const mapping = buildAutoCsvMapping(['BAŞLIK', 'Açıklama', 'Alış Fiyatı', 'Güncel Değer', 'Etiketler', 'Konum'], category);
    expect(mapping.builtInFields).toMatchObject({
      title: 'BAŞLIK',
      description: 'Açıklama',
      purchasePrice: 'Alış Fiyatı',
      currentValue: 'Güncel Değer',
      tags: 'Etiketler',
      location: 'Konum',
    });
  });

  it('applies user overrides on top of the automatic mapping', () => {
    const headers = ['Name', 'Writer', 'Cost', 'Extra'];
    const auto = buildAutoCsvMapping(headers, category);
    expect(auto.customFields.author).toBeUndefined();

    const mapping = applyMappingOverrides(auto, {
      builtInFields: { purchasePrice: '', title: 'Extra' },
      customFields: { author: 'Writer', pages: 'Missing column' },
    }, headers);

    expect(mapping.builtInFields.title).toBe('Extra');
    expect(mapping.builtInFields.purchasePrice).toBe('');
    expect(mapping.customFields).toEqual({ author: 'Writer' });

    const preview = buildCsvImportPreview(headers, [['Dune', 'Herbert', '9', 'Override title']], category, mapping);
    expect(preview[0]).toMatchObject({ title: 'Override title', values: { author: 'Herbert' } });
  });

  it('parses numbers written in Turkish and English formats', () => {
    expect(parseLocaleNumber('1.234,56')).toBeCloseTo(1234.56);
    expect(parseLocaleNumber('1,234.56')).toBeCloseTo(1234.56);
    expect(parseLocaleNumber('12,5')).toBeCloseTo(12.5);
    expect(parseLocaleNumber('₺ 1.250.000')).toBe(1250000);
    expect(parseLocaleNumber('$42')).toBe(42);
    expect(parseLocaleNumber('abc')).toBeNaN();
    expect(normalizeImportDate('31.12.2023')).toBe('2023-12-31');
    expect(normalizeImportDate('2023-12-31')).toBe('2023-12-31');
  });

  it('uses the current value column when mapped and parses Turkish prices', () => {
    const headers = ['Başlık', 'Alış Fiyatı', 'Güncel Değer', 'Para Birimi', 'Sayfa'];
    const mapping = applyMappingOverrides(
      buildAutoCsvMapping(headers, category),
      { customFields: { pages: 'Sayfa' } },
      headers,
    );
    const rows = [['Dune', '1.200,50', '2.000', 'try', '412']];
    const preview = buildCsvImportPreview(headers, rows, category, mapping);
    const item = buildItemFromCsvPreviewRow(preview[0], headers, rows[0], mapping, 'me');
    expect(item.purchaseInfo.purchasePrice).toBeCloseTo(1200.5);
    expect(item.purchaseInfo.purchaseCurrency).toBe('TRY');
    expect(item.valuationInfo.currentEstimatedValue).toBe(2000);
    expect(item.customFields).toEqual({ pages: 412 });
  });
});
