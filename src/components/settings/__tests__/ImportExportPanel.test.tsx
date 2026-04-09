import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImportExportPanel } from '@/components/settings/ImportExportPanel';
import { seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useCollectionStore } from '@/store/useCollectionStore';

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
}));

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return {
    ...actual,
    toast: {
      success: mocks.toastSuccess,
      error: mocks.toastError,
      warning: mocks.toastWarning,
    },
  };
});

function mockFileReader(result: string) {
  class MockFileReader {
    onload: ((event: ProgressEvent<FileReader>) => void) | null = null;

    readAsText() {
      this.onload?.({
        target: { result },
      } as ProgressEvent<FileReader>);
    }
  }

  vi.stubGlobal('FileReader', MockFileReader as unknown as typeof FileReader);
}

describe('ImportExportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
    seedCollectionStore(buildSeedData());
  });

  it('rejects invalid and partially invalid JSON imports', async () => {
    const user = userEvent.setup();
    const bulkAddItems = vi.fn(() => 1);
    useCollectionStore.setState({ bulkAddItems });

    mockFileReader('{"not":"an array"}');

    const view = render(
      <ImportExportPanel
        activeTab="import"
        onTabChange={vi.fn()}
      />,
    );

    const jsonInput = view.container.querySelector('input[accept=".json"]');
    expect(jsonInput).not.toBeNull();
    await user.upload(jsonInput as HTMLInputElement, new File(['{}'], 'items.json', { type: 'application/json' }));
    expect(mocks.toastError).toHaveBeenCalledWith('Invalid JSON', {
      description: 'Expected an array of items.',
    });

    mockFileReader(JSON.stringify([
      { title: 'Valid Book', categoryId: 'cat-books' },
      { title: '', categoryId: 'cat-books' },
      { title: 'Broken Category', categoryId: 'cat-missing' },
    ]));

    await user.upload(jsonInput as HTMLInputElement, new File(['[]'], 'mixed.json', { type: 'application/json' }));

    expect(await screen.findByText(/1 items found/i)).toBeInTheDocument();
    expect(mocks.toastWarning).toHaveBeenCalledWith('2 entries skipped', {
      description: 'Missing required title or invalid categoryId.',
    });

    await user.click(screen.getByRole('button', { name: /import 1 items/i }));
    expect(bulkAddItems).toHaveBeenCalledWith([
      expect.objectContaining({
        title: 'Valid Book',
        categoryId: 'cat-books',
      }),
    ]);
  });

  it('handles empty CSV previews, missing title columns, and valid CSV imports', async () => {
    const user = userEvent.setup();
    const bulkAddItems = vi.fn(() => 2);
    useCollectionStore.setState({ bulkAddItems });

    mockFileReader('');

    const view = render(
      <ImportExportPanel
        activeTab="import"
        onTabChange={vi.fn()}
      />,
    );

    const csvInput = view.container.querySelector('input[accept=".csv"]');
    expect(csvInput).not.toBeNull();
    await user.upload(csvInput as HTMLInputElement, new File([''], 'empty.csv', { type: 'text/csv' }));
    expect(mocks.toastError).toHaveBeenCalledWith('Empty or invalid CSV file');

    mockFileReader('description,price\nMissing title,15');
    await user.upload(csvInput as HTMLInputElement, new File([''], 'missing-title.csv', { type: 'text/csv' }));
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Books' }));
    await user.click(screen.getByRole('button', { name: /import 1 items/i }));
    expect(mocks.toastError).toHaveBeenCalledWith('No title column found', {
      description: 'CSV must have a column matching "title" or "name".',
    });

    mockFileReader('title,description,condition,price\nSnow Crash,Cyberpunk classic,Fair,42\nHyperion,Space opera,Mint,18');
    await user.upload(csvInput as HTMLInputElement, new File([''], 'books.csv', { type: 'text/csv' }));
    expect((await screen.findAllByText(/2 rows/i)).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Books' }));
    await user.click(screen.getByRole('button', { name: /import 2 items/i }));

    await waitFor(() => {
      expect(bulkAddItems).toHaveBeenCalledWith([
        expect.objectContaining({ title: 'Snow Crash', condition: 'Fair' }),
        expect.objectContaining({ title: 'Hyperion', condition: 'Mint' }),
      ]);
    });
  });
});
