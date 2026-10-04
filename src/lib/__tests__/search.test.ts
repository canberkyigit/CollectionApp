import { describe, expect, it } from 'vitest';

import {
  describeSearchMatch,
  matchesQuery,
  normalizeSearchText,
  parseItemLink,
  searchItems,
} from '@/lib/search';
import { buildSeedData } from '@/test/seed';
import type { CollectionItem } from '@/types';

function seedItems(): CollectionItem[] {
  return buildSeedData().items as CollectionItem[];
}

describe('search helpers', () => {
  it('folds Turkish characters, accents and case', () => {
    expect(normalizeSearchText('  Şefik IŞIK Çağrı Öğüt  ')).toBe('sefik isik cagri ogut');
    expect(normalizeSearchText('İstanbul')).toBe('istanbul');
    expect(normalizeSearchText('Café Noël')).toBe('cafe noel');
    expect(matchesQuery('isik', 'Işık')).toBe(true);
    expect(matchesQuery('', 'anything')).toBe(false);
  });

  it('matches custom fields, notes, location and tags with AND semantics', () => {
    const items = seedItems();
    items[0] = { ...items[0], location: 'Çalışma odası', tags: ['bilim kurgu'] };

    expect(searchItems(items, 'herbert').map((m) => m.item.id)).toEqual(['item-1']);
    expect(searchItems(items, 'dune herbert').map((m) => m.item.id)).toEqual(['item-1']);
    expect(searchItems(items, 'calisma').map((m) => m.item.id)).toEqual(['item-1']);
    expect(searchItems(items, 'kurgu').map((m) => m.item.id)).toEqual(['item-1']);
    expect(searchItems(items, 'shelf note').map((m) => m.item.id)).toEqual(['item-1']);
    expect(searchItems(items, 'miles').map((m) => m.item.id)).toEqual(['item-2']);
    expect(searchItems(items, 'dune miles')).toEqual([]);
  });

  it('skips archived items unless asked and ranks title hits first', () => {
    const items = seedItems();
    expect(searchItems(items, 'gone author')).toEqual([]);
    expect(searchItems(items, 'gone author', { includeArchived: true })).toHaveLength(1);

    const extra = { ...items[1], id: 'item-x', title: 'Herbert biography', customFields: {} };
    const ranked = searchItems([...items, extra], 'herbert');
    expect(ranked[0].item.id).toBe('item-x');
    expect(ranked[1].match).toEqual({ field: 'author', value: 'Frank Herbert' });
  });

  it('describes custom-field and built-in matches', () => {
    const [books] = buildSeedData().categories;
    const translate = (key: string) => (key === 'nav.field.notes' ? 'Notes' : key);
    expect(describeSearchMatch({ field: 'author', value: 'Frank Herbert' }, books, translate)).toBe('Author: Frank Herbert');
    expect(describeSearchMatch({ field: 'notes', value: 'Shelf note' }, books, translate)).toBe('Notes: Shelf note');
  });

  it('extracts item ids from Curio label links on any origin', () => {
    expect(parseItemLink('https://curio.example.com/items/abc-123')).toBe('abc-123');
    expect(parseItemLink('http://localhost:5173/items/item-1?ref=label')).toBe('item-1');
    expect(parseItemLink('app://./items/item%2042/')).toBe('item 42');
    expect(parseItemLink('/items/xyz')).toBe('xyz');
    expect(parseItemLink('https://example.com/items/new')).toBeNull();
    expect(parseItemLink('https://example.com/collections/books')).toBeNull();
    expect(parseItemLink('9780261103344')).toBeNull();
  });
});
