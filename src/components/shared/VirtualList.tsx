/* eslint-disable react-hooks/incompatible-library, react-refresh/only-export-components */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { cn } from '@/lib/utils';

const DEFAULT_THRESHOLD = 80;
const DEFAULT_VIEWPORT_HEIGHT = 'min(72vh, 760px)';
const DEFAULT_INITIAL_WIDTH = 1024;
const DEFAULT_INITIAL_HEIGHT = 640;

type FallbackVirtualItem = {
  index: number;
  key: number;
  start: number;
};

interface VirtualBaseProps<T> {
  items: T[];
  threshold?: number;
  getItemKey: (item: T, index: number) => string;
  className?: string;
}

export interface VirtualListProps<T> extends VirtualBaseProps<T> {
  estimateSize: number | ((item: T, index: number) => number);
  renderItem: (item: T, index: number) => ReactNode;
  viewportHeight?: CSSProperties['height'];
  overscan?: number;
  itemClassName?: string;
}

function resolveEstimate<T>(
  estimateSize: number | ((item: T, index: number) => number),
  item: T,
  index: number,
) {
  return typeof estimateSize === 'function' ? estimateSize(item, index) : estimateSize;
}

function buildFallbackWindow(
  count: number,
  estimateSize: (index: number) => number,
  overscan: number,
): FallbackVirtualItem[] {
  const fallbackItems: FallbackVirtualItem[] = [];
  let offset = 0;
  let visibleHeight = 0;
  const targetHeight = DEFAULT_INITIAL_HEIGHT + (overscan * Math.max(1, estimateSize(0)));

  for (let index = 0; index < count && visibleHeight < targetHeight; index += 1) {
    const size = Math.max(1, estimateSize(index));
    fallbackItems.push({ index, key: index, start: offset });
    offset += size;
    visibleHeight += size;
  }

  return fallbackItems;
}

export function VirtualList<T>({
  items,
  threshold = DEFAULT_THRESHOLD,
  getItemKey,
  estimateSize,
  renderItem,
  className,
  viewportHeight = DEFAULT_VIEWPORT_HEIGHT,
  overscan = 8,
  itemClassName,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const setParentRef = useCallback((node: HTMLDivElement | null) => {
    parentRef.current = node;
    setScrollElement(node);
  }, []);
  const shouldVirtualize = items.length > threshold;
  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? items.length : 0,
    getScrollElement: () => scrollElement,
    estimateSize: (index) => (
      resolveEstimate(estimateSize, items[index], index)
    ),
    overscan,
    initialRect: { width: DEFAULT_INITIAL_WIDTH, height: DEFAULT_INITIAL_HEIGHT },
  });

  if (!shouldVirtualize) {
    return (
      <div className={className}>
        {items.map((item, index) => (
          <div key={getItemKey(item, index)} className={itemClassName}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  const measuredVirtualItems = virtualizer.getVirtualItems();
  const useFallbackWindow = measuredVirtualItems.length === 0;
  const virtualItems = useFallbackWindow
    ? buildFallbackWindow(
      items.length,
      (index) => resolveEstimate(estimateSize, items[index], index),
      overscan,
    )
    : measuredVirtualItems;

  return (
    <div
      ref={setParentRef}
      className={cn('overflow-auto scrollbar-thin', className)}
      style={{ height: viewportHeight, contain: 'strict' }}
      data-virtualized="true"
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={getItemKey(item, virtualRow.index)}
              ref={useFallbackWindow ? undefined : virtualizer.measureElement}
              data-index={virtualRow.index}
              className={cn('absolute left-0 top-0 w-full', itemClassName)}
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function useResponsiveColumnCount(
  containerRef: React.RefObject<HTMLElement | null>,
  minColumnWidth: number,
  initialWidth = DEFAULT_INITIAL_WIDTH,
) {
  const [width, setWidth] = useState(initialWidth);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const readWidth = () => {
      const measured = node.clientWidth || node.getBoundingClientRect().width;
      if (measured > 0) setWidth(measured);
    };

    readWidth();
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width;
      if (nextWidth && nextWidth > 0) setWidth(nextWidth);
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, [containerRef]);

  return Math.max(1, Math.floor(width / minColumnWidth));
}

export interface VirtualGridProps<T> extends VirtualBaseProps<T> {
  minColumnWidth: number;
  estimateRowHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  viewportHeight?: CSSProperties['height'];
  overscan?: number;
  gapClassName?: string;
  itemClassName?: string;
}

export function VirtualGrid<T>({
  items,
  threshold = DEFAULT_THRESHOLD,
  getItemKey,
  minColumnWidth,
  estimateRowHeight,
  renderItem,
  className,
  viewportHeight = DEFAULT_VIEWPORT_HEIGHT,
  overscan = 4,
  gapClassName = 'gap-4',
  itemClassName,
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const setParentRef = useCallback((node: HTMLDivElement | null) => {
    parentRef.current = node;
    setScrollElement(node);
  }, []);
  const shouldVirtualize = items.length > threshold;
  const columnCount = useResponsiveColumnCount(parentRef, minColumnWidth);
  const rows = useMemo(() => {
    const nextRows: T[][] = [];
    for (let index = 0; index < items.length; index += columnCount) {
      nextRows.push(items.slice(index, index + columnCount));
    }
    return nextRows;
  }, [items, columnCount]);

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? rows.length : 0,
    getScrollElement: () => scrollElement,
    estimateSize: () => estimateRowHeight,
    overscan,
    initialRect: { width: DEFAULT_INITIAL_WIDTH, height: DEFAULT_INITIAL_HEIGHT },
  });

  if (!shouldVirtualize) {
    return (
      <div
        className={cn('grid', className)}
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minColumnWidth}px), 1fr))` }}
      >
        {items.map((item, index) => (
          <div key={getItemKey(item, index)} className={itemClassName}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  const measuredVirtualRows = rowVirtualizer.getVirtualItems();
  const useFallbackWindow = measuredVirtualRows.length === 0;
  const virtualRows = useFallbackWindow
    ? buildFallbackWindow(rows.length, () => estimateRowHeight, overscan)
    : measuredVirtualRows;

  return (
    <div
      ref={setParentRef}
      className={cn('overflow-auto scrollbar-thin', className)}
      style={{ height: viewportHeight, contain: 'strict' }}
      data-virtualized="true"
    >
      <div
        className="relative w-full"
        style={{ height: rowVirtualizer.getTotalSize() }}
      >
        {virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index] ?? [];
          return (
            <div
              key={virtualRow.key}
              ref={useFallbackWindow ? undefined : rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              className={cn('absolute left-0 top-0 grid w-full', gapClassName)}
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              }}
            >
              {row.map((item, rowOffset) => {
                const itemIndex = virtualRow.index * columnCount + rowOffset;
                return (
                  <div key={getItemKey(item, itemIndex)} className={itemClassName}>
                    {renderItem(item, itemIndex)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
