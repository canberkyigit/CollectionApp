import type { ItemSourceMetadata } from '@/types';
import { bookSearchService, type BookSearchResult } from '@/services/bookSearchService';

export interface CatalogSuggestion {
  provider: 'openlibrary';
  categoryId: 'cat-books';
  title: string;
  description: string;
  customFields: Record<string, unknown>;
  images: string[];
  confidence: number;
  sourceMetadata: ItemSourceMetadata;
}

function buildOpenLibraryUrl(key: string): string {
  return key.startsWith('/works/')
    ? `https://openlibrary.org${key}`
    : `https://openlibrary.org/search?q=${encodeURIComponent(key)}`;
}

function getFilledFields(book: BookSearchResult): string[] {
  return [
    'title',
    'description',
    'author',
    book.publishYear ? 'publishYear' : '',
    book.publisher ? 'publisher' : '',
    book.isbn ? 'isbn' : '',
    book.languages.length > 0 ? 'language' : '',
    book.pageCount ? 'pageCount' : '',
    book.coverUrlLarge ? 'images' : '',
  ].filter(Boolean);
}

function fromBookSearchResult(book: BookSearchResult): CatalogSuggestion {
  const fields = getFilledFields(book);

  return {
    provider: 'openlibrary',
    categoryId: 'cat-books',
    title: book.title,
    description: `${book.title} by ${book.author}${book.publishYear ? ` (${book.publishYear})` : ''}`,
    customFields: {
      title: book.title,
      author: book.author,
      ...(book.publishYear ? { publishYear: book.publishYear } : {}),
      ...(book.publisher ? { publisher: book.publisher } : {}),
      ...(book.isbn ? { isbn: book.isbn } : {}),
      ...(book.languages.length > 0 ? { language: book.languages[0] } : {}),
      ...(book.pageCount ? { pageCount: book.pageCount } : {}),
    },
    images: book.coverUrlLarge ? [book.coverUrlLarge] : [],
    confidence: book.isbn ? 0.95 : 0.78,
    sourceMetadata: {
      provider: 'openlibrary',
      externalId: book.key,
      externalUrl: buildOpenLibraryUrl(book.key),
      importedAt: new Date().toISOString(),
      confidence: book.isbn ? 0.95 : 0.78,
      fields,
    },
  };
}

export const catalogEnrichmentService = {
  fromBookSearchResult,

  async searchBooks(query: string, limit = 10): Promise<CatalogSuggestion[]> {
    const books = await bookSearchService.search(query, limit);
    return books.map(fromBookSearchResult);
  },

  async searchBookByISBN(isbn: string): Promise<CatalogSuggestion | null> {
    const book = await bookSearchService.searchByISBN(isbn);
    return book ? fromBookSearchResult(book) : null;
  },
};
