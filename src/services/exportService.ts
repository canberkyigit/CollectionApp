import type {
  ActivityLogEntry,
  Category,
  CollectionItem,
  Contributor,
  DashboardWidgetConfig,
  Library,
  WishlistItem,
} from '@/types';
import { getItemCurrentValueCurrency, getItemGainLoss } from '@/lib/valuation';
import { getLanguage, t } from '@/i18n';

/** Column separator for CSV exports. Excel in Turkish/European locales expects `;`. */
export type CsvExportDelimiter = ',' | ';';

export interface CsvExportOptions {
  delimiter?: CsvExportDelimiter;
}

/** Semicolon when the UI is Turkish (Excel TR opens it as columns), comma otherwise. */
export function getDefaultCsvDelimiter(): CsvExportDelimiter {
  return getLanguage() === 'tr' ? ';' : ',';
}

/** UTF-8 byte-order mark: makes Excel decode ş, ğ, ı, € etc. correctly. */
export const UTF8_BOM = '\uFEFF';

// CSV "formula injection" guard. If a cell starts with =, +, @, tab, or CR,
// some spreadsheet applications (Excel, Google Sheets, LibreOffice) will
// interpret it as a formula. Prefixing such values with a single quote
// neutralizes the formula while leaving the visible content intact.
// Reference: https://owasp.org/www-community/attacks/CSV_Injection
const FORMULA_PREFIX_PATTERN = /^[=+@\t\r]/;

function escapeCSV(value: string, delimiter: CsvExportDelimiter = ','): string {
  let escaped = value;
  if (FORMULA_PREFIX_PATTERN.test(value)) {
    escaped = `'${value}`;
  }
  if (
    escaped.includes(delimiter)
    || escaped.includes(',')
    || escaped.includes('"')
    || escaped.includes('\n')
    || escaped.includes('\r')
  ) {
    return `"${escaped.replace(/"/g, '""')}"`;
  }
  return escaped;
}

function formatGainLoss(item: CollectionItem): string {
  const gainLoss = getItemGainLoss(item, 'USD');
  if (item.purchaseInfo.purchasePrice === 0) return t('data.col.notAvailable');
  return `${gainLoss.percentage >= 0 ? '+' : ''}${gainLoss.percentage.toFixed(1)}%`;
}

function toCSVRow(values: string[], delimiter: CsvExportDelimiter): string {
  return values.map((value) => escapeCSV(value, delimiter)).join(delimiter);
}

function buildCsv(headers: string[], rows: string[][], options?: CsvExportOptions): string {
  const delimiter = options?.delimiter ?? getDefaultCsvDelimiter();
  // CRLF line endings are what Excel writes and reads most reliably.
  return UTF8_BOM + [headers, ...rows].map((row) => toCSVRow(row, delimiter)).join('\r\n');
}

function baseHeaders(includeCategory: boolean): string[] {
  return [
    t('data.col.id'), t('data.col.title'),
    ...(includeCategory ? [t('data.col.category')] : []),
    t('data.col.description'), t('data.col.condition'), t('data.col.location'),
    t('data.col.purchaseDate'), t('data.col.purchasePrice'), t('data.col.purchaseCurrency'),
    t('data.col.currentValue'), t('data.col.valueCurrency'), t('data.col.gainLoss'),
    t('data.col.tags'), t('data.col.notes'), t('data.col.favorite'), t('data.col.created'), t('data.col.updated'),
  ];
}

function formatCustomValue(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join('; ');
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no');
  return String(value);
}

function timestamp(): string {
  return String(Date.now());
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const exportService = {
  exportToCSV(
    items: CollectionItem[],
    categories: Category[],
    filename?: string,
    options?: CsvExportOptions,
  ): void {
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const allCustomKeys = new Map<string, string>();
    for (const item of items) {
      const cat = categoryMap.get(item.categoryId);
      if (cat) {
        for (const field of cat.fields) {
          allCustomKeys.set(field.key, field.label);
        }
      }
    }

    const customKeyEntries = Array.from(allCustomKeys.entries());

    const headers = [
      ...baseHeaders(true),
      ...customKeyEntries.map(([, label]) => label),
    ];

    const rows = items.map((item) => {
      const cat = categoryMap.get(item.categoryId);
      const currentValueCurrency = getItemCurrentValueCurrency(item);
      return [
        item.id,
        item.title,
        cat?.name ?? '',
        item.description,
        item.condition,
        item.location ?? '',
        item.purchaseInfo.purchasedAt,
        String(item.purchaseInfo.purchasePrice),
        item.purchaseInfo.purchaseCurrency,
        String(item.valuationInfo.currentEstimatedValue),
        currentValueCurrency,
        formatGainLoss(item),
        item.tags.join('; '),
        item.notes,
        item.isFavorite ? t('common.yes') : t('common.no'),
        item.createdAt,
        item.updatedAt,
        ...customKeyEntries.map(([key]) => formatCustomValue(item.customFields[key])),
      ];
    });

    const csv = buildCsv(headers, rows, options);
    downloadFile(csv, filename ?? `curio-export-${timestamp()}.csv`, 'text/csv;charset=utf-8;');
  },

  exportToJSON(items: CollectionItem[], filename?: string): void {
    const json = JSON.stringify(items, null, 2);
    downloadFile(json, filename ?? `curio-export-${timestamp()}.json`, 'application/json');
  },

  exportCategoryToCSV(
    items: CollectionItem[],
    category: Category,
    filename?: string,
    options?: CsvExportOptions,
  ): void {
    const customFields = category.fields;

    const headers = [
      ...baseHeaders(false),
      ...customFields.map((f) => f.label),
    ];

    const rows = items.map((item) => {
      const currentValueCurrency = getItemCurrentValueCurrency(item);
      return [
        item.id,
        item.title,
        item.description,
        item.condition,
        item.location ?? '',
        item.purchaseInfo.purchasedAt,
        String(item.purchaseInfo.purchasePrice),
        item.purchaseInfo.purchaseCurrency,
        String(item.valuationInfo.currentEstimatedValue),
        currentValueCurrency,
        formatGainLoss(item),
        item.tags.join('; '),
        item.notes,
        item.isFavorite ? t('common.yes') : t('common.no'),
        item.createdAt,
        item.updatedAt,
        ...customFields.map((f) => formatCustomValue(item.customFields[f.key])),
      ];
    });

    const csv = buildCsv(headers, rows, options);
    const name = filename ?? `curio-${category.slug}-${timestamp()}.csv`;
    downloadFile(csv, name, 'text/csv;charset=utf-8;');
  },

  exportBackupBundle(data: {
    categories: Category[];
    items: CollectionItem[];
    libraries: Library[];
    wishlist: WishlistItem[];
    activityLog: ActivityLogEntry[];
    contributors: Contributor[];
    settings: {
      displayCurrency: string;
      theme: 'light' | 'dark';
      sidebarOpen: boolean;
      menuCollectionStyle: 'style1' | 'style2';
      dashboardWidgets: DashboardWidgetConfig[];
      readNotificationIds: string[];
      notifications: { valueChangeAlerts: boolean; newItemReminders: boolean; collectionMilestones: boolean };
    };
  }, filename?: string): void {
    const backup = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      ...data,
    };

    downloadFile(
      JSON.stringify(backup, null, 2),
      filename ?? `curio-backup-${timestamp()}.json`,
      'application/json',
    );
  },
};
