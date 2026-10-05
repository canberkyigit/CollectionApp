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

    await user.type(screen.getByPlaceholderText('Search items…'), 'books');
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

    await user.type(screen.getByPlaceholderText('Search items…'), 'nonexistent');
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });
  it('prints compact stickers for the selection', async () => {
    const user = userEvent.setup();
    renderWithRouter(<AdminPrintLabels />, ['/admin/print-labels?mode=stickers']);

    expect(screen.getByRole('tab', { name: 'Stickers' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByText(/24 stickers per A4 page/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /select all/i }));
    expect(screen.getByText(/Preview \(3 items\)/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /print \(3\)/i }));
    expect(window.print).toHaveBeenCalled();
  });

  it('renders the inventory report with totals and a save-as-PDF hint', async () => {
    const user = userEvent.setup();
    renderWithRouter(<AdminPrintLabels />, ['/admin/print-labels?mode=report']);

    expect(screen.getByRole('heading', { name: 'Inventory report' })).toBeInTheDocument();
    expect(screen.getByText(/as the printer in the print dialog/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Summary by category' })).toBeInTheDocument();
    expect(screen.getAllByText('Blue Mauritius').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('combobox', { name: /^category$/i }));
    await user.click(await screen.findByRole('option', { name: 'Stamps' }));
    expect(screen.queryByText('Dune')).not.toBeInTheDocument();
    expect(screen.getByText(/Selection: Stamps/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /print or save as pdf/i }));
    expect(window.print).toHaveBeenCalled();
  });
});
