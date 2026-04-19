"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  type Key,
  type ReactNode,
  type RefObject,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useCspNonce } from "@/components/CspNonceContext";
import { cn } from "@/lib/utils";

function formatCssPixelValue(value: number): string {
  const roundedValue = Math.round(value * 100) / 100;
  return Number.isInteger(roundedValue)
    ? `${roundedValue}px`
    : `${roundedValue.toFixed(2)}px`;
}

function buildVirtualizedGridStyleText(args: {
  scopeId: string;
  totalSize: number;
  virtualRows: ReadonlyArray<{ index: number; start: number }>;
  scrollMargin: number;
}): string {
  const innerRule = `[data-virtual-grid="${args.scopeId}"] [data-virtual-grid-inner="true"] { height: ${formatCssPixelValue(args.totalSize)}; }`;
  const rowRules = args.virtualRows
    .map(
      (virtualRow) =>
        `[data-virtual-grid="${args.scopeId}"] [data-virtual-grid-row="${virtualRow.index}"] { transform: translateY(${formatCssPixelValue(virtualRow.start - args.scrollMargin)}); }`,
    )
    .join("\n");

  return `${innerRule}${rowRules ? `\n${rowRules}` : ""}`;
}

function getBreakpointColumnCount(containerWidth: number): number {
  // Mirrors the existing Tailwind grid behavior used in CardCategorySection:
  // - base: 1 column
  // - sm (>= 640px): 2 columns
  // - xl (>= 1280px): 3 columns
  if (containerWidth >= 1280) return 3;
  if (containerWidth >= 640) return 2;
  return 1;
}

function useElementWidth<T extends HTMLElement>(
  ref: RefObject<T | null>,
): number {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      setWidth(el.getBoundingClientRect().width);
    };

    update();

    const observer = new ResizeObserver(update);

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

export interface VirtualizedCardGridProps<TItem> {
  items: readonly TItem[];
  renderItem: (item: TItem, index: number) => ReactNode;
  getItemKey?: (item: TItem, index: number) => Key;

  /** Estimated height for a *row* (not a single item). This is used until measurement kicks in. */
  estimateRowHeight?: number;

  /** How many extra rows to render above/below the viewport. */
  overscan?: number;

  /** Extra dependencies that should trigger re-measuring the grid's top offset. */
  scrollMarginKey?: string | number;

  className?: string;
}

/**
 * A window-virtualized responsive grid. Only the visible rows are mounted.
 *
 * Notes:
 * - Uses dynamic measurement of row height via `measureElement`.
 * - Uses container width to match Tailwind breakpoints (1/2/3 columns).
 */
export function VirtualizedCardGrid<TItem>({
  items,
  renderItem,
  getItemKey,
  estimateRowHeight = 420,
  overscan = 4,
  scrollMarginKey,
  className,
}: Readonly<VirtualizedCardGridProps<TItem>>) {
  const nonce = useCspNonce();
  const containerRef = useRef<HTMLDivElement>(null);
  const styleScopeId = useId().replaceAll(":", "");
  const containerWidth = useElementWidth(containerRef);

  const columnCount = useMemo(
    () => getBreakpointColumnCount(containerWidth),
    [containerWidth],
  );

  const rowCount = useMemo(
    () => Math.ceil(items.length / Math.max(1, columnCount)),
    [items.length, columnCount],
  );

  const [scrollMargin, setScrollMargin] = useState(0);

  const recomputeScrollMargin = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setScrollMargin(rect.top + window.scrollY);
  }, []);

  useLayoutEffect(() => {
    recomputeScrollMargin();

    window.addEventListener("resize", recomputeScrollMargin);
    return () => window.removeEventListener("resize", recomputeScrollMargin);
  }, [recomputeScrollMargin, items.length, columnCount, scrollMarginKey]);
  const estimateSize = useCallback(
    () => estimateRowHeight,
    [estimateRowHeight],
  );
  const measureElement = useCallback(
    (el: Element) => el.getBoundingClientRect().height,
    [],
  );

  const rowVirtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize,
    overscan,
    scrollMargin,
    // Row measurement: allows variable-height tiles.
    measureElement,
  });

  useLayoutEffect(() => {
    // Column count changes effectively change row composition.
    // Force a re-measure to avoid scroll jumps.
    rowVirtualizer.measure();
  }, [columnCount]);
  const keyFn = getItemKey;
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const dynamicGridStyles = useMemo(
    () =>
      buildVirtualizedGridStyleText({
        scopeId: styleScopeId,
        totalSize,
        virtualRows,
        scrollMargin,
      }),
    [scrollMargin, styleScopeId, totalSize, virtualRows],
  );

  return (
    <div
      ref={containerRef}
      data-virtual-grid={styleScopeId}
      className={cn("w-full", className)}
    >
      <style nonce={nonce}>{dynamicGridStyles}</style>
      <div data-virtual-grid-inner="true" className="relative w-full">
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const endIndex = Math.min(startIndex + columnCount, items.length);

          return (
            <div
              key={virtualRow.key}
              data-virtual-grid-row={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className="
                absolute top-0 left-0 grid w-full grid-cols-1 gap-4
                sm:grid-cols-2
                xl:grid-cols-3
              "
            >
              {items.slice(startIndex, endIndex).map((item, localIndex) => {
                const index = startIndex + localIndex;
                const key = keyFn ? keyFn(item, index) : index;
                return (
                  <div key={key} className="min-w-0">
                    {renderItem(item, index)}
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
