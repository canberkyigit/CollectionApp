import type { Category } from '@/types';

type CategoryLike = Pick<Category, 'id' | 'name' | 'slug'> & { fields?: Category['fields']; icon?: string };

const BOOK_NAME_PATTERN = /\b(books?|kitap(lar)?|kitaplık|library)\b/i;

/**
 * True when a category holds books — enables ISBN lookup, the barcode scanner
 * and book-specific filters/display. Works for user-created categories, not
 * just the seeded `cat-books`.
 */
export function isBookCategory(category: CategoryLike | null | undefined): boolean {
  if (!category) return false;
  if (category.id === 'cat-books') return true;
  if (category.icon === 'BookOpen' || category.icon === 'Book') return true;
  if (category.fields?.some((field) => field.key.toLowerCase() === 'isbn')) return true;
  return BOOK_NAME_PATTERN.test(category.name) || BOOK_NAME_PATTERN.test(category.slug.replace(/-/g, ' '));
}
