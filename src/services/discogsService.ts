import { getIntegrationKey } from '@/lib/integrationKeys';
import { CatalogLookupError, type CatalogCandidate } from '@/services/catalogEnrichmentService';

/**
 * Discogs database lookups for vinyl. Uses a personal access token from
 * Settings → Integrations (passed as the `token` query param so the browser
 * request stays CORS-simple).
 */
const BASE = 'https://api.discogs.com';

export interface DiscogsSearchResult {
  id: number;
  title: string;
  year?: string;
  country?: string;
  label: string[];
  format: string[];
  catno?: string;
  barcode: string[];
  thumb?: string;
  coverImage?: string;
  uri?: string;
}

interface DiscogsSearchResponse {
  results?: Array<{
    id: number;
    type?: string;
    title?: string;
    year?: string;
    country?: string;
    label?: string[];
    format?: string[];
    catno?: string;
    barcode?: string[];
    thumb?: string;
    cover_image?: string;
    uri?: string;
  }>;
}

interface DiscogsRelease {
  id: number;
  title?: string;
  year?: number;
  country?: string;
  uri?: string;
  artists_sort?: string;
  artists?: Array<{ name?: string }>;
  labels?: Array<{ name?: string; catno?: string }>;
  formats?: Array<{ name?: string; qty?: string; descriptions?: string[] }>;
  identifiers?: Array<{ type?: string; value?: string }>;
  genres?: string[];
  styles?: string[];
  notes?: string;
  lowest_price?: number | null;
  num_for_sale?: number;
  images?: Array<{ type?: string; uri?: string }>;
}

function requireToken(): string {
  const token = getIntegrationKey('discogs');
  if (!token) throw new CatalogLookupError('no-key', 'discogs');
  return token;
}

async function discogsFetch<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const token = requireToken();
  const query = new URLSearchParams({ ...params, token });
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}?${query}`, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new CatalogLookupError('network', 'discogs');
  }
  if (response.status === 401 || response.status === 403) throw new CatalogLookupError('auth', 'discogs');
  if (response.status === 429) throw new CatalogLookupError('rate-limit', 'discogs');
  if (response.status === 404) throw new CatalogLookupError('not-found', 'discogs');
  if (!response.ok) throw new CatalogLookupError('api', 'discogs', `HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

/** "Artist - Title" → { artist, title } (Discogs search result format). */
export function splitDiscogsTitle(raw: string): { artist?: string; title: string } {
  const index = raw.indexOf(' - ');
  if (index === -1) return { title: raw.trim() };
  return { artist: raw.slice(0, index).trim(), title: raw.slice(index + 3).trim() };
}

function cleanArtistName(name: string): string {
  // Discogs disambiguates duplicates as "Name (2)".
  return name.replace(/\s\(\d+\)$/, '').trim();
}

function guessQueryParams(query: string): Record<string, string> {
  const compact = query.replace(/[\s-]/g, '');
  if (/^\d{8,14}$/.test(compact)) return { barcode: compact };
  return { q: query.trim() };
}

function mapFormat(release: DiscogsRelease): { format?: string; rpm?: string } {
  const first = release.formats?.[0];
  if (!first) return {};
  const descriptions = first.descriptions ?? [];
  const rpm = descriptions.find((entry) => /RPM/i.test(entry))?.replace(/\s*RPM/i, '').replace('33 ⅓', '33⅓');
  const size = descriptions.find((entry) => /^\d+"$/.test(entry));
  let format: string | undefined;
  if (descriptions.includes('LP') || descriptions.includes('Album')) format = 'LP';
  else if (descriptions.includes('EP')) format = 'EP';
  else if (descriptions.includes('Single') && size) format = `${size} Single`;
  else if (first.name === 'Box Set') format = 'Box Set';
  else format = size ?? first.name;
  return { format, rpm };
}

export function releaseToCandidate(release: DiscogsRelease): CatalogCandidate {
  const artist = release.artists_sort
    ? cleanArtistName(release.artists_sort)
    : release.artists?.map((entry) => cleanArtistName(entry.name ?? '')).filter(Boolean).join(', ');
  const label = release.labels?.[0];
  const { format, rpm } = mapFormat(release);
  const barcode = release.identifiers?.find((entry) => entry.type === 'Barcode')?.value;
  const image = release.images?.find((entry) => entry.type === 'primary')?.uri ?? release.images?.[0]?.uri;
  const externalUrl = release.uri ?? `https://www.discogs.com/release/${release.id}`;

  return {
    provider: 'discogs',
    title: release.title,
    description: [artist, release.title].filter(Boolean).join(' – ') + (release.year ? ` (${release.year})` : ''),
    tags: [...(release.genres ?? []), ...(release.styles ?? [])].slice(0, 6),
    fields: [
      ...(artist ? [{ keys: ['artist', 'artists', 'band', 'sanatçı', 'sanatci'], value: artist }] : []),
      ...(label?.name ? [{ keys: ['label', 'recordLabel', 'plak şirketi', 'plaksirketi', 'etiket'], value: cleanArtistName(label.name) }] : []),
      ...(label?.catno && label.catno !== 'none'
        ? [{ keys: ['catalogNumber', 'catalogueNumber', 'catNo', 'catno', 'katalog numarası', 'katalognumarasi'], value: label.catno }]
        : []),
      ...(release.year ? [{ keys: ['year', 'releaseYear', 'yıl', 'yil'], value: release.year }] : []),
      ...(format ? [{ keys: ['format', 'biçim', 'bicim'], value: format }] : []),
      ...(release.country ? [{ keys: ['country', 'pressingCountry', 'ülke', 'ulke'], value: release.country }] : []),
      ...(rpm ? [{ keys: ['rpm', 'speed', 'devir'], value: rpm }] : []),
      ...(barcode ? [{ keys: ['barcode', 'barkod', 'upc', 'ean'], value: barcode }] : []),
    ],
    images: image ? [image] : [],
    estimatedValue: typeof release.lowest_price === 'number' && release.lowest_price > 0
      ? { amount: release.lowest_price, currency: 'USD', basis: 'lowest-listing' }
      : undefined,
    externalId: String(release.id),
    externalUrl,
    confidence: barcode ? 0.9 : 0.75,
  };
}

export const discogsService = {
  isConfigured(): boolean {
    return !!getIntegrationKey('discogs');
  },

  /** Search releases by barcode, catalogue number, or "artist title". */
  async search(query: string, signal?: AbortSignal): Promise<DiscogsSearchResult[]> {
    if (!query.trim()) return [];
    const data = await discogsFetch<DiscogsSearchResponse>(
      '/database/search',
      { ...guessQueryParams(query), type: 'release', per_page: '15' },
      signal,
    );
    return (data.results ?? []).map((result) => ({
      id: result.id,
      title: result.title ?? '',
      year: result.year,
      country: result.country,
      label: result.label ?? [],
      format: result.format ?? [],
      catno: result.catno,
      barcode: result.barcode ?? [],
      thumb: result.thumb || undefined,
      coverImage: result.cover_image || undefined,
      uri: result.uri ? `https://www.discogs.com${result.uri}` : undefined,
    }));
  },

  /** Full release details (artist, label, formats, lowest marketplace price). */
  async getRelease(id: number, signal?: AbortSignal): Promise<CatalogCandidate> {
    const release = await discogsFetch<DiscogsRelease>(`/releases/${id}`, {}, signal);
    return releaseToCandidate(release);
  },
};
