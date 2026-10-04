import type { Category } from '@/types';
import { slugify } from '@/lib/utils';

/**
 * Resolve the URL slug for a category: respect the slug the user typed (falling
 * back to the name), normalise it with `slugify`, and append -2, -3… until it no
 * longer collides with another category's slug.
 */
export function resolveCategorySlug(
  desired: string | undefined,
  name: string,
  categories: Pick<Category, 'id' | 'slug'>[],
  excludeId?: string,
): string {
  const base = slugify(desired?.trim() ? desired : name);
  const taken = new Set(
    categories
      .filter((category) => category.id !== excludeId)
      .map((category) => category.slug),
  );

  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
