import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VirtualGrid, VirtualList } from '@/components/shared/VirtualList';

describe('virtual list helpers', () => {
  it('renders every item below the virtualization threshold', () => {
    const items = Array.from({ length: 5 }, (_, index) => `Item ${index}`);

    render(
      <VirtualList
        items={items}
        threshold={80}
        estimateSize={40}
        getItemKey={(item) => item}
        renderItem={(item) => <div data-testid="virtual-row">{item}</div>}
      />,
    );

    expect(screen.getAllByTestId('virtual-row')).toHaveLength(5);
    expect(screen.queryByText('Item 4')).toBeInTheDocument();
  });

  it('limits rendered rows for large lists', () => {
    const items = Array.from({ length: 200 }, (_, index) => `Item ${index}`);

    render(
      <VirtualList
        items={items}
        threshold={80}
        estimateSize={40}
        getItemKey={(item) => item}
        renderItem={(item) => <div data-testid="virtual-row">{item}</div>}
      />,
    );

    const renderedRows = screen.getAllByTestId('virtual-row');
    expect(renderedRows.length).toBeGreaterThan(0);
    expect(renderedRows.length).toBeLessThan(200);
    expect(screen.getByText('Item 0')).toBeInTheDocument();
    expect(screen.queryByText('Item 199')).not.toBeInTheDocument();
  });

  it('virtualizes large grids by row while keeping visible cards rendered', () => {
    const items = Array.from({ length: 200 }, (_, index) => `Card ${index}`);

    render(
      <VirtualGrid
        items={items}
        threshold={80}
        minColumnWidth={200}
        estimateRowHeight={90}
        getItemKey={(item) => item}
        renderItem={(item) => <div data-testid="virtual-card">{item}</div>}
      />,
    );

    const renderedCards = screen.getAllByTestId('virtual-card');
    expect(renderedCards.length).toBeGreaterThan(0);
    expect(renderedCards.length).toBeLessThan(200);
    expect(screen.getByText('Card 0')).toBeInTheDocument();
    expect(screen.queryByText('Card 199')).not.toBeInTheDocument();
  });
});
