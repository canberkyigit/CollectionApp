import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollectVaultUpdaterApi, UpdaterVersionInfo } from '@/lib/runtime';

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}));

vi.mock('@/lib/runtime', () => ({
  isDesktopApp: () => true,
}));

import { DesktopUpdatePrompt } from '@/components/shared/DesktopUpdatePrompt';

function createUpdater() {
  const listeners: { available?: (info: UpdaterVersionInfo) => void } = {};
  const updater: CollectVaultUpdaterApi = {
    onAvailable: (cb) => { listeners.available = cb; },
    onProgress: vi.fn(),
    onDownloaded: vi.fn(),
    onNotAvailable: vi.fn(),
    onError: vi.fn(),
    onInstallFailed: vi.fn(),
    removeListeners: vi.fn(),
    startDownload: vi.fn(async () => { throw new Error('network down'); }),
    install: vi.fn(async () => undefined),
    dismiss: vi.fn(async () => undefined),
  };
  return { updater, listeners };
}

describe('DesktopUpdatePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete window.collectVaultDesktop;
  });

  it('is an accessible dialog and recovers when the download fails', async () => {
    const user = userEvent.setup();
    const { updater, listeners } = createUpdater();
    window.collectVaultDesktop = { isDesktop: true, updater };

    render(<DesktopUpdatePrompt />);
    act(() => listeners.available?.({ version: '2.0.0' }));

    const dialog = screen.getByRole('dialog', { name: 'Version 2.0.0 is available' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    await user.click(screen.getByRole('button', { name: 'Download update' }));

    expect(updater.startDownload).toHaveBeenCalled();
    expect(await screen.findByRole('dialog', { name: 'Update failed' })).toBeInTheDocument();
    expect(screen.getByText('network down')).toBeInTheDocument();
    expect(mocks.toastError).toHaveBeenCalled();

    await user.click(screen.getAllByRole('button', { name: 'Close' })[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(updater.dismiss).toHaveBeenCalled();
  });
});
