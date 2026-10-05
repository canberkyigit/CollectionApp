import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { AdvancedFilters } from '@/components/shared/AdvancedFilters';
import { DEFAULT_FILTERS, type FilterState } from '@/components/shared';
import type { Category } from '@/types';

const bookCategory: Category = {
  id: 'cat-books',
  name: 'Books',
  slug: 'books',
  icon: 'BookOpen',
  description: 'Book collection',
  order: 0,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  fields: [
    { id: 'title', key: 'title', label: 'Title', type: 'text', required: true, order: 0 },
    { id: 'binding', key: 'binding', label: 'Binding', type: 'select', required: false, order: 1, options: ['Hardcover', 'Paperback'] },
    { id: 'signed', key: 'signed', label: 'Signed', type: 'boolean', required: false, order: 2 },
  ],
};

function FiltersHarness() {
  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTERS,
    priceRange: [0, 100],
    valueRange: [0, 250],
  });

  return (
    <AdvancedFilters
      filters={filters}
      onChange={setFilters}
      maxPrice={100}
      maxValue={250}
      availableTags={['rare', 'signed']}
      availableCurrencies={['USD', 'EUR']}
      currencySymbol="$"
      category={bookCategory}
      availableConditions={["Mint"]}
    />
  );
}

describe('AdvancedFilters', () => {
  it('opens, applies multiple filters, shows chips, and resets state', async () => {
    const user = userEvent.setup();
    render(<FiltersHarness />);

    await user.click(screen.getByRole('button', { name: /filters/i }));
    await user.click(screen.getByRole('button', { name: 'Mint' }));
    await user.click(screen.getByRole('button', { name: 'EUR' }));
    await user.click(screen.getByRole('button', { name: '#rare' }));
    await user.click(screen.getByRole('checkbox', { name: /favorites only/i }));
    await user.click(screen.getAllByRole('checkbox', { name: /read only/i })[0]);
    await user.click(screen.getByRole('checkbox', { name: /signed only/i }));
    await user.click(screen.getByRole('button', { name: 'Hardcover' }));

    expect(screen.getByText('Favorites')).toBeInTheDocument();
    expect(screen.getByText('Read')).toBeInTheDocument();
    expect(screen.getByText('Binding: Hardcover')).toBeInTheDocument();
    expect(screen.getByText('Signed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear all/i }));

    expect(screen.queryByText('Favorites')).not.toBeInTheDocument();
    expect(screen.queryByText('Read')).not.toBeInTheDocument();
    expect(screen.queryByText('Binding: Hardcover')).not.toBeInTheDocument();
  });
});
