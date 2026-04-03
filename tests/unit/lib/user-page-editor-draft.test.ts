import "@/tests/unit/__setup__";

import { afterAll, beforeEach, describe, expect, it } from "bun:test";

import {
  readUserPageDraft,
  writeUserPageDraft,
} from "@/lib/user-page-editor-draft";
import { DEFAULT_CARD_BORDER_RADIUS } from "@/lib/utils";
import {
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

installHappyDom();

const DRAFT_STORAGE_KEY = "anicards:user-page-editor:draft:v1:42";

describe("user-page-editor-draft", () => {
  beforeEach(() => {
    resetHappyDom();
  });

  afterAll(() => {
    restoreHappyDom();
  });

  it("normalizes stored drafts and drops malformed sections before restore", () => {
    const savedAt = Date.now() - 1000;

    globalThis.window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        userId: "42",
        savedAt,
        patch: {
          globalSnapshot: {
            colors: ["#111111", "#222222", "#333333", "#444444"],
            advancedSettings: {
              gridCols: 99.6,
              gridRows: -7.2,
            },
          },
          cardOrder: ["animeStats", 42, "favoritesGrid", ""],
          cardConfigs: {
            animeStats: {
              enabled: true,
              variant: "compact",
              colorOverride: {
                useCustomSettings: true,
                colors: ["#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd"],
              },
              advancedSettings: {
                gridCols: 0,
                gridRows: 7.4,
              },
              borderRadius: "invalid",
            },
            brokenCard: {
              enabled: true,
              variant: "default",
              colorOverride: {
                useCustomSettings: true,
                colorPreset: "custom",
                colors: ["#111111", "#222222"],
              },
              advancedSettings: {},
            },
          },
        },
      }),
    );

    expect(readUserPageDraft("42")).toEqual({
      version: 1,
      userId: "42",
      savedAt,
      patch: {
        globalSnapshot: {
          colorPreset: "custom",
          colors: ["#111111", "#222222", "#333333", "#444444"],
          borderEnabled: false,
          borderColor: "#e4e2e2",
          borderRadius: DEFAULT_CARD_BORDER_RADIUS,
          advancedSettings: {
            gridCols: 5,
            gridRows: 1,
          },
        },
        cardOrder: ["animeStats", "favoritesGrid"],
        cardConfigs: {
          animeStats: {
            cardId: "animeStats",
            enabled: true,
            variant: "compact",
            colorOverride: {
              useCustomSettings: true,
              colors: ["#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd"],
            },
            advancedSettings: {
              gridCols: 1,
              gridRows: 5,
            },
          },
        },
      },
    });
  });

  it("refuses to persist drafts that normalize down to nothing", () => {
    const invalidPatch = {
      cardConfigs: {
        animeStats: {
          cardId: "animeStats",
          enabled: true,
          variant: "default",
          colorOverride: {
            useCustomSettings: true,
            colorPreset: "custom",
            colors: ["#111111", "#222222"],
          },
          advancedSettings: {},
        },
      },
    } as unknown as Parameters<typeof writeUserPageDraft>[1];

    writeUserPageDraft("42", invalidPatch);

    expect(
      globalThis.window.localStorage.getItem(DRAFT_STORAGE_KEY),
    ).toBeNull();
  });

  it("drops expired drafts instead of reusing them forever", () => {
    const savedAt = Date.now() - 1000 * 60 * 60 * 24 * 8;

    globalThis.window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        userId: "42",
        savedAt,
        patch: {
          cardConfigs: {
            animeStats: {
              cardId: "animeStats",
              enabled: false,
              variant: "default",
              colorOverride: {
                useCustomSettings: false,
              },
              advancedSettings: {},
            },
          },
        },
      }),
    );

    expect(readUserPageDraft("42")).toBeNull();
    expect(
      globalThis.window.localStorage.getItem(DRAFT_STORAGE_KEY),
    ).toBeNull();
  });
});
