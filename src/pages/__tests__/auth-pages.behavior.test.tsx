import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import Login from '@/pages/Login';
import Profile from '@/pages/Profile';
import { resetAuthStore, seedAuthStore } from '@/test/render';
import { useAuthStore } from '@/store/useAuthStore';

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  uploadImage: vi.fn(),
}));

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return {
    ...actual,
    toast: {
      error: mocks.toastError,
      success: mocks.toastSuccess,
    },
  };
});

vi.mock('@/services/storageService', () => ({
  storageService: {
    uploadImage: mocks.uploadImage,
  },
}));

describe('auth page behaviors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStore();
  });

  it('supports register, Google login, and offline login flows from the login page', async () => {
    const user = userEvent.setup();
    const loginWithEmail = vi.fn(async () => undefined);
    const registerWithEmail = vi.fn(async () => undefined);
    const loginWithGoogle = vi.fn(async () => undefined);
    const loginOffline = vi.fn();
    const clearError = vi.fn();

    useAuthStore.setState({
      firebaseReady: true,
      loginWithEmail,
      registerWithEmail,
      loginWithGoogle,
      loginOffline,
      clearError,
    });

    let view = render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/collections" element={<div>Collections Landing</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /create one/i }));
    await user.type(screen.getByLabelText(/display name/i), 'Ada Collector');
    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(registerWithEmail).toHaveBeenCalledWith('ada@example.com', 'secret123', 'Ada Collector');
    });
    expect(screen.getByText('Collections Landing')).toBeInTheDocument();

    view.unmount();
    view = render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/collections" element={<div>Collections Landing</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /continue with google/i }));
    await waitFor(() => {
      expect(loginWithGoogle).toHaveBeenCalled();
    });

    useAuthStore.setState({
      firebaseReady: false,
      loginOffline,
    });
    view.unmount();
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/collections" element={<div>Collections Landing</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/offline mode/i)).toBeInTheDocument();
    // No fake credential fields or register toggle when Firebase is not configured.
    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create one/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue offline/i }));
    expect(loginOffline).toHaveBeenCalled();
    expect(screen.getByText('Collections Landing')).toBeInTheDocument();
  });

  it('handles avatar validation and recent-login password errors on the profile page', async () => {
    const user = userEvent.setup();
    const updateUserProfile = vi.fn(async () => undefined);
    const changePassword = vi.fn(async () => {
      throw { code: 'auth/requires-recent-login' };
    });

    seedAuthStore({
      uid: 'user-1',
      displayName: 'Ada Curator',
      email: 'ada@example.com',
    });
    useAuthStore.setState({
      firebaseReady: true,
      updateUserProfile,
      changePassword,
    });

    const { container } = render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput, {
      target: {
        files: [new File(['hello'], 'note.txt', { type: 'text/plain' })],
      },
    });
    expect(mocks.toastError).toHaveBeenCalledWith('Please select an image file');

    const largeFile = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' });
    fireEvent.change(fileInput, {
      target: {
        files: [largeFile],
      },
    });
    expect(mocks.toastError).toHaveBeenCalledWith('Image must be under 5MB');

    await user.type(screen.getByLabelText(/new password/i), 'secret1');
    await user.type(screen.getByLabelText(/confirm password/i), 'secret1');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith('secret1');
    });
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Please log out and log back in before changing your password',
    );
  });
});
