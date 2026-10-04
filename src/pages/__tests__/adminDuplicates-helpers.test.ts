import { describe, expect, it } from 'vitest';

import { createMockItem } from '@/test/helpers';
import { duplicateTitleKey, findDuplicateGroups } from '@/pages/adminDuplicates-helpers';

function item(id: string, title: string, extra: Partial<ReturnType<typeof createMockItem>> = {}) {
  return { ...createMockItem({ title, categoryId: 'cat-books', ...extra }), id, createdAt: '2024-01-01', updatedAt: '2024-01-01' };
}

describe('duplicate detection helpers', () => {
  it('folds Turkish characters, accents, case and punctuation in title keys', () => {
    expect(duplicateTitleKey('Şeker Portakalı')).toBe(duplicateTitleKey('seker portakali'));
    expect(duplicateTitleKey('İnce Memed!')).toBe(duplicateTitleKey('ince   memed'));
    expect(duplicateTitleKey('Çalıkuşu')).toBe('calikusu');
    expect(duplicateTitleKey('Café')).toBe(duplicateTitleKey('cafe'));
  });

  it('groups by title and ISBN within a category, skipping archived items', () => {
    const groups = findDuplicateGroups(
      [
        item('a', 'Şeker Portakalı'),
        item('b', 'SEKER PORTAKALI'),
        item('c', 'Other', { customFields: { isbn: '978-0-00-000000-1' } }),
        item('d', 'Different', { customFields: { isbn: '9780000000001' } }),
        item('e', 'seker portakali', { isArchived: true }),
        item('f', 'Şeker Portakalı', { categoryId: 'cat-vinyl' }),
      ],
      new Map([['cat-books', 'Books']]),
    );

    expect(groups.map((group) => [group.reason, group.items.map((entry) => entry.id)])).toEqual([
      ['title', ['a', 'b']],
      ['isbn', ['c', 'd']],
    ]);
    expect(groups[0].categoryName).toBe('Books');
  });
});
