import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";

import {
  DARK_PREVIEW_COLOR_PRESET,
  LIGHT_PREVIEW_COLOR_PRESET,
} from "@/lib/preview-theme";
import {
  flushMicrotasks,
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

let resolvedTheme: string | undefined = "dark";

mock.module("next-themes", () => ({
  useTheme: () => ({ resolvedTheme }),
}));

installHappyDom();

const { act, cleanup, renderHook } = await import("@testing-library/react");
const { usePreviewColorPreset } = await import("@/hooks/usePreviewColorPreset");

beforeEach(() => {
  resetHappyDom();
  resolvedTheme = "dark";
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  mock.restore();
  restoreHappyDom();
});

describe("usePreviewColorPreset", () => {
  it("resolves the active preview preset after mount and updates when the theme changes", async () => {
    const { result, rerender } = renderHook(() => usePreviewColorPreset());

    await act(async () => {
      await flushMicrotasks();
    });

    expect(result.current).toBe(DARK_PREVIEW_COLOR_PRESET);

    resolvedTheme = "light";
    rerender();

    expect(result.current).toBe(LIGHT_PREVIEW_COLOR_PRESET);
  });
});
