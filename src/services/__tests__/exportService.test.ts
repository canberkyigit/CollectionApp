import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DOM APIs used by exportService
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(document, 'createElement').mockReturnValue({
    href: '',
    download: '',
    click: mockClick,
  } as any);
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

const mockCategory = {
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

const mockItem = {
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
      service.exportToCSV([mockItem as any], [mockCategory as any], 'test.csv');

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      expect(blob).toBeInstanceOf(Blob);
      expect(mockClick).toHaveBeenCalledTimes(1);
      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
    });

    it('includes headers and item data', async () => {
      const service = await getService();
      service.exportToCSV([mockItem as any], [mockCategory as any], 'test.csv');

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await blob.text();

      expect(text).toContain('ID,Title,Category');
      expect(text).toContain('Test Book');
      expect(text).toContain('Books');
      expect(text).toContain('Good');
      expect(text).toContain('fiction; classic');
    });
  });

  describe('exportToJSON', () => {
    it('triggers a JSON file download', async () => {
      const service = await getService();
      service.exportToJSON([mockItem as any], 'test.json');

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
      service.exportCategoryToCSV([mockItem as any], mockCategory as any, 'books.csv');

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await blob.text();

      expect(text).toContain('Title');
      expect(text).toContain('Author');
      expect(text).toContain('John Doe');
    });
  });
});
