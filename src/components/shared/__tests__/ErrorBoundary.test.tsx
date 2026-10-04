import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { isChunkLoadError } from '@/components/shared/chunkLoadError';

function Boom({ error }: { error: Error }): never {
  throw error;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    render(<ErrorBoundary><p>Healthy page</p></ErrorBoundary>);
    expect(screen.getByText('Healthy page')).toBeInTheDocument();
  });

  it('shows a friendly fallback with reload and home actions', async () => {
    const user = userEvent.setup();
    const onNavigateHome = vi.fn();

    render(
      <ErrorBoundary onNavigateHome={onNavigateHome}>
        <Boom error={new Error('kaboom')} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go to collections' }));
    expect(onNavigateHome).toHaveBeenCalledTimes(1);
  });

  it('offers a reload for lazy chunk load failures', () => {
    render(
      <ErrorBoundary>
        <Boom error={new TypeError('Failed to fetch dynamically imported module: /assets/Dashboard.js')} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('This page could not load')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('resets when the reset key changes', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Boom error={new Error('kaboom')} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKey="/b">
        <p>Next page</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Next page')).toBeInTheDocument();
  });

  it('detects chunk load errors', () => {
    expect(isChunkLoadError(new Error('Loading chunk 42 failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Something else'))).toBe(false);
    expect(isChunkLoadError('nope')).toBe(false);
  });
});
