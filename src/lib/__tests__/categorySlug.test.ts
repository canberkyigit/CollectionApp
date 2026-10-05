import { describe, expect, it } from 'vitest';

import { resolveCategorySlug } from '@/lib/categorySlug';

const existing = [
  { id: 'a', slug: 'books' },
  { id: 'b', slug: 'books-2' },
  { id: 'c', slug: 'vinyl' },
];

describe('resolveCategorySlug', () => {
  it('slugifies the typed slug, falling back to the name', () => {
    expect(resolveCategorySlug('Board Games', 'x', [])).toBe('board-games');
    expect(resolveCategorySlug('', 'Çay Bardakları', [])).toBe('cay-bardaklari');
  });

  it('appends the next free numeric suffix on collision', () => {
    expect(resolveCategorySlug('books', 'Books', existing)).toBe('books-3');
    expect(resolveCategorySlug('vinyl', 'Vinyl', existing)).toBe('vinyl-2');
  });

  it('ignores the category being edited', () => {
    expect(resolveCategorySlug('vinyl', 'Vinyl', existing, 'c')).toBe('vinyl');
  });
});
