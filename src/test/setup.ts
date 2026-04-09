import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  const React = await vi.importActual<typeof import('react')>('react');

  function ResponsiveContainer({
    children,
    width = '100%',
    height = '100%',
  }: {
    children: import('react').ReactNode;
    width?: number | string;
    height?: number | string;
  }) {
    const resolvedWidth = typeof width === 'number' ? width : 800;
    const resolvedHeight = typeof height === 'number' ? height : 320;

    return React.createElement(
      'div',
      { style: { width: resolvedWidth, height: resolvedHeight } },
      React.Children.map(children, (child) => (
        React.isValidElement(child)
          ? React.cloneElement(
              child as import('react').ReactElement<{ width?: number; height?: number }>,
              {
                width: resolvedWidth,
                height: resolvedHeight,
              },
            )
          : child
      )),
    );
  }

  return {
    ...actual,
    ResponsiveContainer,
  };
});

afterEach(() => {
  cleanup();
});

// Mock matchMedia for components that use it
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});

// Mock scrollTo
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
Element.prototype.scrollIntoView = vi.fn();

// Pointer capture helpers used by Radix primitives in jsdom
Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

// Mock canvas for image compression tests
const mockCanvasContext = {
  drawImage: vi.fn(),
  toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,mock'),
};

HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(
  mockCanvasContext as unknown as RenderingContext,
);
HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,mock');
