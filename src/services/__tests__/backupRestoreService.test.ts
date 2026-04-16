import { describe, expect, it } from 'vitest';

import {
  buildBackupRestorePreview,
  buildBackupRestoreState,
  type BackupBundle,
  type RestorableBackupState,
} from '@/services/backupRestoreService';
import type { Category, CollectionItem } from '@/types';

const category: Category = {
  id: 'cat-books',
  name: 'Books',
  slug: 'books',
  icon: 'BookOpen',
  description: 'Books',
  fields: [],
  order: 0,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const currentItem: CollectionItem = {
  id: 'item-1',
  categoryId: 'cat-books',
  title: 'Current Book',
  description: 'Current copy',
  customFields: {},
  notes: '',
  tags: [],
  images: [],
  purchaseInfo: {
    purchasedAt: '2024-01-01',
    purchasePrice: 10,
    purchaseCurrency: 'USD',
    exchangeRateAtPurchase: 1,
    currencyEquivalents: [],
  },
  valuationInfo: {
    currentEstimatedValue: 10,
    currentValueCurrency: 'USD',
    currentExchangeRate: 1,
    valueHistory: [],
  },
  contributorId: 'contrib-1',
  condition: 'Good',
  isFavorite: false,
  maintenanceLog: [],
  lendingHistory: [],
  documents: [],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const backupItem: CollectionItem = {
  ...currentItem,
  title: 'Backup Book',
  notes: 'Restored notes',
  updatedAt: '2024-02-01',
};

const currentState: RestorableBackupState = {
  categories: [category],
  items: [currentItem],
  libraries: [],
  wishlist: [],
  activityLog: [],
  contributors: [],
  settings: {
    displayCurrency: 'USD',
    theme: 'light',
    sidebarOpen: true,
    menuCollectionStyle: 'style1',
    dashboardWidgets: [],
    readNotificationIds: [],
    notifications: {
      valueChangeAlerts: true,
      newItemReminders: true,
      collectionMilestones: true,
    },
  },
};

const backup: BackupBundle = {
  schemaVersion: 1,
  exportedAt: '2024-03-01T00:00:00.000Z',
  categories: [category],
  items: [
    backupItem,
    {
      ...backupItem,
      id: 'item-2',
      title: 'Backup Only Book',
    },
  ],
  libraries: [],
  wishlist: [],
  activityLog: [],
  contributors: [],
  settings: {
    ...currentState.settings,
    displayCurrency: 'EUR',
    theme: 'dark',
  },
};

describe('backupRestoreService', () => {
  it('builds a merge preview with conflict and skipped summaries', () => {
    const preview = buildBackupRestorePreview({
      ...backup,
      items: [
        ...backup.items,
        { id: 'broken', title: 'Broken Item', categoryId: 'cat-missing' },
      ],
    }, currentState, 'merge');

    expect(preview.canRestore).toBe(true);
    expect(preview.conflicts).toEqual([
      expect.objectContaining({ collection: 'items', id: 'item-1', label: 'Backup Book' }),
    ]);
    expect(preview.skipped).toEqual([
      expect.objectContaining({ collection: 'items', id: 'broken' }),
    ]);
    expect(preview.resultCounts.items).toBe(2);
  });

  it('keeps current settings for merge and applies backup settings for replace', () => {
    const merged = buildBackupRestoreState(backup, currentState, 'merge');
    const replaced = buildBackupRestoreState(backup, currentState, 'replace');

    expect(merged?.items).toHaveLength(2);
    expect(merged?.items.find((item) => item.id === 'item-1')?.title).toBe('Backup Book');
    expect(merged?.settings.displayCurrency).toBe('USD');

    expect(replaced?.items).toHaveLength(2);
    expect(replaced?.settings.displayCurrency).toBe('EUR');
    expect(replaced?.settings.theme).toBe('dark');
  });

  it('blocks unsupported schema versions and malformed backup files', () => {
    const unsupported = buildBackupRestorePreview({ ...backup, schemaVersion: 99 }, currentState, 'replace');
    const malformed = buildBackupRestorePreview({ schemaVersion: 1, items: [] }, currentState, 'replace');

    expect(unsupported.canRestore).toBe(false);
    expect(unsupported.errors[0]).toMatch(/unsupported backup schema/i);
    expect(malformed.canRestore).toBe(false);
    expect(malformed.errors).toContain('Backup is missing the "categories" array.');
  });
});
