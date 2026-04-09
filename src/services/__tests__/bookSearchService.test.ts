import { afterEach, describe, expect, it, vi } from 'vitest';

import { bookSearchService } from '@/services/bookSearchService';

describe('bookSearchService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns mapped Open Library search results and exposes helper URLs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        docs: [
          {
            key: '/works/OL1W',
            title: 'Dune',
            author_name: ['Frank Herbert'],
            first_publish_year: 1965,
            publisher: ['Ace'],
            isbn: ['9780441172719'],
            cover_i: 123,
            number_of_pages_median: 412,
            language: ['eng', 'tur'],
            subject: ['Sci-fi', 'Classic', 'Desert'],
          },
        ],
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const results = await bookSearchService.search('dune', 5);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/search.json?'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(results).toEqual([
      expect.objectContaining({
        key: '/works/OL1W',
        title: 'Dune',
        author: 'Frank Herbert',
        publisher: 'Ace',
        isbn: '9780441172719',
        coverUrl: 'https://covers.openlibrary.org/b/id/123-M.jpg',
        coverUrlLarge: 'https://covers.openlibrary.org/b/id/123-L.jpg',
        pageCount: 412,
        languages: ['English', 'Turkish'],
        subjects: ['Sci-fi', 'Classic', 'Desert'],
      }),
    ]);
    expect(bookSearchService.getCoverUrl(456, 'L')).toBe(
      'https://covers.openlibrary.org/b/id/456-L.jpg',
    );
  });

  it('handles empty queries, ISBN lookups, and API failures', async () => {
    expect(await bookSearchService.search('   ')).toEqual([]);

    const fetchOk = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        docs: [{ key: '/works/OL2W', title: 'Neuromancer' }],
      }),
    });
    vi.stubGlobal('fetch', fetchOk);
    expect(await bookSearchService.searchByISBN('1234567890')).toEqual(
      expect.objectContaining({ title: 'Neuromancer' }),
    );

    const fetchFail = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchFail);
    await expect(bookSearchService.search('broken')).rejects.toThrow(
      'Open Library API error: 500',
    );
  });
});
