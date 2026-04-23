import "@/tests/unit/__setup__";

import { act, cleanup, render, waitFor } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";

import {
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

let containerTop = 40;
let containerWidth = 320;
let currentScrollY = 100;
let totalSize = 900;
let virtualRowStarts = [140, 380, 620, 860, 1_100];
const resizeObserverCallbacks = new Set<() => void>();

class ResizeObserverStub {
  private readonly callback: () => void;

  constructor(...args: unknown[]) {
    const [callback] = args;

    if (typeof callback !== "function") {
      throw new TypeError("Expected a ResizeObserver callback.");
    }

    this.callback = callback as () => void;
  }

  disconnect() {
    resizeObserverCallbacks.delete(this.callback);
  }

  observe() {
    resizeObserverCallbacks.add(this.callback);
  }

  unobserve() {
    resizeObserverCallbacks.delete(this.callback);
  }
}

installHappyDom({
  includeResizeObserver: ResizeObserverStub,
  url: "https://anicards.test/user/Alpha49",
});

const virtualizerMeasure = mock(() => undefined);
const virtualizerMeasureElement = mock((element: Element | null) => element);
const capturedVirtualizerOptions: Array<Record<string, unknown>> = [];
const originalGetBoundingClientRect =
  globalThis.HTMLElement.prototype.getBoundingClientRect;

function createRect(
  width: number,
  height: number,
  top = containerTop,
): DOMRect {
  return {
    bottom: top + height,
    height,
    left: 0,
    right: width,
    toJSON: () => ({}),
    top,
    width,
    x: 0,
    y: top,
  } as DOMRect;
}

function triggerResizeObservers() {
  for (const callback of resizeObserverCallbacks) {
    callback();
  }
}

mock.module("@/components/CspNonceContext", () => ({
  useCspNonce: () => "nonce-123",
}));

mock.module("@tanstack/react-virtual", () => ({
  useWindowVirtualizer: (options: Record<string, unknown>) => {
    capturedVirtualizerOptions.push(options);

    return {
      getTotalSize: () => totalSize,
      getVirtualItems: () =>
        Array.from({ length: Number(options.count) }, (_, index) => ({
          index,
          key: `row-${index}`,
          start: virtualRowStarts[index] ?? index * 240,
        })),
      measure: virtualizerMeasure,
      measureElement: (element: Element | null) => {
        virtualizerMeasureElement(element);

        const measureElement = options.measureElement;
        if (typeof measureElement === "function" && element) {
          return measureElement(element);
        }

        return undefined;
      },
    };
  },
}));

let VirtualizedCardGrid: typeof import("@/components/user/VirtualizedCardGrid").VirtualizedCardGrid;

beforeAll(async () => {
  ({ VirtualizedCardGrid } =
    await import("@/components/user/VirtualizedCardGrid"));
});

beforeEach(() => {
  resetHappyDom({
    includeResizeObserver: ResizeObserverStub,
    url: "https://anicards.test/user/Alpha49",
  });
  capturedVirtualizerOptions.length = 0;
  resizeObserverCallbacks.clear();
  virtualizerMeasure.mockReset();
  virtualizerMeasureElement.mockReset();
  containerTop = 40;
  containerWidth = 320;
  currentScrollY = 100;
  totalSize = 900;
  virtualRowStarts = [140, 380, 620, 860, 1_100];

  Object.defineProperty(globalThis.window, "scrollY", {
    configurable: true,
    value: currentScrollY,
    writable: true,
  });
  Object.defineProperty(
    globalThis.HTMLElement.prototype,
    "getBoundingClientRect",
    {
      configurable: true,
      value: function getBoundingClientRect(this: HTMLElement) {
        if (this.dataset.virtualGrid !== undefined) {
          return createRect(containerWidth, totalSize, containerTop);
        }

        if (this.dataset.virtualGridInner === "true") {
          return createRect(containerWidth, totalSize, containerTop);
        }

        if (this.dataset.virtualGridRow !== undefined) {
          return createRect(containerWidth, 220, containerTop);
        }

        return createRect(containerWidth, 220, containerTop);
      },
    },
  );
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  Object.defineProperty(
    globalThis.HTMLElement.prototype,
    "getBoundingClientRect",
    {
      configurable: true,
      value: originalGetBoundingClientRect,
    },
  );
  mock.restore();
  restoreHappyDom();
});

describe("VirtualizedCardGrid", () => {
  it("renders one-column virtual rows with nonce-scoped dynamic styles", async () => {
    if (!VirtualizedCardGrid) {
      throw new TypeError("Expected VirtualizedCardGrid to be loaded.");
    }

    const view = render(
      <VirtualizedCardGrid
        items={["Alpha", "Beta", "Gamma"]}
        renderItem={(item, index) => (
          <span data-testid={`grid-item-${index}`}>{item}</span>
        )}
      />,
    );

    await waitFor(() => {
      const latestOptions = capturedVirtualizerOptions.at(-1);
      expect(latestOptions?.count).toBe(3);
      expect(latestOptions?.overscan).toBe(4);
      expect(latestOptions?.scrollMargin).toBe(140);
    });

    const style = view.container.querySelector("style");
    expect(style?.getAttribute("nonce")).toBe("nonce-123");
    expect(style?.textContent).toContain("height: 900px");
    expect(style?.textContent).toContain("translateY(0px)");
    expect(style?.textContent).toContain("translateY(240px)");
    expect(view.getByTestId("grid-item-0").textContent).toBe("Alpha");
    expect(view.getByTestId("grid-item-1").textContent).toBe("Beta");
    expect(view.getByTestId("grid-item-2").textContent).toBe("Gamma");
    expect(virtualizerMeasureElement).toHaveBeenCalled();

    const latestOptions = capturedVirtualizerOptions.at(-1);
    if (!latestOptions || typeof latestOptions.estimateSize !== "function") {
      throw new TypeError("Expected a virtualizer estimateSize callback.");
    }

    expect(latestOptions.estimateSize()).toBe(420);
  });

  it("recomputes row composition and keys when the container reaches the xl breakpoint", async () => {
    if (!VirtualizedCardGrid) {
      throw new TypeError("Expected VirtualizedCardGrid to be loaded.");
    }

    const getItemKey = mock(
      (item: string, index: number) => `${item}-${index}`,
    );
    const view = render(
      <VirtualizedCardGrid
        className="rounded-lg"
        getItemKey={getItemKey}
        items={["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]}
        renderItem={(item, index) => (
          <span data-testid={`wide-grid-item-${index}`}>{item}</span>
        )}
      />,
    );

    await waitFor(() => {
      expect(capturedVirtualizerOptions.at(-1)?.count).toBe(5);
    });

    virtualizerMeasure.mockClear();
    containerWidth = 1_360;
    totalSize = 640;
    virtualRowStarts = [140, 420];

    act(() => {
      triggerResizeObservers();
    });

    await waitFor(() => {
      expect(capturedVirtualizerOptions.at(-1)?.count).toBe(2);
      expect(virtualizerMeasure).toHaveBeenCalled();
    });

    const rowElements = view.container.querySelectorAll(
      "[data-virtual-grid-row]",
    );
    expect(rowElements).toHaveLength(2);
    expect(rowElements[0]?.textContent).toContain("AlphaBetaGamma");
    expect(rowElements[1]?.textContent).toContain("DeltaEpsilon");
    expect(view.container.firstElementChild?.className).toContain("rounded-lg");
    expect(getItemKey).toHaveBeenCalledWith("Alpha", 0);
    expect(getItemKey).toHaveBeenCalledWith("Epsilon", 4);
  });
});
