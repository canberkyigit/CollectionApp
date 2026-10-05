import type { CategoryField } from '@/types';

export const BULK_EDITABLE_TYPES = new Set<CategoryField['type']>([
  'text', 'textarea', 'rich-notes', 'number', 'currency', 'date', 'select', 'multi-select', 'tags', 'boolean',
]);

/** Converts the raw input into the value stored for the field type; undefined = invalid. */
export function coerceBulkFieldValue(field: CategoryField, raw: string): unknown {
  switch (field.type) {
    case 'number':
    case 'currency': {
      const parsed = Number(raw.replace(',', '.'));
      return raw.trim() !== '' && Number.isFinite(parsed) ? parsed : undefined;
    }
    case 'boolean':
      return raw === 'true';
    case 'multi-select':
    case 'tags':
      return raw.split(/[;,]/).map((entry) => entry.trim()).filter(Boolean);
    default:
      return raw.trim() === '' ? undefined : raw;
  }
}
