import "@/tests/unit/__setup__";

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";

import {
  getImageLoadState,
  ImageWithSkeleton,
  isImageReady,
  SLOW_LOAD_THRESHOLD_MS,
} from "@/components/ImageWithSkeleton";
import {
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

installHappyDom();

const { cleanup, fireEvent, render } = await import("@testing-library/react");

function restorePrototypeProperty(
  target: object,
  property: string,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor);
    return;
  }

  Reflect.deleteProperty(target, property);
}

beforeEach(() => {
  resetHappyDom();
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  restoreHappyDom();
});

describe("ImageWithSkeleton", () => {
  it("uses the documented slow-load threshold for delayed skeleton fallbacks", () => {
    expect(SLOW_LOAD_THRESHOLD_MS).toBe(2000);
  });

  it("keeps the image in loading or slow states until a real loaded state is reached", () => {
    expect(
      getImageLoadState({
        isLoaded: false,
        isSlowLoading: false,
        hasError: false,
      }),
    ).toBe("loading");

    expect(
      getImageLoadState({
        isLoaded: false,
        isSlowLoading: true,
        hasError: false,
      }),
    ).toBe("slow");

    expect(
      getImageLoadState({
        isLoaded: true,
        isSlowLoading: true,
        hasError: false,
      }),
    ).toBe("loaded");
  });

  it("preserves the error fallback instead of pretending failed images loaded", () => {
    expect(
      getImageLoadState({
        isLoaded: true,
        isSlowLoading: true,
        hasError: true,
      }),
    ).toBe("error");

    const readyImage = {
      complete: true,
      naturalWidth: 320,
    } as HTMLImageElement;
    const emptyImage = {
      complete: true,
      naturalWidth: 0,
    } as HTMLImageElement;
    const incompleteImage = {
      complete: false,
      naturalWidth: 320,
    } as HTMLImageElement;

    expect(isImageReady(readyImage)).toBe(true);
    expect(isImageReady(emptyImage)).toBe(false);
    expect(isImageReady(incompleteImage)).toBe(false);
    expect(isImageReady(null)).toBe(false);
  });

  it("uses known intrinsic dimensions to reserve space and forward native loading hints", () => {
    const { container } = render(
      <ImageWithSkeleton
        src="/preview.svg"
        alt="Preview card"
        className="h-auto w-full"
        width={450}
        height={195}
        loading="eager"
        fetchPriority="high"
      />,
    );

    const wrapper = container.querySelector<HTMLElement>("[data-image-state]");
    const image = container.querySelector("img");

    if (!(image instanceof HTMLElement) || image.tagName !== "IMG") {
      throw new Error("Expected ImageWithSkeleton to render an image element.");
    }

    expect(wrapper?.dataset.imageState).toBe("loading");
    expect(wrapper?.getAttribute("aria-busy")).toBe("true");
    expect(wrapper?.getAttribute("style")).toContain("aspect-ratio");
    expect(image.getAttribute("width")).toBe("450");
    expect(image.getAttribute("height")).toBe("195");
    expect(image.getAttribute("loading")).toBe("eager");
    expect(image.getAttribute("fetchpriority")).toBe("high");
  });

  it("switches visibility when the native image lifecycle reports a load", () => {
    const { container } = render(
      <ImageWithSkeleton
        src="/preview.svg"
        alt="Preview card"
        className="h-auto w-full"
        width={450}
        height={195}
      />,
    );

    const wrapper = container.querySelector("[data-image-state]");
    const image = container.querySelector("img");

    if (!(wrapper instanceof HTMLElement) || wrapper.tagName !== "DIV") {
      throw new Error(
        "Expected ImageWithSkeleton to render a wrapper element.",
      );
    }

    if (!(image instanceof HTMLElement) || image.tagName !== "IMG") {
      throw new Error("Expected ImageWithSkeleton to render an image element.");
    }

    fireEvent.load(image);

    expect(wrapper.dataset.imageState).toBe("loaded");
    expect(image.className).toMatch(/opacity-100/);
    expect(wrapper.querySelector(".animate-pulse")).toBeNull();
  });

  it("treats cached images as loaded without waiting for a delayed settle", () => {
    const imagePrototype = Object.getPrototypeOf(
      globalThis.document.createElement("img"),
    );
    const completeDescriptor = Object.getOwnPropertyDescriptor(
      imagePrototype,
      "complete",
    );
    const naturalWidthDescriptor = Object.getOwnPropertyDescriptor(
      imagePrototype,
      "naturalWidth",
    );

    Object.defineProperty(imagePrototype, "complete", {
      configurable: true,
      get() {
        return this.getAttribute("src") === "/cached-preview.svg";
      },
    });

    Object.defineProperty(imagePrototype, "naturalWidth", {
      configurable: true,
      get() {
        return this.getAttribute("src") === "/cached-preview.svg" ? 450 : 0;
      },
    });

    try {
      const { container } = render(
        <ImageWithSkeleton
          src="/cached-preview.svg"
          alt="Cached preview card"
          className="h-auto w-full"
          width={450}
          height={195}
        />,
      );

      const wrapper =
        container.querySelector<HTMLElement>("[data-image-state]");
      const image = container.querySelector("img");

      if (!(image instanceof HTMLElement) || image.tagName !== "IMG") {
        throw new Error(
          "Expected cached ImageWithSkeleton to render an image element.",
        );
      }

      expect(wrapper?.dataset.imageState).toBe("loaded");
      expect(wrapper?.getAttribute("aria-busy")).toBe("false");
      expect(image.className).toMatch(/opacity-100/);
      expect(wrapper?.querySelector(".animate-pulse")).toBeNull();
    } finally {
      restorePrototypeProperty(imagePrototype, "complete", completeDescriptor);
      restorePrototypeProperty(
        imagePrototype,
        "naturalWidth",
        naturalWidthDescriptor,
      );
    }
  });
});
