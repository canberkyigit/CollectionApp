import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ActivityLog from '../ActivityLog';
import Admin from '../Admin';
import AdminArchive from '../AdminArchive';
import AdminCategoryForm from '../AdminCategoryForm';
import AdminStorage from '../AdminStorage';
import CollectionDetail from '../CollectionDetail';
import Collections from '../Collections';
import Dashboard from '../Dashboard';
import Favorites from '../Favorites';
import ItemDetail from '../ItemDetail';
import ItemForm from '../ItemForm';
import LendingTracker from '../LendingTracker';
import Login from '../Login';
import Settings from '../Settings';
import Contributors from '../Contributors';
import Wishlist from '../Wishlist';
import { createMockCategory, createMockItem } from '@/test/helpers';
import { renderRoute, renderWithRouter, seedAuthStore, seedCollectionStore } from '@/test/render';
import { useAuthStore } from '@/store/useAuthStore';
import { useCollectionStore } from '@/store/useCollectionStore';

function buildSeedData() {
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
  ];

  const libraries = [
    { id: 'lib-books', name: 'Main Shelf', categoryIds: ['cat-books'], order: 0, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
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
        images: ['https://example.com/dune.jpg'],
        customFields: { title: 'Dune', author: 'Frank Herbert', publisher: 'Ace', isbn: '111' },
        purchaseInfo: { purchasedAt: '2024-01-01', purchasePrice: 25, purchaseCurrency: 'USD', exchangeRateAtPurchase: 1, currencyEquivalents: [] },
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
        contributorId: 'contrib-1',
        customFields: { title: 'Kind of Blue', artist: 'Miles Davis' },
        purchaseInfo: { purchasedAt: '2024-03-01', purchasePrice: 30, purchaseCurrency: 'USD', exchangeRateAtPurchase: 1, currencyEquivalents: [] },
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
      action: 'export_created' as const,
      entityType: 'system' as const,
      entityId: 'export-1',
      entityTitle: 'Collection Export',
      details: 'JSON export',
      userId: 'contrib-1',
      timestamp: '2024-02-03T10:00:00Z',
    },
  ];

  return { categories, contributors, libraries, items, wishlist, activityLog };
}

describe('page smoke coverage', () => {
  beforeEach(() => {
    const seed = buildSeedData();
    seedCollectionStore(seed);
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
    window.scrollTo = vi.fn();
  });

  it('renders dashboard and collections pages', async () => {
    const user = userEvent.setup();

    const dashboardView = renderWithRouter(<Dashboard />);
    expect(screen.getByText('Statistics')).toBeInTheDocument();
    expect(screen.getAllByText('Dune')[0]).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /main shelf/i }));
    dashboardView.unmount();

    renderRoute({
      path: '/collections',
      initialEntry: '/collections?contributor=contrib-1',
      ui: <Collections />,
    });
    expect(screen.getByText(/browsing categories for ada curator/i)).toBeInTheDocument();
  });

  it('renders collection detail, favorites, and item detail flows', async () => {
    const user = userEvent.setup();

    const collectionView = renderRoute({
      path: '/collections/:categorySlug',
      initialEntry: '/collections/books?library=all',
      ui: <CollectionDetail />,
    });
    expect(screen.getByRole('heading', { name: 'Books' })).toBeInTheDocument();
    await user.click(screen.getByTitle('List'));
    collectionView.unmount();

    const favoritesView = renderWithRouter(<Favorites />);
    expect(screen.getByText('Dune')).toBeInTheDocument();
    favoritesView.unmount();

    renderRoute({
      path: '/items/:itemId',
      initialEntry: '/items/item-1',
      ui: <ItemDetail />,
    });
    expect(screen.getAllByText('Dune')[0]).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /starred/i }));
  });

  it('does not crash when opening a collection route before data is loaded', () => {
    seedCollectionStore({});

    renderRoute({
      path: '/collections/:categorySlug',
      initialEntry: '/collections/books?library=all',
      ui: <CollectionDetail />,
    });

    expect(screen.getByRole('heading', { name: 'Category Not Found' })).toBeInTheDocument();
    expect(screen.getByText(/doesn't exist/i)).toBeInTheDocument();
  });

  it('renders wishlist, lending tracker, activity log, and export screens', async () => {
    const user = userEvent.setup();

    const wishlistView = renderWithRouter(<Wishlist />);
    expect(screen.getByRole('heading', { name: 'Wishlist' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add item/i }));
    wishlistView.unmount();

    const lendingView = renderWithRouter(<LendingTracker />);
    expect(screen.getByText('Lending Tracker')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /lend item/i }));
    lendingView.unmount();

    const activityView = renderWithRouter(<ActivityLog />);
    expect(screen.getByText('Activity Log')).toBeInTheDocument();
    expect(screen.getByText('Collection Export')).toBeInTheDocument();
    activityView.unmount();

    renderRoute({
      path: '/settings',
      initialEntry: '/settings?section=data&dataTab=import',
      ui: <Settings />,
    });
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /import/i })).toHaveAttribute('data-state', 'active');
  });

  it('renders admin pages and archived data views', () => {
    const adminView = renderWithRouter(<Admin />);
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    adminView.unmount();

    const storageView = renderWithRouter(<AdminStorage />);
    expect(screen.getByRole('heading', { name: 'Data & Storage' })).toBeInTheDocument();
    storageView.unmount();

    const archiveView = renderWithRouter(<AdminArchive />);
    expect(screen.getByRole('heading', { name: 'Archive' })).toBeInTheDocument();
    archiveView.unmount();

    renderRoute({
      path: '/admin/categories/new',
      initialEntry: '/admin/categories/new',
      ui: <AdminCategoryForm />,
    });
    expect(screen.getByText('New Category')).toBeInTheDocument();
  });

  it('renders login and item form routes', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      loginWithEmail: vi.fn(async () => undefined),
      registerWithEmail: vi.fn(async () => undefined),
      loginWithGoogle: vi.fn(async () => undefined),
      loginOffline: vi.fn(),
      clearError: vi.fn(),
    });

    const loginView = renderWithRouter(<Login />);
    expect(screen.getAllByText('CollectVault')[0]).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /create one/i }));
    loginView.unmount();

    renderRoute({
      path: '/items/new',
      initialEntry: '/items/new?category=books',
      ui: <ItemForm />,
    });
    expect(screen.getByText('Add New Item')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search open library/i })).toBeInTheDocument();
  });

  it('shows cold-load fallbacks instead of crashing during remote boot on main pages', () => {
    seedCollectionStore({});
    useCollectionStore.setState({
      ownerUserId: 'contrib-1',
      isRemoteDataLoading: true,
    });

    const dashboardView = renderWithRouter(<Dashboard />);
    expect(screen.getByText('Statistics')).toBeInTheDocument();
    dashboardView.unmount();

    const favoritesView = renderWithRouter(<Favorites />);
    expect(screen.getByText('Favorites')).toBeInTheDocument();
    favoritesView.unmount();

    const wishlistView = renderWithRouter(<Wishlist />);
    expect(screen.getByRole('heading', { name: 'Wishlist' })).toBeInTheDocument();
    wishlistView.unmount();

    const lendingView = renderWithRouter(<LendingTracker />);
    expect(screen.getByText('Lending Tracker')).toBeInTheDocument();
    lendingView.unmount();

    const activityView = renderWithRouter(<ActivityLog />);
    expect(screen.getByText('Activity Log')).toBeInTheDocument();
    activityView.unmount();

    renderWithRouter(<Contributors />);
    expect(screen.getByText('Contributors')).toBeInTheDocument();
  });
});
