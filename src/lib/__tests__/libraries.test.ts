import { describe, expect, it } from 'vitest';

import { createMockItem } from '@/test/helpers';
import { isItemAssignedToCategoryLibrary, isItemUnassignedForCategory } from '../libraries';

describe('libraries helpers', () => {
  const libraries = [
    { id: 'lib-1', name: 'Library 1', categoryIds: ['cat-books'], categoryId: 'cat-books' },
    { id: 'lib-2', name: 'Library 2', categoryIds: ['cat-vinyl'], categoryId: 'cat-vinyl' },
  ];

  it('treats items without a valid category library as unassigned', () => {
    const assignedItem = createMockItem({ categoryId: 'cat-books', libraryId: 'lib-1' });
    const missingLibraryItem = createMockItem({ categoryId: 'cat-books', libraryId: 'lib-missing' });
    const wrongCategoryLibraryItem = createMockItem({ categoryId: 'cat-books', libraryId: 'lib-2' });
    const emptyItem = createMockItem({ categoryId: 'cat-books', libraryId: undefined });

    expect(isItemAssignedToCategoryLibrary(assignedItem, 'cat-books', libraries)).toBe(true);
    expect(isItemUnassignedForCategory(assignedItem, 'cat-books', libraries)).toBe(false);

    expect(isItemAssignedToCategoryLibrary(missingLibraryItem, 'cat-books', libraries)).toBe(false);
    expect(isItemUnassignedForCategory(missingLibraryItem, 'cat-books', libraries)).toBe(true);

    expect(isItemAssignedToCategoryLibrary(wrongCategoryLibraryItem, 'cat-books', libraries)).toBe(false);
    expect(isItemUnassignedForCategory(wrongCategoryLibraryItem, 'cat-books', libraries)).toBe(true);

    expect(isItemUnassignedForCategory(emptyItem, 'cat-books', libraries)).toBe(true);
  });
});
