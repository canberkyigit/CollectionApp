import { describe, expect, it } from 'vitest';

import { collectTagUsage, replaceTagsOnItem, rewriteTags, withCurrentValue } from '@/store/bulkEditHelpers';
import { createMockItem } from '@/test/helpers';
import type { CollectionItem } from '@/types';

function item(id: string, tags: string[]): CollectionItem {
  return { ...createMockItem({ title: id, tags }), id, createdAt: '2024-01-01', updatedAt: '2024-01-01' } as CollectionItem;
}

describe('bulkEditHelpers', () => {
  it('counts tag usage per item, most used first', () => {
    const usage = collectTagUsage([item('a', ['sci-fi', 'classic']), item('b', ['sci-fi', 'sci-fi ']), item('c', [])]);
    expect(usage).toEqual([
      { tag: 'sci-fi', count: 2 },
      { tag: 'classic', count: 1 },
    ]);
  });

  it('renames a tag in place and de-duplicates when the target already exists', () => {
    expect(replaceTagsOnItem(['a', 'scifi', 'b'], ['scifi'], 'sci-fi')).toEqual(['a', 'sci-fi', 'b']);
    expect(replaceTagsOnItem(['sci-fi', 'scifi'], ['scifi'], 'sci-fi')).toEqual(['sci-fi']);
    expect(replaceTagsOnItem(['a'], ['scifi'], 'sci-fi')).toBeNull();
  });

  it('merges several tags into one across items and reports changed ids', () => {
    const items = [item('a', ['SF', 'classic']), item('b', ['scifi']), item('c', ['poetry'])];
    const result = rewriteTags(items, ['SF', 'scifi'], 'sci-fi', '2024-05-01T00:00:00.000Z');
    expect(result.changedIds).toEqual(['a', 'b']);
    expect(result.items[0].tags).toEqual(['sci-fi', 'classic']);
    expect(result.items[1].tags).toEqual(['sci-fi']);
    expect(result.items[0].updatedAt).toBe('2024-05-01T00:00:00.000Z');
    expect(result.items[2]).toBe(items[2]);
  });

  it('removes tags when the target is empty', () => {
    const result = rewriteTags([item('a', ['x', 'y']), item('b', ['y'])], ['y'], '', 'now');
    expect(result.items.map((entry) => entry.tags)).toEqual([['x'], []]);
    expect(result.changedIds).toEqual(['a', 'b']);
  });

  it('sets the current value and records one history entry per day', () => {
    const base = item('a', []);
    const once = withCurrentValue(base, 120, 'EUR', '2024-05-01', 'now');
    const twice = withCurrentValue(once, 150, 'EUR', '2024-05-01', 'now');
    expect(twice.valuationInfo.currentEstimatedValue).toBe(150);
    expect(twice.valuationInfo.currentValueCurrency).toBe('EUR');
    expect(twice.valuationInfo.valueHistory.filter((entry) => entry.date === '2024-05-01')).toEqual([
      { date: '2024-05-01', value: 150, currency: 'EUR' },
    ]);
  });
});
