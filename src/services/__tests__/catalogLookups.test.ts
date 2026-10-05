import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CategoryField } from '@/types';
import { setIntegrationKey } from '@/lib/integrationKeys';
import {
  CatalogLookupError,
  buildReviewFields,
  buildCandidateSourceMetadata,
  coerceFieldValue,
  type CatalogCandidate,
} from '@/services/catalogEnrichmentService';
import { discogsService, splitDiscogsTitle } from '@/services/discogsService';
import { numistaService } from '@/services/numistaService';

const vinylFields: CategoryField[] = [
  { id: 'title', key: 'title', label: 'Title', type: 'text', required: true, order: 1 },
  { id: 'artist', key: 'artist', label: 'Artist', type: 'text', required: false, order: 2 },
  { id: 'label', key: 'label', label: 'Label', type: 'text', required: false, order: 3 },
  { id: 'catalogNumber', key: 'catalogNumber', label: 'Catalogue Number', type: 'text', required: false, order: 4 },
  { id: 'year', key: 'year', label: 'Year', type: 'number', required: false, order: 5 },
  { id: 'format', key: 'format', label: 'Format', type: 'select', required: false, options: ['LP', 'EP', '7" Single'], order: 6 },
  { id: 'rpm', key: 'rpm', label: 'RPM', type: 'select', required: false, options: ['33⅓', '45', '78'], order: 7 },
];

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('catalog review rows', () => {
  const candidate: CatalogCandidate = {
    provider: 'discogs',
    title: 'Abbey Road',
    description: 'The Beatles – Abbey Road (1969)',
    tags: ['Rock', 'Pop Rock'],
    fields: [
      { keys: ['artist'], value: 'The Beatles' },
      { keys: ['label'], value: 'Apple Records' },
      { keys: ['catalogNumber'], value: 'PCS 7088' },
      { keys: ['year'], value: 1969 },
      { keys: ['format'], value: 'lp' },
      { keys: ['rpm'], value: '33⅓' },
      { keys: ['country'], value: 'UK' },
    ],
    images: ['https://img.discogs.test/abbey.jpg'],
    estimatedValue: { amount: 42, currency: 'USD', basis: 'lowest-listing' },
    externalId: '123',
    externalUrl: 'https://www.discogs.com/release/123',
    confidence: 0.9,
  };

  it('only suggests fields the category has, coerces types and flags conflicts', () => {
    const rows = buildReviewFields(candidate, {
      fields: vinylFields,
      conditionOptions: [],
      current: {
        title: '',
        description: '',
        tags: 'rock',
        condition: '',
        customFields: { artist: 'Beatles, The', label: 'Apple Records', year: '' },
        images: [],
      },
    });
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));

    expect(byId['cf:country']).toBeUndefined(); // not a category field
    expect(byId['cf:label']).toBeUndefined(); // already identical
    expect(byId.title).toMatchObject({ value: 'Abbey Road', conflict: false });
    expect(byId['cf:artist']).toMatchObject({ value: 'The Beatles', conflict: true, current: 'Beatles, The' });
    expect(byId['cf:year']).toMatchObject({ value: 1969, conflict: false });
    expect(byId['cf:format']).toMatchObject({ value: 'LP' });
    expect(byId.tags).toMatchObject({ value: 'rock, Pop Rock', display: 'Pop Rock', conflict: false });
    expect(byId.currentValue).toMatchObject({ value: 42, conflict: false });
    expect(byId['image:https://img.discogs.test/abbey.jpg']).toBeDefined();

    expect(buildCandidateSourceMetadata(candidate, ['title', 'cf:artist', 'image:x'])).toMatchObject({
      provider: 'discogs',
      externalId: '123',
      confidence: 0.9,
      fields: ['title', 'artist', 'images'],
    });
  });

  it('coerces raw values per field type', () => {
    expect(coerceFieldValue({ ...vinylFields[4] }, '1969–1972')).toBe(1969);
    expect(coerceFieldValue({ id: 'b', key: 'b', label: 'B', type: 'boolean', required: false, order: 0 }, 'Evet')).toBe(true);
    expect(coerceFieldValue({ ...vinylFields[5] }, 'Cassette')).toBeUndefined();
    expect(coerceFieldValue({ id: 'm', key: 'm', label: 'M', type: 'multi-select', required: false, order: 0, options: ['Gold', 'Silver'] }, 'silver; gold')).toBe('Silver, Gold');
    expect(coerceFieldValue({ id: 'd', key: 'd', label: 'D', type: 'date', required: false, order: 0 }, 'sometime')).toBeUndefined();
  });
});

describe('discogsService', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requires a token', async () => {
    await expect(discogsService.search('abbey road')).rejects.toMatchObject({ code: 'no-key', provider: 'discogs' });
  });

  it('searches by barcode and maps release details', async () => {
    setIntegrationKey('discogs', 'tok');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        results: [{ id: 123, title: 'The Beatles - Abbey Road', year: '1969', label: ['Apple'], format: ['Vinyl', 'LP'], catno: 'PCS 7088', thumb: 't.jpg', uri: '/release/123' }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        id: 123,
        title: 'Abbey Road',
        year: 1969,
        country: 'UK',
        uri: 'https://www.discogs.com/release/123',
        artists_sort: 'Beatles, The',
        labels: [{ name: 'Apple Records', catno: 'PCS 7088' }],
        formats: [{ name: 'Vinyl', descriptions: ['LP', 'Album', 'Stereo', '33 ⅓ RPM'] }],
        identifiers: [{ type: 'Barcode', value: '5099969945120' }],
        genres: ['Rock'],
        lowest_price: 38.5,
        images: [{ type: 'primary', uri: 'https://img/abbey.jpg' }],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const results = await discogsService.search('5099 9699 45120');
    expect(String(fetchMock.mock.calls[0][0])).toContain('barcode=5099969945120');
    expect(String(fetchMock.mock.calls[0][0])).toContain('token=tok');
    expect(results[0]).toMatchObject({ id: 123, uri: 'https://www.discogs.com/release/123' });

    const candidate = await discogsService.getRelease(123);
    const values = Object.fromEntries(candidate.fields.map((field) => [field.keys[0], field.value]));
    expect(values).toMatchObject({ artist: 'Beatles, The', label: 'Apple Records', catalogNumber: 'PCS 7088', year: 1969, format: 'LP', rpm: '33⅓', country: 'UK', barcode: '5099969945120' });
    expect(candidate.images).toEqual(['https://img/abbey.jpg']);
    expect(candidate.estimatedValue).toEqual({ amount: 38.5, currency: 'USD', basis: 'lowest-listing' });
  });

  it('maps HTTP and network failures to typed errors', async () => {
    setIntegrationKey('discogs', 'tok');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({}, 401)));
    await expect(discogsService.search('x')).rejects.toMatchObject({ code: 'auth' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({}, 429)));
    await expect(discogsService.search('x')).rejects.toMatchObject({ code: 'rate-limit' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')));
    await expect(discogsService.search('x')).rejects.toBeInstanceOf(CatalogLookupError);
  });

  it('splits "Artist - Title" search titles', () => {
    expect(splitDiscogsTitle('Miles Davis - Kind Of Blue')).toEqual({ artist: 'Miles Davis', title: 'Kind Of Blue' });
    expect(splitDiscogsTitle('Untitled')).toEqual({ title: 'Untitled' });
  });
});

describe('numistaService', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the API key header and maps coin types', async () => {
    setIntegrationKey('numista', 'nkey');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ count: 1, types: [{ id: 99, title: '1 Lira', issuer: { name: 'Turkey' }, min_year: 1959, max_year: 1980, obverse_thumbnail: 'o.jpg' }] }))
      .mockResolvedValueOnce(jsonResponse({
        id: 99,
        url: 'https://en.numista.com/catalogue/pieces99.html',
        title: '1 Lira',
        issuer: { name: 'Turkey' },
        min_year: 1959,
        max_year: 1980,
        value: { text: '1 Lira' },
        composition: { text: 'Stainless steel' },
        weight: 7.5,
        size: 27,
        obverse: { picture: 'https://n/obv.jpg' },
        reverse: { picture: 'https://n/rev.jpg' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const results = await numistaService.search('turkey 1 lira');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { 'Numista-API-Key': 'nkey' } });
    expect(results[0]).toMatchObject({ id: 99, issuer: 'Turkey', minYear: 1959, maxYear: 1980, thumbnail: 'o.jpg' });

    const candidate = await numistaService.getType(99);
    const values = Object.fromEntries(candidate.fields.map((field) => [field.keys[0], field.value]));
    expect(values).toMatchObject({ country: 'Turkey', year: 1959, denomination: '1 Lira', metal: 'Stainless steel', weight: 7.5, diameter: 27 });
    expect(candidate.images).toEqual(['https://n/obv.jpg', 'https://n/rev.jpg']);
    expect(candidate.externalUrl).toBe('https://en.numista.com/catalogue/pieces99.html');
  });

  it('reports CORS/network failures clearly', async () => {
    setIntegrationKey('numista', 'nkey');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')));
    await expect(numistaService.search('x')).rejects.toMatchObject({ code: 'network', provider: 'numista' });
  });
});
