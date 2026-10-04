import { render as rtlRender, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
}

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
  let originalDesktopBridge: typeof window.collectVaultDesktop;

  beforeEach(() => {
    vi.clearAllMocks();
    originalDesktopBridge = window.collectVaultDesktop;
    window.collectVaultDesktop = undefined;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:backup'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    HTMLAnchorElement.prototype.click = vi.fn();
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
    seedCollectionStore(buildSeedData());
  });

  afterEach(() => {
    window.collectVaultDesktop = originalDesktopBridge;
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
    await user.click(screen.getByRole('combobox', { name: /assign to category/i }));
    await user.click(await screen.findByRole('option', { name: 'Books' }));
    expect(await screen.findByText(/0 ready, 1 skipped/i)).toBeInTheDocument();
    expect(screen.getByText(/missing title\/name column value/i)).toBeInTheDocument();

    mockFileReader('title,description,condition,price\nSnow Crash,Cyberpunk classic,Fair,42\nHyperion,Space opera,Mint,18');
    await user.upload(csvInput as HTMLInputElement, new File([''], 'books.csv', { type: 'text/csv' }));
    expect((await screen.findAllByText(/2 rows/i)).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('combobox', { name: /assign to category/i }));
    await user.click(await screen.findByRole('option', { name: 'Books' }));
    await user.click(screen.getByRole('button', { name: /import 2 items/i }));

    await waitFor(() => {
      expect(bulkAddItems).toHaveBeenCalledWith([
        expect.objectContaining({ title: 'Snow Crash', condition: 'Fair' }),
        expect.objectContaining({ title: 'Hyperion', condition: 'Mint' }),
      ]);
    });
  });

  it('previews full backup restores and requires a safety backup before replace', async () => {
    const user = userEvent.setup();
    const seed = buildSeedData();
    const restoreBackupBundle = vi.fn(async () => undefined);
    useCollectionStore.setState({ restoreBackupBundle });

    const backup = {
      schemaVersion: 1,
      exportedAt: '2024-03-01T00:00:00.000Z',
      ...seed,
      items: [
        {
          ...seed.items[0],
          title: `${seed.items[0].title} Restored`,
          updatedAt: '2024-03-01T00:00:00.000Z',
        },
        {
          ...seed.items[0],
          id: 'backup-only-item',
          title: 'Backup Only Item',
        },
      ],
      settings: {
        displayCurrency: 'EUR',
        theme: 'dark',
        sidebarOpen: true,
        menuCollectionStyle: 'style2',
        dashboardWidgets: [],
        readNotificationIds: [],
        notifications: {
          valueChangeAlerts: true,
          newItemReminders: true,
          collectionMilestones: true,
        },
      },
    };

    mockFileReader(JSON.stringify(backup));

    const view = render(
      <ImportExportPanel
        activeTab="import"
        onTabChange={vi.fn()}
      />,
    );

    const jsonInput = view.container.querySelector('input[accept=".json"]');
    expect(jsonInput).not.toBeNull();
    await user.upload(jsonInput as HTMLInputElement, new File(['{}'], 'backup.json', { type: 'application/json' }));

    expect(await screen.findByText(/full backup restore preview/i)).toBeInTheDocument();
    expect(screen.getByText(/1 same-id conflict/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^merge backup$/i }));
    const mergeDialog = await screen.findByRole('dialog');
    await user.click(within(mergeDialog).getByRole('button', { name: /^merge backup$/i }));

    await waitFor(() => {
      expect(restoreBackupBundle).toHaveBeenCalledWith(expect.objectContaining({ schemaVersion: 1 }), 'merge');
    });

    restoreBackupBundle.mockClear();
    mockFileReader(JSON.stringify(backup));
    await user.upload(jsonInput as HTMLInputElement, new File(['{}'], 'backup-again.json', { type: 'application/json' }));
    await user.click(await screen.findByRole('button', { name: /replace all/i }));

    expect(screen.getByRole('button', { name: /restore and replace all/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /download current backup first/i }));
    await user.click(screen.getByRole('button', { name: /restore and replace all/i }));
    const replaceDialog = await screen.findByRole('dialog');
    await user.click(within(replaceDialog).getByRole('button', { name: /replace all data/i }));

    await waitFor(() => {
      expect(restoreBackupBundle).toHaveBeenCalledWith(expect.objectContaining({ schemaVersion: 1 }), 'replace');
    });
  });

  it('disables local sync in the web app and uses the desktop bridge when available', async () => {
    const seed = buildSeedData();
    const localStatus = {
      exists: true,
      path: '/Users/test/Documents/Curio/Local Sync',
      sizeBytes: 4096,
      syncedAt: '2026-04-16T12:00:00.000Z',
      counts: {
        categories: seed.categories.length,
        items: seed.items.length,
        libraries: seed.libraries.length,
        wishlist: seed.wishlist.length,
        activityLog: seed.activityLog.length,
        contributors: seed.contributors.length,
      },
      assetCount: 2,
      failedAssets: [],
    };

    const webView = render(
      <ImportExportPanel
        activeTab="local-sync"
        onTabChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/desktop app required/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /sync with local/i })).toBeDisabled();
    webView.unmount();

    const restoreBackupBundle = vi.fn(async () => undefined);
    useCollectionStore.setState({ restoreBackupBundle });
    const syncSnapshot = vi.fn(async () => localStatus);
    const restoreSnapshot = vi.fn(async () => ({
      schemaVersion: 1,
      exportedAt: '2026-04-16T12:00:00.000Z',
      ...seed,
      settings: {
        displayCurrency: 'USD',
        theme: 'light',
        sidebarOpen: true,
        menuCollectionStyle: 'style1',
        dashboardWidgets: [],
        readNotificationIds: [],
        notifications: {
          valueChangeAlerts: true,
          newItemReminders: true,
          collectionMilestones: true,
        },
      },
    }));

    window.collectVaultDesktop = {
      isDesktop: true,
      platform: 'darwin',
      localSync: {
        getStatus: vi.fn(async () => localStatus),
        syncSnapshot,
        restoreSnapshot,
        openFolder: vi.fn(async () => true),
      },
    };

    const user = userEvent.setup();
    render(
      <ImportExportPanel
        activeTab="local-sync"
        onTabChange={vi.fn()}
      />,
    );

    expect(await screen.findByText(/local copy status/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^sync with local$/i }));

    await waitFor(() => {
      expect(syncSnapshot).toHaveBeenCalledWith(expect.objectContaining({
        schemaVersion: 1,
        items: expect.any(Array),
      }));
    });

    await user.click(screen.getByRole('button', { name: /load local copy/i }));
    expect(await screen.findByText(/local restore preview/i)).toBeInTheDocument();

    const mergeButtons = screen.getAllByRole('button', { name: /merge local copy/i });
    await user.click(mergeButtons[mergeButtons.length - 1]);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /merge local copy/i }));

    await waitFor(() => {
      expect(restoreBackupBundle).toHaveBeenCalledWith(expect.objectContaining({ schemaVersion: 1 }), 'merge');
    });
  });
  it('detects semicolon CSVs and lets the user remap columns before importing', async () => {
    const user = userEvent.setup();
    const bulkAddItems = vi.fn(() => 1);
    useCollectionStore.setState({ bulkAddItems });

    mockFileReader('﻿Ad;Yazar;Fiyat\r\nDune;Frank Herbert;"1.250,50"\r\n');

    const view = render(<ImportExportPanel activeTab="import" onTabChange={vi.fn()} />);
    const csvInput = view.container.querySelector('input[accept=".csv"]');
    await user.upload(csvInput as HTMLInputElement, new File([''], 'tr.csv', { type: 'text/csv' }));

    expect(screen.getByText(/1 rows · 3 columns/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /separator/i })).toHaveTextContent(/auto \(semicolon\)/i);

    await user.click(screen.getByRole('combobox', { name: /assign to category/i }));
    await user.click(await screen.findByRole('option', { name: 'Books' }));

    expect(screen.getByText('Column mapping')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /csv column for author/i })).toHaveTextContent('Not imported');

    await user.click(screen.getByRole('combobox', { name: /csv column for author/i }));
    await user.click(await screen.findByRole('option', { name: 'Yazar' }));

    await user.click(screen.getByRole('button', { name: /import 1 items/i }));
    expect(bulkAddItems).toHaveBeenCalledWith([
      expect.objectContaining({
        title: 'Dune',
        customFields: expect.objectContaining({ author: 'Frank Herbert' }),
        purchaseInfo: expect.objectContaining({ purchasePrice: 1250.5 }),
      }),
    ]);
  });

  it('shows "Not detected" when no title column matches', async () => {
    const user = userEvent.setup();
    mockFileReader('foo,bar\n1,2');
    const view = render(<ImportExportPanel activeTab="import" onTabChange={vi.fn()} />);
    await user.upload(view.container.querySelector('input[accept=".csv"]') as HTMLInputElement, new File([''], 'x.csv'));
    await user.click(screen.getByRole('combobox', { name: /assign to category/i }));
    await user.click(await screen.findByRole('option', { name: 'Books' }));
    expect(screen.getByText('Not detected')).toBeInTheDocument();
  });

  it('reports a translated error when a restore fails', async () => {
    const user = userEvent.setup();
    const seed = buildSeedData();
    const restoreBackupBundle = vi.fn(async () => {
      throw new Error('Network down');
    });
    useCollectionStore.setState({ restoreBackupBundle });
    mockFileReader(JSON.stringify({ schemaVersion: 1, exportedAt: '2024-03-01T00:00:00.000Z', ...seed }));

    const view = render(<ImportExportPanel activeTab="import" onTabChange={vi.fn()} />);
    await user.upload(view.container.querySelector('input[accept=".json"]') as HTMLInputElement, new File(['{}'], 'b.json'));
    await user.click(await screen.findByRole('button', { name: /^merge backup$/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^merge backup$/i }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith('Restore failed', { description: 'Network down' });
    });
    expect(screen.getByRole('button', { name: /^merge backup$/i })).not.toBeDisabled();
  });

  it('exports CSV with the chosen separator and opens the tag manager', async () => {
    const user = userEvent.setup();
    const exportSpy = vi.spyOn((await import('@/services/exportService')).exportService, 'exportToCSV').mockImplementation(() => undefined);
    render(<ImportExportPanel activeTab="export" onTabChange={vi.fn()} />);

    await user.click(screen.getByRole('combobox', { name: /csv separator/i }));
    await user.click(await screen.findByRole('option', { name: /semicolon/i }));
    await user.click(screen.getAllByRole('button', { name: /export as csv/i })[0]);
    expect(exportSpy).toHaveBeenCalledWith(expect.any(Array), expect.any(Array), undefined, { delimiter: ';' });

    expect(screen.getByRole('link', { name: /open report/i })).toHaveAttribute('href', '/admin/print-labels?mode=report&from=settings');

    await user.click(screen.getByRole('button', { name: /manage tags/i }));
    expect(await screen.findByRole('dialog', { name: /manage tags/i })).toBeInTheDocument();
    exportSpy.mockRestore();
  });
});
