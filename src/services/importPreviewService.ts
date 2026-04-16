import type {
  Category,
  CollectionItem,
  ImportMapping,
  ImportPreviewRow,
  ImportValidationIssue,
} from '@/types';

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findColumn(headers: string[], candidates: string[]): string {
  const normalized = headers.map((header) => ({ raw: header, normalized: normalizeHeader(header) }));
  const normalizedCandidates = candidates.map(normalizeHeader);
  return normalized.find((header) => normalizedCandidates.includes(header.normalized))?.raw ?? '';
}

export function buildAutoCsvMapping(headers: string[], category: Category): ImportMapping {
  const builtInFields = {
    title: findColumn(headers, ['title', 'name', 'item name']),
    description: findColumn(headers, ['description', 'desc']),
    condition: findColumn(headers, ['condition', 'grade']),
    purchasePrice: findColumn(headers, ['purchase price', 'price', 'cost', 'value']),
    purchaseCurrency: findColumn(headers, ['purchase currency', 'currency']),
    purchaseDate: findColumn(headers, ['purchase date', 'date acquired', 'acquired date']),
    location: findColumn(headers, ['location', 'storage location']),
    tags: findColumn(headers, ['tags', 'tag']),
  };

  const customFields: Record<string, string> = {};
  for (const field of category.fields) {
    const header = findColumn(headers, [field.key, field.label]);
    if (header) customFields[field.key] = header;
  }

  return {
    categoryId: category.id,
    builtInFields,
    customFields,
  };
}

function getCell(row: string[], headers: string[], header: string): string {
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
        message: 'Missing title/name column value.',
        severity: 'error',
      });
    }

    for (const field of category.fields) {
      const header = mapping.customFields[field.key];
      const value = getCell(row, headers, header);
      if (field.required && !value) {
        issues.push({
          rowIndex: index,
          field: field.key,
          message: `${field.label} is required but empty.`,
          severity: 'error',
        });
      }
      if (value) values[field.key] = field.type === 'number' || field.type === 'currency'
        ? Number(value) || 0
        : value;
    }

    const price = getCell(row, headers, mapping.builtInFields.purchasePrice);
    if (price && Number.isNaN(Number(price))) {
      issues.push({
        rowIndex: index,
        field: 'purchasePrice',
        message: 'Purchase price is not numeric and will be imported as 0.',
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
  const tagsRaw = getCell(rawRow, headers, mapping.builtInFields.tags);
  const price = Number(priceRaw);
  const currency = getCell(rawRow, headers, mapping.builtInFields.purchaseCurrency) || 'USD';
  const importedAt = new Date().toISOString();

  return {
    categoryId: row.categoryId,
    title: row.title,
    description: getCell(rawRow, headers, mapping.builtInFields.description),
    customFields: row.values,
    notes: '',
    tags: tagsRaw ? tagsRaw.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean) : [],
    images: [],
    purchaseInfo: {
      purchasedAt: getCell(rawRow, headers, mapping.builtInFields.purchaseDate) || importedAt,
      purchasePrice: Number.isFinite(price) ? price : 0,
      purchaseCurrency: currency,
      exchangeRateAtPurchase: 1,
    },
    valuationInfo: {
      currentEstimatedValue: Number.isFinite(price) ? price : 0,
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
