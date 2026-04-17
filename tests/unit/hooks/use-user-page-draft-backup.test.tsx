import "@/tests/unit/__setup__";

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

import type { LocalEditsPatch } from "@/lib/stores/user-page-editor";
import {
  createCardConfig,
  createMockUserPageEditorStore,
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

const realUserPageEditorModule = {
  ...(await import(
    new URL("../../../lib/stores/user-page-editor.ts", import.meta.url).href
  )),
} as typeof import("@/lib/stores/user-page-editor");

const editorStore = createMockUserPageEditorStore();

installHappyDom();

const { act, cleanup, renderHook } = await import("@testing-library/react");
const { readUserPageDraft, readUserPageExitSaveFallback } =
  await import("@/lib/user-page-editor-draft");

let recordUserPageExitSaveFallback: typeof import("@/hooks/useUserPageDraftBackup").recordUserPageExitSaveFallback;
let useUserPageDraftBackup: typeof import("@/hooks/useUserPageDraftBackup").useUserPageDraftBackup;

beforeEach(async () => {
  vi.useFakeTimers();
  resetHappyDom();
  mock.module("@/lib/stores/user-page-editor", () => editorStore.module);
  ({ recordUserPageExitSaveFallback, useUserPageDraftBackup } =
    await import("@/hooks/useUserPageDraftBackup"));
  editorStore.reset({
    isDirty: false,
    userId: "42",
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  mock.module("@/lib/stores/user-page-editor", () => realUserPageEditorModule);
});

afterAll(() => {
  mock.restore();
  restoreHappyDom();
});

describe("useUserPageDraftBackup", () => {
  it("writes only the latest dirty patch after the debounce window", () => {
    const firstPatch: LocalEditsPatch = {
      cardConfigs: {
        animeStats: createCardConfig("animeStats", {
          enabled: false,
        }),
      },
    };
    const secondPatch: LocalEditsPatch = {
      cardConfigs: {
        animeStats: createCardConfig("animeStats", {
          variant: "minimal",
        }),
      },
    };

    renderHook(() => useUserPageDraftBackup({ debounceMs: 750 }));

    act(() => {
      editorStore.setState({
        isDirty: true,
        localEditsPatch: firstPatch,
      });
    });

    act(() => {
      editorStore.setState({
        isDirty: true,
        localEditsPatch: secondPatch,
      });
    });

    expect(readUserPageDraft("42")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(749);
    });

    expect(readUserPageDraft("42")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(readUserPageDraft("42")?.patch).toEqual(secondPatch);
  });

  it("clears drafts when the editor becomes clean and suppresses stale writes", () => {
    const patch: LocalEditsPatch = {
      cardConfigs: {
        favoritesGrid: createCardConfig("favoritesGrid", {
          enabled: false,
          variant: "mixed",
        }),
      },
    };

    renderHook(() => useUserPageDraftBackup({ debounceMs: 750 }));

    act(() => {
      editorStore.setState({
        isDirty: true,
        localEditsPatch: patch,
      });
    });

    expect(recordUserPageExitSaveFallback("42", "send_beacon_failed")).toBe(
      true,
    );
    expect(readUserPageExitSaveFallback("42")?.reason).toBe(
      "send_beacon_failed",
    );

    act(() => {
      editorStore.setState({
        isDirty: false,
        localEditsPatch: null,
      });
    });

    expect(readUserPageDraft("42")).toBeNull();
    expect(readUserPageExitSaveFallback("42")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(750);
    });

    expect(readUserPageDraft("42")).toBeNull();
    expect(readUserPageExitSaveFallback("42")).toBeNull();
  });

  it("cancels an in-flight draft timer when the hook unmounts", () => {
    const patch: LocalEditsPatch = {
      cardConfigs: {
        animeStats: createCardConfig("animeStats", {
          variant: "compact",
        }),
      },
    };

    const { unmount } = renderHook(() =>
      useUserPageDraftBackup({ debounceMs: 750 }),
    );

    act(() => {
      editorStore.setState({
        isDirty: true,
        localEditsPatch: patch,
      });
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(750);
    });

    expect(readUserPageDraft("42")).toBeNull();
  });

  it("flushes the latest dirty draft immediately on pagehide", () => {
    const patch: LocalEditsPatch = {
      cardConfigs: {
        animeStats: createCardConfig("animeStats", {
          enabled: false,
        }),
      },
    };

    renderHook(() => useUserPageDraftBackup({ debounceMs: 750 }));

    act(() => {
      editorStore.setState({
        isDirty: true,
        localEditsPatch: patch,
      });
    });

    act(() => {
      globalThis.window.dispatchEvent(new globalThis.window.Event("pagehide"));
    });

    expect(readUserPageDraft("42")?.patch).toEqual(patch);
  });

  it("records an explicit exit-save fallback marker alongside the flushed draft", () => {
    const patch: LocalEditsPatch = {
      cardConfigs: {
        animeStats: createCardConfig("animeStats", {
          enabled: false,
        }),
      },
    };

    renderHook(() => useUserPageDraftBackup({ debounceMs: 750 }));

    act(() => {
      editorStore.setState({
        isDirty: true,
        localEditsPatch: patch,
      });
    });

    expect(
      recordUserPageExitSaveFallback("42", "send_beacon_unsupported"),
    ).toBe(true);
    expect(readUserPageDraft("42")?.patch).toEqual(patch);
    expect(readUserPageExitSaveFallback("42")).toMatchObject({
      reason: "send_beacon_unsupported",
      userId: "42",
      version: 1,
    });
  });

  it("flushes the latest dirty draft immediately when the page becomes hidden", () => {
    const patch: LocalEditsPatch = {
      cardConfigs: {
        animeStats: createCardConfig("animeStats", {
          variant: "minimal",
        }),
      },
    };

    renderHook(() => useUserPageDraftBackup({ debounceMs: 750 }));

    act(() => {
      editorStore.setState({
        isDirty: true,
        localEditsPatch: patch,
      });
    });

    Object.defineProperty(globalThis.document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    act(() => {
      globalThis.document.dispatchEvent(
        new globalThis.window.Event("visibilitychange"),
      );
    });

    expect(readUserPageDraft("42")?.patch).toEqual(patch);
  });
});
