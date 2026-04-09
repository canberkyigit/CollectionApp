import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

describe('Sheet', () => {
  it('opens, closes, and resizes from the drag handle', async () => {
    const user = userEvent.setup();

    render(
      <Sheet>
        <SheetTrigger asChild>
          <button type="button">Open Sheet</button>
        </SheetTrigger>
        <SheetContent defaultWidth={680}>
          <div>Sheet Body</div>
        </SheetContent>
      </Sheet>,
    );

    await user.click(screen.getByRole('button', { name: /open sheet/i }));
    expect(screen.getByText('Sheet Body')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: /close/i });
    const sheetContent = closeButton.closest('[style*="width"]') as HTMLElement;
    expect(sheetContent.style.width).toBe('680px');

    const resizeHandle = sheetContent.querySelector('div[class*="cursor-col-resize"]') as HTMLElement;
    fireEvent.mouseDown(resizeHandle, { clientX: 1000 });
    fireEvent.mouseMove(document, { clientX: 900 });
    fireEvent.mouseUp(document);

    expect(Number.parseInt(sheetContent.style.width, 10)).toBeGreaterThan(680);

    await user.click(closeButton);
    expect(screen.queryByText('Sheet Body')).not.toBeInTheDocument();
  });
});
