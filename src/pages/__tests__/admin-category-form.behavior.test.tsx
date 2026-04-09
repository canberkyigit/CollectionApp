import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import AdminCategoryForm from '@/pages/AdminCategoryForm';
import { seedAuthStore, seedCollectionStore } from '@/test/render';
import { buildSeedData } from '@/test/seed';
import { useCollectionStore } from '@/store/useCollectionStore';

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
}));

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return {
    ...actual,
    toast: {
      success: mocks.toastSuccess,
    },
  };
});

describe('AdminCategoryForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedCollectionStore(buildSeedData());
    seedAuthStore({ uid: 'contrib-1', displayName: 'Ada Curator', role: 'admin' });
  });

  it('creates a category with generated slug and configurable custom fields', async () => {
    const user = userEvent.setup();
    const addCategory = vi.fn();
    useCollectionStore.setState({ addCategory });

    render(
      <MemoryRouter initialEntries={['/admin/categories/new?from=settings']}>
        <Routes>
          <Route path="/admin/categories/new" element={<AdminCategoryForm />} />
          <Route path="/admin/categories" element={<div>Categories Landing</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/name/i), 'Board Games');
    expect(screen.getByLabelText(/slug/i)).toHaveValue('board-games');
    await user.type(screen.getByLabelText(/description/i), 'Tabletop collection category');

    await user.click(screen.getByRole('button', { name: /add field/i }));
    await user.type(screen.getByPlaceholderText(/field label/i), 'Player Count');
    expect(screen.getByPlaceholderText(/field_key/i)).toHaveValue('player_count');
    await user.type(screen.getByPlaceholderText(/enter placeholder text/i), '2-6');

    const fieldTypeCombobox = screen.getAllByRole('combobox').at(-1);
    expect(fieldTypeCombobox).toBeDefined();
    await user.click(fieldTypeCombobox as HTMLElement);
    await user.click(await screen.findByRole('option', { name: 'Select' }));
    fireEvent.change(screen.getByPlaceholderText(/option 1, option 2, option 3/i), {
      target: { value: '2 players, 4 players' },
    });

    await user.click(screen.getByRole('button', { name: /save category/i }));

    await waitFor(() => {
      expect(addCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Board Games',
          slug: 'board-games',
          description: 'Tabletop collection category',
          fields: [
            expect.objectContaining({
              label: 'Player Count',
              key: 'player_count',
              type: 'select',
              options: ['2 players', '4 players'],
            }),
          ],
        }),
      );
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Category created successfully');
    expect(screen.getByText('Categories Landing')).toBeInTheDocument();
  });

  it('shows the missing-category fallback and returns to the categories list', async () => {
    const user = userEvent.setup();
    useCollectionStore.setState({
      getCategoryById: vi.fn(() => undefined),
    });

    render(
      <MemoryRouter initialEntries={['/admin/categories/missing/edit?from=settings']}>
        <Routes>
          <Route path="/admin/categories/:categoryId/edit" element={<AdminCategoryForm />} />
          <Route path="/admin/categories" element={<div>Categories Landing</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/the category you're trying to edit doesn't exist/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /back to categories/i }));
    expect(screen.getByText('Categories Landing')).toBeInTheDocument();
  });
});
