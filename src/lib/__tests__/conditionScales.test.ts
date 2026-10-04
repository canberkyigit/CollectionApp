import { describe, expect, it } from 'vitest';

import {
  getCollectibleKind,
  getConditionLabelKey,
  getConditionOptions,
  getConditionScale,
  getConditionTier,
} from '@/lib/conditionScales';
import { mockCategories } from '@/data/categories';

const category = (name: string, extra: Partial<{ id: string; slug: string; icon: string }> = {}) => ({
  id: extra.id ?? `cat-${name}`,
  name,
  slug: extra.slug ?? name.toLowerCase().replace(/\s+/g, '-'),
  icon: extra.icon ?? 'Package',
  fields: [],
});

describe('conditionScales', () => {
  it('detects collectible kinds from id, name (English and Turkish), slug and icon', () => {
    expect(getCollectibleKind(category('Books', { id: 'x1' }))).toBe('books');
    expect(getCollectibleKind(category('Kitaplar'))).toBe('books');
    expect(getCollectibleKind(category('Coins', { id: 'x2' }))).toBe('coins');
    expect(getCollectibleKind(category('Madeni Paralar'))).toBe('coins');
    expect(getCollectibleKind(category('Vinyl Records'))).toBe('vinyl');
    expect(getCollectibleKind(category('Plaklar'))).toBe('vinyl');
    expect(getCollectibleKind(category('Pul Koleksiyonu'))).toBe('stamps');
    expect(getCollectibleKind(category('Oyuncaklar'))).toBe('toys');
    expect(getCollectibleKind(category('Lego'))).toBe('toys');
    expect(getCollectibleKind(category('Çizgi Romanlar'))).toBe('comics');
    expect(getCollectibleKind(category('Saatler'))).toBe('watches');
    expect(getCollectibleKind(category('Treasures', { icon: 'Coins' }))).toBe('coins');
    expect(getCollectibleKind(category('Postcards'))).toBe('default');
    // "pul" must not match inside other words
    expect(getCollectibleKind(category('Popular culture'))).toBe('default');
    expect(getCollectibleKind(null)).toBe('default');
  });

  it('classifies the seeded starter categories', () => {
    const kinds = Object.fromEntries(mockCategories.map((entry) => [entry.id, getCollectibleKind(entry)]));
    expect(kinds['cat-books']).toBe('books');
    expect(kinds['cat-coins']).toBe('coins');
    expect(kinds['cat-stamps']).toBe('stamps');
    expect(kinds['cat-lego']).toBe('toys');
    expect(kinds['cat-vinyl-records']).toBe('vinyl');
    expect(kinds['cat-watches']).toBe('watches');
    expect(kinds['cat-comics']).toBe('comics');
    expect(kinds['cat-postcards']).toBe('default');
  });

  it('returns category-specific scales with stable English values', () => {
    expect(getConditionScale(category('Plaklar')).map((grade) => grade.value)).toEqual([
      'Mint (M)', 'Near Mint (NM)', 'Very Good Plus (VG+)', 'Very Good (VG)', 'Good Plus (G+)', 'Good (G)', 'Fair (F)', 'Poor (P)',
    ]);
    expect(getConditionScale(category('Books', { id: 'b' })).map((grade) => grade.value)).toEqual([
      'As New', 'Fine', 'Very Good', 'Good', 'Fair', 'Poor',
    ]);
    expect(getConditionScale(category('Coins', { id: 'c' }))[0].value).toBe('Uncirculated (MS)');
    expect(getConditionScale(category('Stamps', { id: 's' }))[0].value).toBe('Mint never hinged (MNH)');
    expect(getConditionScale(category('Gifts')).map((grade) => grade.value)).toEqual([
      'Mint', 'Near Mint', 'Very Good', 'Good', 'Fair', 'Poor',
    ]);
  });

  it('keeps legacy values that are not on the scale so existing data still shows', () => {
    const options = getConditionOptions(category('Coins', { id: 'c' }), 'Near Mint');
    expect(options.at(-1)).toMatchObject({ value: 'Near Mint', code: 'nearMint', tier: 1 });

    const freeText = getConditionOptions(category('Coins', { id: 'c' }), 'Slightly scratched');
    expect(freeText.at(-1)).toMatchObject({ value: 'Slightly scratched', code: '' });
    expect(getConditionOptions(category('Coins', { id: 'c' }), 'Fine (F)')).toHaveLength(9);
  });

  it('resolves label keys and tiers for any known grade', () => {
    expect(getConditionLabelKey('Very Good Plus (VG+)')).toBe('itemForm.condition.vinylVgPlus');
    expect(getConditionLabelKey('good')).toBe('itemForm.condition.good');
    expect(getConditionLabelKey('whatever')).toBeUndefined();
    expect(getConditionTier('Mint never hinged (MNH)')).toBe(0);
    expect(getConditionTier('Poor (P)')).toBe(5);
  });
});
