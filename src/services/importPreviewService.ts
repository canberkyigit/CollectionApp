import type {
  Category,
  CategoryField,
  CollectionItem,
  ImportMapping,
  ImportPreviewRow,
  ImportValidationIssue,
} from '@/types';
import { t } from '@/i18n';

/** Built-in item properties a CSV column can be mapped to, in display order. */
export const IMPORT_BUILT_IN_FIELDS = [
  'title',
  'description',
  'condition',
  'purchasePrice',
  'purchaseCurrency',
  'purchaseDate',
  'currentValue',
  'location',
  'tags',
  'notes',
] as const;

export type ImportBuiltInField = typeof IMPORT_BUILT_IN_FIELDS[number];

const BUILT_IN_CANDIDATES: Record<ImportBuiltInField, string[]> = {
  title: ['title', 'name', 'item name', 'başlık', 'ad', 'isim', 'eser adı'],
  description: ['description', 'desc', 'açıklama'],
  condition: ['condition', 'grade', 'durum', 'kondisyon'],
  purchasePrice: ['purchase price', 'price', 'cost', 'value', 'alış fiyatı', 'fiyat', 'maliyet'],
  purchaseCurrency: ['purchase currency', 'currency', 'para birimi', 'alış para birimi'],
  purchaseDate: ['purchase date', 'date acquired', 'acquired date', 'alış tarihi', 'edinme tarihi'],
  currentValue: ['current value', 'estimated value', 'current estimated value', 'güncel değer', 'tahmini değer'],
  location: ['location', 'storage location', 'konum', 'yer'],
  tags: ['tags', 'tag', 'etiketler', 'etiket'],
  notes: ['notes', 'note', 'notlar', 'not'],
};

const TURKISH_ASCII: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', i̇: 'i', ö: 'o', ş: 's', ü: 'u',
};

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]|i̇/g, (char) => TURKISH_ASCII[char] ?? char)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/** Returns the matching header, or '' when no column matches. */
function findColumn(headers: string[], candidates: string[]): string {
  const normalizedCandidates = candidates.map(normalizeHeader);
  return headers.find((header) => normalizedCandidates.includes(normalizeHeader(header))) ?? '';
}

export function buildAutoCsvMapping(headers: string[], category: Category): ImportMapping {
  const builtInFields: Record<string, string> = {};
  for (const field of IMPORT_BUILT_IN_FIELDS) {
    builtInFields[field] = findColumn(headers, BUILT_IN_CANDIDATES[field]);
  }

  const customFields: Record<string, string> = {};
  for (const field of category.fields) {
    // Category fields that mirror a built-in (e.g. a required "title" field) reuse its column.
    const header = findColumn(headers, [field.key, field.label]) || builtInFields[field.key] || '';
    if (header) customFields[field.key] = header;
  }

  return {
    categoryId: category.id,
    builtInFields,
    customFields,
  };
}

/**
 * Applies user overrides on top of an automatic mapping. An override of ''
 * explicitly un-maps a field; headers that no longer exist are dropped.
 */
export function applyMappingOverrides(
  base: ImportMapping,
  overrides: { builtInFields?: Record<string, string>; customFields?: Record<string, string> },
  headers: string[],
): ImportMapping {
  const valid = (header: string | undefined) => (header && headers.includes(header) ? header : '');
  const builtInFields = { ...base.builtInFields };
  for (const [field, header] of Object.entries(overrides.builtInFields ?? {})) {
    builtInFields[field] = valid(header);
  }
  const customFields = { ...base.customFields };
  for (const [field, header] of Object.entries(overrides.customFields ?? {})) {
    const next = valid(header);
    if (next) customFields[field] = next;
    else delete customFields[field];
  }
  return { ...base, builtInFields, customFields };
}

/**
 * Parses numbers written either way: "1,234.56" (en) or "1.234,56" (tr),
 * with optional currency symbols / spaces. Returns NaN when not numeric.
 */
export function parseLocaleNumber(raw: string): number {
  let value = raw.trim().replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (!value || !/\d/.test(value)) return Number.NaN;
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  // A single separator followed by exactly three digits ("2.000", "1,250") is a
  // thousands separator in both locales; prices rarely carry three decimals.
  const singleThousands = value.match(/^(-?\d+)[.,](\d{3})$/);
  if (singleThousands && !/^-?0$/.test(singleThousands[1])) {
    return Number(`${singleThousands[1]}${singleThousands[2]}`);
  }
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      value = value.replace(/\./g, '').replace(',', '.');
    } else {
      value = value.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    value = (value.match(/,/g)?.length ?? 0) > 1 ? value.replace(/,/g, '') : value.replace(',', '.');
  } else if ((value.match(/\./g)?.length ?? 0) > 1) {
    value = value.replace(/\./g, '');
  }
  // Reject leftovers such as "12-3" that the cleanup above cannot make sense of.
  if (!/^-?\d+(\.\d+)?$/.test(value) && !/^-?\.\d+$/.test(value)) return Number.NaN;
  return Number(value);
}

/** Converts "31.12.2023" (day-first, as Turkish Excel writes) to ISO; leaves other values untouched. */
export function normalizeImportDate(raw: string): string {
  const match = raw.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return raw.trim();
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function splitList(raw: string): string[] {
  return raw.split(/[;,]/).map((entry) => entry.trim()).filter(Boolean);
}

function coerceFieldValue(field: CategoryField, value: string): unknown {
  switch (field.type) {
    case 'number':
    case 'currency': {
      const parsed = parseLocaleNumber(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    case 'boolean':
      return ['yes', 'true', '1', 'x', 'evet', 'var'].includes(value.trim().toLocaleLowerCase('tr-TR'));
    case 'multi-select':
    case 'tags':
      return splitList(value);
    case 'date':
      return normalizeImportDate(value);
    default:
      return value;
  }
}

function getCell(row: string[], headers: string[], header: string | undefined): string {
  if (!header) return '';
  const index = headers.indexOf(header);
  return index === -1 ? '' : row[index]?.trim() ?? '';
}

export function buildCsvImportPreview(
  headers: string[],
  rows: string[][],
  category: Category,
  mapping = buildAutoCsvMapping(headers, category),
): ImportPreviewRow[] {
  return rows.map((row, index) => {
    const issues: ImportValidationIssue[] = [];
    const title = getCell(row, headers, mapping.builtInFields.title);
    const values: Record<string, unknown> = {};

    if (!title) {
      issues.push({
        rowIndex: index,
        field: 'title',
        message: t('data.issue.missingTitle'),
        severity: 'error',
      });
    }

    for (const field of category.fields) {
      const header = mapping.customFields[field.key] || mapping.builtInFields[field.key];
      const value = getCell(row, headers, header);
      if (field.required && !value) {
        issues.push({
          rowIndex: index,
          field: field.key,
          message: t('data.issue.requiredEmpty', { field: field.label }),
          severity: 'error',
        });
      }
      if (value) values[field.key] = coerceFieldValue(field, value);
    }

    const price = getCell(row, headers, mapping.builtInFields.purchasePrice);
    if (price && Number.isNaN(parseLocaleNumber(price))) {
      issues.push({
        rowIndex: index,
        field: 'purchasePrice',
        message: t('data.issue.priceNotNumeric'),
        severity: 'warning',
      });
    }

    const currentValue = getCell(row, headers, mapping.builtInFields.currentValue);
    if (currentValue && Number.isNaN(parseLocaleNumber(currentValue))) {
      issues.push({
        rowIndex: index,
        field: 'currentValue',
        message: t('data.issue.valueNotNumeric'),
        severity: 'warning',
      });
    }

    return {
      rowIndex: index,
      title,
      categoryId: category.id,
      values,
      issues,
      canImport: issues.every((issue) => issue.severity !== 'error'),
    };
  });
}

export function buildItemFromCsvPreviewRow(
  row: ImportPreviewRow,
  headers: string[],
  rawRow: string[],
  mapping: ImportMapping,
  defaultContributorId: string,
): Omit<CollectionItem, 'id' | 'createdAt' | 'updatedAt'> {
  const priceRaw = getCell(rawRow, headers, mapping.builtInFields.purchasePrice);
  const valueRaw = getCell(rawRow, headers, mapping.builtInFields.currentValue);
  const tagsRaw = getCell(rawRow, headers, mapping.builtInFields.tags);
  const price = parseLocaleNumber(priceRaw);
  const safePrice = Number.isFinite(price) ? price : 0;
  const parsedValue = valueRaw ? parseLocaleNumber(valueRaw) : Number.NaN;
  const currentValue = Number.isFinite(parsedValue) ? parsedValue : safePrice;
  const currency = (getCell(rawRow, headers, mapping.builtInFields.purchaseCurrency) || 'USD').toUpperCase();
  const importedAt = new Date().toISOString();
  const purchaseDate = getCell(rawRow, headers, mapping.builtInFields.purchaseDate);

  return {
    categoryId: row.categoryId,
    title: row.title,
    description: getCell(rawRow, headers, mapping.builtInFields.description),
    customFields: row.values,
    notes: getCell(rawRow, headers, mapping.builtInFields.notes),
    tags: tagsRaw ? splitList(tagsRaw) : [],
    images: [],
    purchaseInfo: {
      purchasedAt: purchaseDate ? normalizeImportDate(purchaseDate) : importedAt,
      purchasePrice: safePrice,
      purchaseCurrency: currency,
      exchangeRateAtPurchase: 1,
    },
    valuationInfo: {
      currentEstimatedValue: currentValue,
      currentValueCurrency: currency,
      currentExchangeRate: 1,
      valueHistory: [],
    },
    contributorId: defaultContributorId,
    condition: getCell(rawRow, headers, mapping.builtInFields.condition) || 'Good',
    location: getCell(rawRow, headers, mapping.builtInFields.location) || undefined,
    isFavorite: false,
    maintenanceLog: [],
    lendingHistory: [],
    sourceMetadata: {
      provider: 'csv',
      importedAt,
      confidence: row.issues.length === 0 ? 0.9 : 0.7,
      fields: Object.keys(row.values),
    },
    documents: [],
  };
}
