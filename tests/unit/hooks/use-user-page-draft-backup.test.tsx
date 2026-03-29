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

const draftHelpers = {
  clearUserPageDraft: mock(),
  writeUserPageDraft: mock(),
};
const editorStore = createMockUserPageEditorStore();

mock.module("@/lib/stores/user-page-editor", () => editorStore.module);
mock.module("@/lib/user-page-editor-draft", () => draftHelpers);

installHappyDom();

const { act, cleanup, renderHook } = await import("@testing-library/react");
const { useUserPageDraftBackup } =
  await import("@/hooks/useUserPageDraftBackup");

beforeEach(() => {
  vi.useFakeTimers();
  resetHappyDom();
  draftHelpers.clearUserPageDraft.mockReset();
  draftHelpers.writeUserPageDraft.mockReset();
  editorStore.reset({
    isDirty: false,
    userId: "42",
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

    expect(draftHelpers.writeUserPageDraft).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(749);
    });

    expect(draftHelpers.writeUserPageDraft).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(draftHelpers.writeUserPageDraft).toHaveBeenCalledTimes(1);
    expect(draftHelpers.writeUserPageDraft).toHaveBeenCalledWith(
      "42",
      secondPatch,
    );
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

    act(() => {
      editorStore.setState({
        isDirty: false,
        localEditsPatch: null,
      });
    });

    expect(draftHelpers.clearUserPageDraft).toHaveBeenCalledTimes(1);
    expect(draftHelpers.clearUserPageDraft).toHaveBeenCalledWith("42");

    act(() => {
      vi.advanceTimersByTime(750);
    });

    expect(draftHelpers.writeUserPageDraft).not.toHaveBeenCalled();
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

    expect(draftHelpers.writeUserPageDraft).not.toHaveBeenCalled();
  });
});
