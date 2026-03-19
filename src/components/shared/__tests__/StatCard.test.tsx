import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from '../StatCard';
import { DollarSign } from 'lucide-react';

describe('StatCard', () => {
  it('renders title and value', () => {
    render(<StatCard title="Total Items" value="42" icon={DollarSign} />);

    expect(screen.getByText('Total Items')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<StatCard title="Value" value="$1,000" icon={DollarSign} subtitle="across all categories" />);

    expect(screen.getByText('across all categories')).toBeInTheDocument();
  });

  it('renders positive trend', () => {
    render(<StatCard title="Value" value="$1,000" icon={DollarSign} trend={{ value: 12.5, isPositive: true }} />);

    expect(screen.getByText('12.5%')).toBeInTheDocument();
  });

  it('renders negative trend', () => {
    render(<StatCard title="Value" value="$500" icon={DollarSign} trend={{ value: -5.3, isPositive: false }} />);

    expect(screen.getByText('5.3%')).toBeInTheDocument();
  });

  it('renders without trend or subtitle', () => {
    const { container } = render(<StatCard title="Count" value="10" icon={DollarSign} />);
    expect(container.querySelector('.text-green-600')).toBeNull();
    expect(container.querySelector('.text-red-600')).toBeNull();
  });
});
