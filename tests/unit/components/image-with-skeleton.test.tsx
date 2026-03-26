import "@/tests/unit/__setup__";

import { describe, expect, it } from "bun:test";

import {
  getImageLoadState,
  isImageReady,
  SLOW_LOAD_THRESHOLD_MS,
} from "@/components/ImageWithSkeleton";

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
});
