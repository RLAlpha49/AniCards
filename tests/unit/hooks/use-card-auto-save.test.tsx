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

import { colorPresets } from "@/components/stat-card-generator/constants";
import type {
  CardEditorConfig,
  LocalEditsPatch,
} from "@/lib/stores/user-page-editor";
import {
  createCardConfig,
  createGlobalSnapshot,
  createMockUserPageEditorStore,
  flushMicrotasks,
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

const editorStore = createMockUserPageEditorStore();
const toast = {
  error: mock(),
  loading: mock(),
  success: mock(),
};

mock.module("sonner", () => ({ toast }));
mock.module("@/lib/stores/user-page-editor", () => editorStore.module);

installHappyDom();

const { act, cleanup, renderHook } = await import("@testing-library/react");
const { useCardAutoSave } = await import("@/hooks/useCardAutoSave");

const originalFetch = globalThis.fetch;

function shortColors(...colors: string[]) {
  return colors as unknown as CardEditorConfig["colorOverride"]["colors"];
}

beforeEach(() => {
  vi.useFakeTimers();
  resetHappyDom();
  toast.error.mockReset();
  toast.loading.mockReset();
  toast.success.mockReset();

  editorStore.reset({
    cardOrder: ["animeStats", "favoritesGrid"],
    isDirty: false,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
});

afterAll(() => {
  mock.restore();
  restoreHappyDom();
});

describe("useCardAutoSave", () => {
  it("queues a debounced save and POSTs only the allowed cards in editor order", async () => {
    const defaultColors = [...colorPresets.default.colors];
    const currentGlobalSnapshot = createGlobalSnapshot({
      advancedSettings: {
        gridCols: 4,
        showFavorites: true,
        showPiePercentages: true,
        gridRows: 3,
        useStatusColors: false,
      },
      borderEnabled: true,
      borderRadius: 8,
      colors: ["#111111", "#222222", "#333333", "#444444"],
    });
    const baselineGlobalSnapshot = createGlobalSnapshot({
      advancedSettings: {
        gridCols: 3,
        showFavorites: true,
        showPiePercentages: true,
        gridRows: 3,
        useStatusColors: true,
      },
      borderEnabled: false,
      borderRadius: 8,
      colors: ["#111111", "#999999", "#333333", "#444444"],
    });

    const patch: LocalEditsPatch = {
      cardConfigs: {
        animeStats: createCardConfig("animeStats", {
          variant: "minimal",
        }),
        favoritesGrid: createCardConfig("favoritesGrid", {
          advancedSettings: {
            gridCols: 4,
            gridRows: 2,
            showFavorites: false,
          },
          borderColor: "#121212",
          borderRadius: 10,
          colorOverride: {
            colorPreset: "custom",
            colors: shortColors("#aaaaaa", "#bbbbbb"),
            useCustomSettings: true,
          },
          enabled: false,
          variant: "mixed",
        }),
        ghostCard: createCardConfig("ghostCard", {
          enabled: true,
        }),
      },
      globalSnapshot: currentGlobalSnapshot,
    };

    editorStore.reset({
      baselineGlobalSnapshot,
      cardOrder: ["favoritesGrid", "animeStats", "ghostCard"],
      globalColorPreset: "custom",
      globalColors: [...currentGlobalSnapshot.colors],
      isDirty: true,
      localEditsPatch: patch,
      serverUpdatedAt: "2026-03-29T03:00:00.000Z",
      userId: "42",
    });

    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({ updatedAt: "2026-03-29T04:00:00.000Z" }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useCardAutoSave({ debounceMs: 500 }));

    expect(result.current.isAutoSaveQueued).toBe(true);
    expect(typeof result.current.autoSaveDueAt).toBe("number");

    await act(async () => {
      vi.advanceTimersByTime(499);
      await flushMicrotasks();
    });

    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await flushMicrotasks();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toast.loading).toHaveBeenCalledWith("Auto-saving…", {
      id: "user-page-autosave",
    });
    expect(toast.success).toHaveBeenCalledWith("Saved", {
      id: "user-page-autosave",
    });
    expect(result.current.isAutoSaveQueued).toBe(false);
    expect(result.current.saveConflict).toBeNull();
    expect(editorStore.mocks.markSaved).toHaveBeenCalledWith({
      appliedPatch: patch,
      serverUpdatedAt: "2026-03-29T04:00:00.000Z",
    });

    const firstFetchCall = fetchMock.mock.calls[0];
    if (!firstFetchCall) {
      throw new Error("Expected auto-save to issue a fetch request.");
    }

    const [url, init] = firstFetchCall as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      cards: Array<Record<string, unknown>>;
      globalSettings?: Record<string, unknown>;
      ifMatchUpdatedAt?: string;
      userId: string;
    };

    expect(url).toBe("/api/store-cards");
    expect(init.method).toBe("POST");
    expect(body.userId).toBe("42");
    expect(body.ifMatchUpdatedAt).toBe("2026-03-29T03:00:00.000Z");
    expect(body.globalSettings).toEqual({
      backgroundColor: "#222222",
      borderEnabled: true,
      borderRadius: 8,
      gridCols: 4,
      useStatusColors: false,
    });
    expect(body.cards).toEqual([
      {
        borderColor: "#121212",
        borderRadius: 10,
        cardName: "favoritesGrid",
        circleColor: defaultColors[3],
        colorPreset: "custom",
        disabled: true,
        gridCols: 4,
        gridRows: 2,
        showFavorites: false,
        textColor: defaultColors[2],
        titleColor: "#aaaaaa",
        backgroundColor: "#bbbbbb",
        useCustomSettings: true,
        variation: "mixed",
      },
      {
        cardName: "animeStats",
        useCustomSettings: false,
        variation: "minimal",
      },
    ]);
  });

  it("saveNow cancels the pending debounce, reports conflicts, and clears them on demand", async () => {
    const patch: LocalEditsPatch = {
      cardConfigs: {
        animeStats: createCardConfig("animeStats", {
          enabled: false,
        }),
      },
    };

    editorStore.reset({
      cardOrder: ["animeStats"],
      isDirty: true,
      localEditsPatch: patch,
      userId: "42",
    });

    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            currentUpdatedAt: "2026-03-29T09:15:00.000Z",
            error: "Changes were already saved in another tab.",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 409,
            statusText: "Conflict",
          },
        ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useCardAutoSave({ debounceMs: 500 }));

    expect(result.current.isAutoSaveQueued).toBe(true);

    await act(async () => {
      await result.current.saveNow();
      await flushMicrotasks();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toast.loading).toHaveBeenCalledWith("Saving…", {
      id: "user-page-autosave",
    });
    expect(toast.error).toHaveBeenCalledWith("Save conflict", {
      description:
        "Changes were saved in another tab. Reload to sync, then re-apply your edits.",
      id: "user-page-autosave",
    });
    expect(result.current.isAutoSaveQueued).toBe(false);
    expect(result.current.saveConflict).toEqual({
      currentUpdatedAt: "2026-03-29T09:15:00.000Z",
    });
    expect(editorStore.getState().saveError).toBe(
      "Changes were already saved in another tab.",
    );

    await act(async () => {
      vi.advanceTimersByTime(500);
      await flushMicrotasks();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.clearSaveConflict();
    });

    expect(result.current.saveConflict).toBeNull();
    expect(editorStore.getState().saveError).toBeNull();
  });
});
