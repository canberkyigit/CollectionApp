import type { CollectionItem, Library } from '@/types';

export function getLibraryCategoryIds(
  library: Pick<Library, 'categoryIds' | 'categoryId'> | null | undefined,
): string[] {
  if (!library) return [];

  const explicitCategoryIds = Array.isArray(library.categoryIds) ? library.categoryIds : [];
  const ids = [
    ...(explicitCategoryIds.length > 0 ? explicitCategoryIds : [library.categoryId]),
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return Array.from(new Set(ids));
}

export function libraryMatchesCategory(
  library: Pick<Library, 'categoryIds' | 'categoryId'> | null | undefined,
  categoryId: string,
): boolean {
  return getLibraryCategoryIds(library).includes(categoryId);
}

export function isItemAssignedToCategoryLibrary(
  item: Pick<CollectionItem, 'libraryId'>,
  categoryId: string,
  libraries: Array<Pick<Library, 'id' | 'categoryIds' | 'categoryId'>>,
): boolean {
  if (!item.libraryId) return false;

  const assignedLibrary = libraries.find((library) => library.id === item.libraryId);
  return libraryMatchesCategory(assignedLibrary, categoryId);
}

export function isItemUnassignedForCategory(
  item: Pick<CollectionItem, 'libraryId'>,
  categoryId: string,
  libraries: Array<Pick<Library, 'id' | 'categoryIds' | 'categoryId'>>,
): boolean {
  return !isItemAssignedToCategoryLibrary(item, categoryId, libraries);
}

export function normalizeLibrary(library: Library): Library {
  const categoryIds = getLibraryCategoryIds(library);

  return {
    ...library,
    categoryIds,
    categoryId: categoryIds[0],
  };
}
