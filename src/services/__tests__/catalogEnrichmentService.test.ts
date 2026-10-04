import { describe, expect, it, vi } from 'vitest';

import { catalogEnrichmentService } from '@/services/catalogEnrichmentService';

describe('catalogEnrichmentService', () => {
  it('converts OpenLibrary book results into catalog suggestions with source metadata', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T12:00:00Z'));

    const suggestion = catalogEnrichmentService.fromBookSearchResult({
      key: '/works/OL123W',
      title: 'The Left Hand of Darkness',
      author: 'Ursula K. Le Guin',
      publishYear: 1969,
      publisher: 'Ace',
      isbn: '9780441478125',
      coverUrl: 'https://covers.openlibrary.org/b/id/1-M.jpg',
      coverUrlLarge: 'https://covers.openlibrary.org/b/id/1-L.jpg',
      languages: ['eng'],
      subjects: ['Science fiction'],
      pageCount: 304,
    });

    expect(suggestion).toMatchObject({
      provider: 'openlibrary',
      kind: 'books',
      title: 'The Left Hand of Darkness',
      customFields: {
        author: 'Ursula K. Le Guin',
        publishYear: 1969,
        publisher: 'Ace',
        isbn: '9780441478125',
        language: 'eng',
        pageCount: 304,
      },
      images: ['https://covers.openlibrary.org/b/id/1-L.jpg'],
      confidence: 0.95,
      sourceMetadata: {
        provider: 'openlibrary',
        externalId: '/works/OL123W',
        externalUrl: 'https://openlibrary.org/works/OL123W',
        importedAt: '2024-05-01T12:00:00.000Z',
        fields: expect.arrayContaining(['title', 'author', 'isbn', 'images']),
      },
    });

    vi.useRealTimers();
  });
});
