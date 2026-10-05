import { t } from '@/i18n';

const BASE = 'https://openlibrary.org';
const COVER_BASE = 'https://covers.openlibrary.org/b/id';

export interface BookSearchResult {
  key: string;
  title: string;
  author: string;
  publishYear?: number;
  publisher?: string;
  isbn?: string;
  coverUrl?: string;
  coverUrlLarge?: string;
  pageCount?: number;
  languages: string[];
  subjects: string[];
}

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  publisher?: string[];
  isbn?: string[];
  cover_i?: number;
  number_of_pages_median?: number;
  language?: string[];
  subject?: string[];
}

const LANG_MAP: Record<string, string> = {
  eng: 'English',
  fre: 'French',
  ger: 'German',
  spa: 'Spanish',
  ita: 'Italian',
  por: 'Portuguese',
  rus: 'Russian',
  jpn: 'Japanese',
  chi: 'Chinese',
  kor: 'Korean',
  ara: 'Arabic',
  tur: 'Turkish',
  dut: 'Dutch',
  pol: 'Polish',
  swe: 'Swedish',
  dan: 'Danish',
  nor: 'Norwegian',
  fin: 'Finnish',
  hun: 'Hungarian',
  cze: 'Czech',
  rum: 'Romanian',
  gre: 'Greek',
  heb: 'Hebrew',
  hin: 'Hindi',
  urd: 'Urdu',
  per: 'Persian',
  lat: 'Latin',
};

function mapDoc(doc: OpenLibraryDoc): BookSearchResult {
  return {
    key: doc.key,
    title: doc.title,
    author: doc.author_name?.[0] ?? t('itemForm.lookup.unknownAuthor'),
    publishYear: doc.first_publish_year,
    publisher: doc.publisher?.[0],
    isbn: doc.isbn?.[0],
    coverUrl: doc.cover_i
      ? `${COVER_BASE}/${doc.cover_i}-M.jpg`
      : undefined,
    coverUrlLarge: doc.cover_i
      ? `${COVER_BASE}/${doc.cover_i}-L.jpg`
      : undefined,
    pageCount: doc.number_of_pages_median,
    languages: (doc.language ?? []).map((l) => LANG_MAP[l] ?? l),
    subjects: (doc.subject ?? []).slice(0, 5),
  };
}

let abortController: AbortController | null = null;

export const bookSearchService = {
  async search(query: string, limit = 10): Promise<BookSearchResult[]> {
    if (!query.trim()) return [];

    abortController?.abort();
    abortController = new AbortController();

    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      fields: 'key,title,author_name,first_publish_year,publisher,isbn,cover_i,number_of_pages_median,language,subject',
    });

    const res = await fetch(`${BASE}/search.json?${params}`, {
      signal: abortController.signal,
    });

    if (!res.ok) throw new Error(`Open Library API error: ${res.status}`);

    const data = await res.json();
    return (data.docs as OpenLibraryDoc[]).map(mapDoc);
  },

  async searchByISBN(isbn: string): Promise<BookSearchResult | null> {
    const results = await this.search(`isbn:${isbn}`, 1);
    return results[0] ?? null;
  },

  getCoverUrl(coverId: number, size: 'S' | 'M' | 'L' = 'M'): string {
    return `${COVER_BASE}/${coverId}-${size}.jpg`;
  },
};
