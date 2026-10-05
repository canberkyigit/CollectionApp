import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import Settings from '@/pages/Settings';
import { getIntegrationKey, setIntegrationKey } from '@/lib/integrationKeys';
import { renderRoute, seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useCollectionStore } from '@/store/useCollectionStore';

describe('Settings', () => {
  beforeEach(() => {
    seedCollectionStore(buildSeedData());
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'viewer' });
    useCollectionStore.getState().setCompactMode(false);
    setIntegrationKey('discogs', '');
  });

  it('toggles compact mode on the document and labels every control', async () => {
    const user = userEvent.setup();
    renderRoute({ path: '/settings', initialEntry: '/settings?section=appearance', ui: <Settings /> });

    const compact = screen.getByRole('switch', { name: 'Compact mode' });
    await user.click(compact);
    expect(useCollectionStore.getState().compactMode).toBe(true);
    expect(document.documentElement.classList.contains('compact')).toBe(true);

    expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Sidebar collections' })).toBeInTheDocument();
  });

  it('hides the admin section from non-admins even when requested', () => {
    renderRoute({ path: '/settings', initialEntry: '/settings?section=admin', ui: <Settings /> });
    expect(screen.queryByRole('tab', { name: /^admin$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Appearance' })).toHaveAttribute('data-state', 'active');
  });

  it('relabels the reminders toggle', () => {
    renderRoute({ path: '/settings', initialEntry: '/settings?section=notifications', ui: <Settings /> });
    expect(screen.getByRole('switch', { name: 'Loan & maintenance reminders' })).toBeInTheDocument();
  });

  it('stores integration keys on this device with show/hide', async () => {
    const user = userEvent.setup();
    renderRoute({ path: '/settings', initialEntry: '/settings?section=integrations', ui: <Settings /> });

    const input = screen.getByLabelText('Discogs personal token');
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show Discogs personal token' }));
    expect(input).toHaveAttribute('type', 'text');

    await user.type(input, 'tok-123');
    const discogsRow = input.closest('div.space-y-3') as HTMLElement;
    const saveButton = Array.from(discogsRow.querySelectorAll('button')).find((button) => button.textContent === 'Save');
    expect(saveButton).toBeDefined();
    await user.click(saveButton as HTMLButtonElement);
    expect(getIntegrationKey('discogs')).toBe('tok-123');
  });
});
