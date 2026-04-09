import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders destructive confirm flows and triggers both actions', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={onConfirm}
        title="Archive Item"
        description="Move this item to the archive."
        confirmLabel="Archive"
        destructive
      />,
    );

    expect(screen.getByText('Archive Item')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /archive/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('does not render content when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Hidden"
        description="Invisible"
      />,
    );

    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });
});
