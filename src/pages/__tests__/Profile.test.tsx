import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Profile from '../Profile';
import { renderWithRouter, resetAuthStore, seedAuthStore } from '@/test/render';
import { useAuthStore } from '@/store/useAuthStore';

describe('Profile', () => {
  beforeEach(() => {
    resetAuthStore();
  });

  it('saves a changed display name', async () => {
    const user = userEvent.setup();
    const updateUserProfile = vi.fn(async () => undefined);
    seedAuthStore({ displayName: 'Old Name' });
    useAuthStore.setState({ updateUserProfile });

    renderWithRouter(<Profile />);

    const nameInput = screen.getByLabelText('Display name');
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(updateUserProfile).toHaveBeenCalledWith('New Name');
  });

  it('blocks mismatched passwords before calling changePassword', async () => {
    const user = userEvent.setup();
    const changePassword = vi.fn(async () => undefined);
    seedAuthStore();
    useAuthStore.setState({ changePassword });

    renderWithRouter(<Profile />);

    await user.type(screen.getByLabelText('New password'), 'secret1');
    await user.type(screen.getByLabelText('Confirm password'), 'secret2');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(changePassword).not.toHaveBeenCalled();
  });

  it('shows offline banner when firebase is unavailable', () => {
    seedAuthStore();
    useAuthStore.setState({ firebaseReady: false });

    renderWithRouter(<Profile />);

    expect(screen.getByText(/offline mode/i)).toBeInTheDocument();
  });
});
