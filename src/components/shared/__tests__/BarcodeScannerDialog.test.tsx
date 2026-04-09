import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BarcodeScannerDialog } from '@/components/shared/BarcodeScannerDialog';
import { bookSearchService } from '@/services/bookSearchService';

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  searchByISBN: vi.fn(),
  start: vi.fn(),
  stop: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn(),
  getState: vi.fn(() => 2),
}));

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock('@/services/bookSearchService', () => ({
  bookSearchService: {
    searchByISBN: mocks.searchByISBN,
  },
}));

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    constructor() {}

    start = mocks.start;
    stop = mocks.stop;
    clear = mocks.clear;
    getState = mocks.getState;
  },
}));

describe('BarcodeScannerDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getState.mockReturnValue(2);
    mocks.start.mockResolvedValue(undefined);
    mocks.searchByISBN.mockResolvedValue({
      key: '/works/OL45883W',
      title: 'The Hobbit',
      author: 'J.R.R. Tolkien',
      publishYear: 1937,
      pageCount: 310,
      isbn: '9780261103344',
      coverUrl: '',
      languages: ['English'],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates manual ISBN input before searching', async () => {
    const user = userEvent.setup();

    render(<BarcodeScannerDialog open onOpenChange={vi.fn()} onSelect={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /manual/i }));
    await user.type(screen.getByPlaceholderText(/9780141439518/i), '123');
    await user.click(screen.getByRole('button', { name: /^search$/i }));

    expect(mocks.toastError).toHaveBeenCalledWith('Invalid ISBN. Must be 10 or 13 digits.');
    expect(bookSearchService.searchByISBN).not.toHaveBeenCalled();
  });

  it('looks up a valid ISBN and applies the selected result', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSelect = vi.fn();

    render(<BarcodeScannerDialog open onOpenChange={onOpenChange} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: /manual/i }));
    await user.type(screen.getByPlaceholderText(/9780141439518/i), '9780261103344');
    await user.click(screen.getByRole('button', { name: /^search$/i }));

    expect(await screen.findByText('The Hobbit')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /use this book/i }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ title: 'The Hobbit' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('reports lookup failures and empty ISBN matches', async () => {
    const user = userEvent.setup();

    mocks.searchByISBN.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('network'));

    render(<BarcodeScannerDialog open onOpenChange={vi.fn()} onSelect={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /manual/i }));
    const input = screen.getByPlaceholderText(/9780141439518/i);

    await user.type(input, '9780261103344');
    await user.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith('No book found for ISBN: 9780261103344');
    });

    fireEvent.change(input, { target: { value: '9780141439518' } });
    await user.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith('ISBN lookup failed. Please try again.');
    });
  });

  it('falls back to manual mode when camera initialization fails', async () => {
    mocks.start.mockRejectedValue(new Error('Permission denied'));

    render(<BarcodeScannerDialog open onOpenChange={vi.fn()} onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(mocks.start).toHaveBeenCalled();
    });
    expect(await screen.findByPlaceholderText(/9780141439518/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manual/i })).toHaveClass('text-primary');
  });
});
