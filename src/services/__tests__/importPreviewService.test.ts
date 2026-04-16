import { describe, expect, it, vi } from 'vitest';

import {
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
