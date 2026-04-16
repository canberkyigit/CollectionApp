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

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatGainLoss(item: CollectionItem): string {
  const gainLoss = getItemGainLoss(item, 'USD');
  if (item.purchaseInfo.purchasePrice === 0) return 'N/A';
  return `${gainLoss.percentage >= 0 ? '+' : ''}${gainLoss.percentage.toFixed(1)}%`;
}

function toCSVRow(values: string[]): string {
  return values.map(escapeCSV).join(',');
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
  exportToCSV(items: CollectionItem[], categories: Category[], filename?: string): void {
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
      'ID', 'Title', 'Category', 'Description', 'Condition', 'Location',
      'Purchase Date', 'Purchase Price', 'Purchase Currency',
      'Current Value', 'Value Currency', 'Gain/Loss %',
      'Tags', 'Notes', 'Favorite', 'Created', 'Updated',
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
        item.isFavorite ? 'Yes' : 'No',
        item.createdAt,
        item.updatedAt,
        ...customKeyEntries.map(([key]) => String(item.customFields[key] ?? '')),
      ];
    });

    const csv = [toCSVRow(headers), ...rows.map(toCSVRow)].join('\n');
    downloadFile(csv, filename ?? `collection-export-${Date.now()}.csv`, 'text/csv;charset=utf-8;');
  },

  exportToJSON(items: CollectionItem[], filename?: string): void {
    const json = JSON.stringify(items, null, 2);
    downloadFile(json, filename ?? `collection-export-${Date.now()}.json`, 'application/json');
  },

  exportCategoryToCSV(items: CollectionItem[], category: Category, filename?: string): void {
    const customFields = category.fields;

    const headers = [
      'ID', 'Title', 'Description', 'Condition', 'Location',
      'Purchase Date', 'Purchase Price', 'Purchase Currency',
      'Current Value', 'Value Currency', 'Gain/Loss %',
      'Tags', 'Notes', 'Favorite', 'Created', 'Updated',
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
        item.isFavorite ? 'Yes' : 'No',
        item.createdAt,
        item.updatedAt,
        ...customFields.map((f) => String(item.customFields[f.key] ?? '')),
      ];
    });

    const csv = [toCSVRow(headers), ...rows.map(toCSVRow)].join('\n');
    const name = filename ?? `${category.slug}-export-${Date.now()}.csv`;
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
      filename ?? `collectvault-backup-${Date.now()}.json`,
      'application/json',
    );
  },
};
