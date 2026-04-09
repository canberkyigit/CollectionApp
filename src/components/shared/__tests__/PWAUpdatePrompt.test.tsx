import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  needRefresh: true,
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn(),
  isDesktopApp: vi.fn(() => false),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [mocks.needRefresh, mocks.setNeedRefresh] as const,
    updateServiceWorker: mocks.updateServiceWorker,
  }),
}));

vi.mock('@/lib/runtime', () => ({
  isDesktopApp: mocks.isDesktopApp,
}));

import { PWAUpdatePrompt } from '@/components/shared/PWAUpdatePrompt';

describe('PWAUpdatePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.needRefresh = true;
    mocks.isDesktopApp.mockReturnValue(false);
  });

  it('shows the update banner in the browser and supports update or dismiss actions', async () => {
    const user = userEvent.setup();
    render(<PWAUpdatePrompt />);

    expect(screen.getByText(/update available/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^update$/i }));
    expect(mocks.updateServiceWorker).toHaveBeenCalledWith(true);

    await user.click(screen.getAllByRole('button')[1]);
    expect(mocks.setNeedRefresh).toHaveBeenCalledWith(false);
  });

  it('renders nothing inside the desktop shell', () => {
    mocks.isDesktopApp.mockReturnValue(true);
    render(<PWAUpdatePrompt />);
    expect(screen.queryByText(/update available/i)).not.toBeInTheDocument();
  });
});
