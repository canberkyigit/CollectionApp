import { createMockCategory, createMockItem } from '@/test/helpers';

export function buildSeedData() {
  const categories = [
    {
      ...createMockCategory({
        name: 'Books',
        slug: 'books',
        description: 'Book collection',
        fields: [
          { id: 'title', key: 'title', label: 'Title', type: 'text', required: true, order: 0 },
          { id: 'author', key: 'author', label: 'Author', type: 'text', required: false, order: 1 },
          { id: 'publisher', key: 'publisher', label: 'Publisher', type: 'text', required: false, order: 2 },
          { id: 'isbn', key: 'isbn', label: 'ISBN', type: 'text', required: false, order: 3 },
        ],
      }),
      id: 'cat-books',
      order: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
    {
      ...createMockCategory({
        name: 'Vinyl',
        slug: 'vinyl',
        description: 'Record collection',
        icon: 'Package',
      }),
      id: 'cat-vinyl',
      order: 1,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
  ];

  const contributors = [
    {
      id: 'contrib-1',
      name: 'Ada Curator',
      avatar: '',
      role: 'admin' as const,
      joinedAt: '2024-01-01',
      itemCount: 3,
      totalContributionValue: 100,
      lastContributionAt: '2024-02-02',
    },
    {
      id: 'contrib-2',
      name: 'Grace Guest',
      avatar: '',
      role: 'viewer' as const,
      joinedAt: '2024-02-01',
      itemCount: 1,
      totalContributionValue: 55,
      lastContributionAt: '2024-03-20',
    },
  ];

  const libraries = [
    { id: 'lib-books', name: 'Main Shelf', categoryIds: ['cat-books'], order: 0, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'lib-vinyl', name: 'Jazz Cabinet', categoryIds: ['cat-vinyl'], order: 0, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ];

  const items = [
    {
      ...createMockItem({
        title: 'Dune',
        categoryId: 'cat-books',
        contributorId: 'contrib-1',
        isFavorite: true,
        isRead: true,
        libraryId: 'lib-books',
        images: ['https://example.com/dune.jpg', 'https://example.com/dune-back.jpg'],
        customFields: {
          title: 'Dune',
          author: 'Frank Herbert',
          publisher: 'Ace',
          isbn: '111',
          notes: 'Shelf note',
        },
        notes: 'Shelf note',
        purchaseInfo: {
          purchasedAt: '2024-01-01',
          purchasePrice: 25,
          purchaseCurrency: 'USD',
          exchangeRateAtPurchase: 1,
          purchaseLocation: 'London',
          currencyEquivalents: [
            { currency: 'USD', rate: 31, value: 25 },
            { currency: 'EUR', rate: 34, value: 22.7941 },
            { currency: 'GBP', rate: 39, value: 19.8718 },
          ],
        },
        valuationInfo: {
          currentEstimatedValue: 40,
          currentValueCurrency: 'USD',
          currentExchangeRate: 1,
          valueHistory: [
            { date: '2024-01-01', value: 25, currency: 'USD' },
            { date: '2024-02-01', value: 40, currency: 'USD' },
          ],
        },
        lendingHistory: [
          {
            id: 'lend-1',
            borrowerName: 'John Reader',
            lentDate: '2024-02-01',
            expectedReturnDate: '2024-02-10',
            notes: 'Handle carefully',
            condition: 'pending',
          },
        ],
      }),
      id: 'item-1',
      createdAt: '2024-01-02',
      updatedAt: '2024-02-02',
    },
    {
      ...createMockItem({
        title: 'Kind of Blue',
        categoryId: 'cat-vinyl',
        contributorId: 'contrib-2',
        libraryId: 'lib-vinyl',
        customFields: { title: 'Kind of Blue', artist: 'Miles Davis' },
        purchaseInfo: {
          purchasedAt: '2024-03-01',
          purchasePrice: 30,
          purchaseCurrency: 'USD',
          exchangeRateAtPurchase: 1,
          currencyEquivalents: [],
        },
        valuationInfo: {
          currentEstimatedValue: 55,
          currentValueCurrency: 'USD',
          currentExchangeRate: 1,
          valueHistory: [
            { date: '2024-03-01', value: 30, currency: 'USD' },
            { date: '2024-03-20', value: 55, currency: 'USD' },
          ],
        },
      }),
      id: 'item-2',
      createdAt: '2024-03-02',
      updatedAt: '2024-03-20',
    },
    {
      ...createMockItem({
        title: 'Archived Book',
        categoryId: 'cat-books',
        contributorId: 'contrib-1',
        isArchived: true,
        archivedAt: '2024-04-01',
        customFields: { title: 'Archived Book', author: 'Gone Author' },
      }),
      id: 'item-3',
      createdAt: '2024-01-10',
      updatedAt: '2024-04-01',
    },
  ];

  const wishlist = [
    {
      id: 'wish-1',
      categoryId: 'cat-books',
      title: 'Neuromancer',
      description: 'Need a first edition',
      targetPrice: 35,
      targetCurrency: 'USD',
      priority: 'high' as const,
      source: 'Local store',
      notes: 'Look for signed copy',
      images: [],
      tags: ['cyberpunk'],
      addedBy: 'contrib-1',
      isAcquired: false,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
  ];

  const activityLog = [
    {
      id: 'act-1',
      action: 'item_created' as const,
      entityType: 'item' as const,
      entityId: 'item-1',
      entityTitle: 'Dune',
      details: 'Added by Ada',
      userId: 'contrib-1',
      timestamp: '2024-02-02T10:00:00Z',
    },
    {
      id: 'act-2',
      action: 'wishlist_added' as const,
      entityType: 'wishlist' as const,
      entityId: 'wish-1',
      entityTitle: 'Neuromancer',
      details: 'Added to wishlist',
      userId: 'contrib-1',
      timestamp: '2024-02-03T10:00:00Z',
    },
  ];

  return { categories, contributors, libraries, items, wishlist, activityLog };
}
