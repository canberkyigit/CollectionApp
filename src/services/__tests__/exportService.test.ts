import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Category, CollectionItem } from '@/types';

// Mock DOM APIs used by exportService
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  const mockAnchor = {
    href: '',
    download: '',
    click: mockClick,
  } as unknown as HTMLAnchorElement;
  vi.spyOn(document, 'createElement').mockReturnValue({
    ...mockAnchor,
  });
  vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
  vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);
  vi.spyOn(URL, 'createObjectURL').mockImplementation(mockCreateObjectURL);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(mockRevokeObjectURL);
});

// Dynamic import so mocks are in place
async function getService() {
  const mod = await import('../exportService');
  return mod.exportService;
}

const mockCategory: Category = {
  id: 'cat-1',
  name: 'Books',
  slug: 'books',
  icon: 'BookOpen',
  description: '',
  fields: [
    { id: 'title', key: 'title', label: 'Title', type: 'text' as const, required: true, order: 1 },
    { id: 'author', key: 'author', label: 'Author', type: 'text' as const, required: false, order: 2 },
  ],
  order: 0,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const mockItem: CollectionItem = {
  id: 'item-1',
  categoryId: 'cat-1',
  title: 'Test Book',
  description: 'A test',
  customFields: { title: 'Test Book', author: 'John Doe' },
  notes: 'Great read',
  tags: ['fiction', 'classic'],
  images: [],
  purchaseInfo: {
    purchasedAt: '2024-01-15',
    purchasePrice: 25,
    purchaseCurrency: 'USD',
    exchangeRateAtPurchase: 1,
    currencyEquivalents: [],
  },
  valuationInfo: {
    currentEstimatedValue: 30,
    currentValueCurrency: 'USD',
    currentExchangeRate: 1,
    targetYearProjection: 2030,
    valueHistory: [],
  },
  contributorId: 'contrib-1',
  condition: 'Good',
  isFavorite: true,
  maintenanceLog: [],
  lendingHistory: [],
  createdAt: '2024-01-15',
  updatedAt: '2024-01-15',
};

describe('exportService', () => {
  describe('exportToCSV', () => {
    it('triggers a file download with CSV content', async () => {
      const service = await getService();
      service.exportToCSV([mockItem], [mockCategory], 'test.csv');

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      expect(blob).toBeInstanceOf(Blob);
      expect(mockClick).toHaveBeenCalledTimes(1);
      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
    });

    it('includes headers and item data', async () => {
      const service = await getService();
      service.exportToCSV([mockItem], [mockCategory], 'test.csv');

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await blob.text();

      expect(text).toContain('ID,Title,Category');
      expect(text).toContain('Test Book');
      expect(text).toContain('Books');
      expect(text).toContain('Good');
      expect(text).toContain('fiction; classic');
    });

    it('neutralizes CSV formula injection attempts in item fields', async () => {
      const service = await getService();
      const maliciousItem: CollectionItem = {
        ...mockItem,
        id: 'item-malicious',
        title: '=cmd|"/c calc"!A1',
        notes: '+SUM(1+1)',
        location: '@HYPERLINK("https://evil.example/")',
        description: 'Plain description with no formula',
      };
      service.exportToCSV([maliciousItem], [mockCategory], 'malicious.csv');

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await blob.text();

      expect(text).toContain("'=cmd");
      expect(text).toContain("'+SUM(1+1)");
      expect(text).toContain("'@HYPERLINK");
      expect(text).not.toMatch(/(^|,|\n)=cmd/);
      expect(text).not.toMatch(/(^|,|\n)\+SUM/);
      expect(text).not.toMatch(/(^|,|\n)@HYPERLINK/);
    });
  });

  describe('exportToJSON', () => {
    it('triggers a JSON file download', async () => {
      const service = await getService();
      service.exportToJSON([mockItem], 'test.json');

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await blob.text();
      const parsed = JSON.parse(text);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].title).toBe('Test Book');
    });
  });

  describe('exportCategoryToCSV', () => {
    it('includes category-specific custom field columns', async () => {
      const service = await getService();
      service.exportCategoryToCSV([mockItem], mockCategory, 'books.csv');

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await blob.text();

      expect(text).toContain('Title');
      expect(text).toContain('Author');
      expect(text).toContain('John Doe');
    });
  });

  describe('exportBackupBundle', () => {
    it('exports a full backup bundle with related collection data', async () => {
      const service = await getService();
      service.exportBackupBundle({
        categories: [mockCategory],
        items: [mockItem],
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
      }, 'backup.json');

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const parsed = JSON.parse(await blob.text());

      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.items[0].title).toBe('Test Book');
      expect(parsed.categories[0].name).toBe('Books');
      expect(parsed.settings.displayCurrency).toBe('USD');
    });
  });
});
