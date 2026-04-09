import type { CollectionItem, Category } from '@/types';

export function createMockItem(overrides: Partial<CollectionItem> = {}): Omit<CollectionItem, 'id' | 'createdAt' | 'updatedAt'> {
  const {
    id: _ignoredId,
    createdAt: _ignoredCreatedAt,
    updatedAt: _ignoredUpdatedAt,
    ...safeOverrides
  } = overrides;

  return {
    categoryId: 'cat-books',
    title: 'Test Book',
    description: 'A test book',
    customFields: { title: 'Test Book', author: 'Test Author' },
    notes: '',
    tags: ['test'],
    images: [],
    purchaseInfo: {
      purchasedAt: '2024-01-01T00:00:00Z',
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
      valueHistory: [{ date: '2024-01-01', value: 25, currency: 'USD' }],
    },
    contributorId: 'contrib-1',
    condition: 'Good',
    isFavorite: false,
    maintenanceLog: [],
    lendingHistory: [],
    quantity: 1,
    ...safeOverrides,
  };
}

export function createMockCategory(overrides: Partial<Category> = {}): Omit<Category, 'id' | 'order' | 'createdAt' | 'updatedAt'> {
  const {
    id: _ignoredId,
    order: _ignoredOrder,
    createdAt: _ignoredCreatedAt,
    updatedAt: _ignoredUpdatedAt,
    ...safeOverrides
  } = overrides;

  return {
    name: 'Test Category',
    slug: 'test-category',
    icon: 'BookOpen',
    description: 'A test category',
    fields: [
      { id: 'title', key: 'title', label: 'Title', type: 'text', required: true, order: 1 },
      { id: 'author', key: 'author', label: 'Author', type: 'text', required: false, order: 2 },
    ],
    ...safeOverrides,
  };
}
