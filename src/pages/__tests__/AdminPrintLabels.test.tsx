import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminPrintLabels from '../AdminPrintLabels';
import { createMockCategory, createMockItem } from '@/test/helpers';
import { renderWithRouter, seedCollectionStore } from '@/test/render';

describe('AdminPrintLabels', () => {
  beforeEach(() => {
    seedCollectionStore({
      categories: [
        { ...createMockCategory({ name: 'Books', slug: 'books' }), id: 'cat-books', order: 0, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
        { ...createMockCategory({ name: 'Stamps', slug: 'stamps' }), id: 'cat-stamps', order: 1, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      ],
      items: [
        { ...createMockItem({ title: 'Dune', categoryId: 'cat-books' }), id: 'item-1', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
        { ...createMockItem({ title: 'Foundation', categoryId: 'cat-books' }), id: 'item-2', createdAt: '2024-01-02', updatedAt: '2024-01-02' },
        { ...createMockItem({ title: 'Blue Mauritius', categoryId: 'cat-stamps' }), id: 'item-3', createdAt: '2024-01-03', updatedAt: '2024-01-03' },
      ],
    });
    window.print = vi.fn();
  });

  it('filters by category text, supports category selection, and prints', async () => {
    const user = userEvent.setup();
    renderWithRouter(<AdminPrintLabels />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Books' }));

    await user.type(screen.getByPlaceholderText('Search items...'), 'books');
    expect(screen.getByText('Dune')).toBeInTheDocument();
    expect(screen.getByText('Foundation')).toBeInTheDocument();
    expect(screen.queryByText('Blue Mauritius')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /select all/i }));
    expect(screen.getByText(/Preview \(2 items\)/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /print \(2\)/i }));
    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when no items match search', async () => {
    const user = userEvent.setup();
    renderWithRouter(<AdminPrintLabels />);

    await user.type(screen.getByPlaceholderText('Search items...'), 'nonexistent');
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });
});
