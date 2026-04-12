import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

import { allowConsoleWarningsAndErrors } from "@/tests/unit/__setup__";
import {
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

const clipboard = {
  writeText: mock(async () => {}),
};

installHappyDom();

const { act, cleanup, renderHook } = await import("@testing-library/react");
const { useCopyFeedback } = await import("@/hooks/useCopyFeedback");

beforeEach(() => {
  vi.useFakeTimers();
  resetHappyDom();
  clipboard.writeText.mockReset();
  clipboard.writeText.mockResolvedValue(undefined);

  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    value: clipboard,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

afterAll(() => {
  restoreHappyDom();
});

describe("useCopyFeedback", () => {
  it("copies absolute preview URLs, formats AniList output, and clears the copied state after the timeout", async () => {
    const { result } = renderHook(() =>
      useCopyFeedback("/api/card?card=animeStats"),
    );

    expect(result.current.copiedFormat).toBeNull();
    expect(result.current.error).toBeNull();

    await act(async () => {
      await result.current.handleCopy("anilist");
    });

    expect(clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(clipboard.writeText).toHaveBeenCalledWith(
      "img200(https://anicards.test/api/card?card=animeStats)",
    );
    expect(result.current.copiedFormat).toBe("anilist");
    expect(result.current.error).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1_999);
    });

    expect(result.current.copiedFormat).toBe("anilist");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.copiedFormat).toBeNull();
  });

  it("surfaces clipboard failures without leaving stale success state behind", async () => {
    const { consoleError } = allowConsoleWarningsAndErrors();
    const copyError = new Error("clipboard blocked");

    const { result } = renderHook(() =>
      useCopyFeedback("/api/card?card=animeStats"),
    );

    await act(async () => {
      await result.current.handleCopy();
    });

    expect(result.current.copiedFormat).toBe("url");
    expect(result.current.error).toBeNull();

    clipboard.writeText.mockRejectedValueOnce(copyError);

    await act(async () => {
      await result.current.handleCopy();
    });

    expect(clipboard.writeText).toHaveBeenNthCalledWith(
      2,
      "https://anicards.test/api/card?card=animeStats",
    );
    expect(result.current.copiedFormat).toBeNull();
    expect(result.current.error).toBe("Failed to copy to clipboard");
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to copy to clipboard:",
      copyError,
    );
  });
});
