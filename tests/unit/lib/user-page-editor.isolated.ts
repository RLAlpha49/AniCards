import "@/tests/unit/__setup__";

import { afterAll, beforeEach, describe, expect, it } from "bun:test";

import type { SettingsTemplateV1 } from "@/lib/user-page-settings-io";
import {
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

installHappyDom();

const { useUserPageEditor } = await import("@/lib/stores/user-page-editor");

function blockLocalStorageWrites() {
  const storage = globalThis.window.localStorage;
  const originalSetItem = storage.setItem.bind(storage);

  Object.defineProperty(storage, "setItem", {
    configurable: true,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    value: ((..._args: Parameters<typeof storage.setItem>) => {
      throw new Error("localStorage write blocked");
    }) as typeof storage.setItem,
  });

  return () => {
    Object.defineProperty(storage, "setItem", {
      configurable: true,
      value: originalSetItem,
    });
  };
}

describe("user-page-editor store", () => {
  beforeEach(() => {
    resetHappyDom();
    useUserPageEditor.getState().reset();
  });

  afterAll(() => {
    restoreHappyDom();
  });

  it("reconstructs omitted disabled cards using persisted cardOrder", () => {
    useUserPageEditor.getState().initializeFromServerData(
      "42",
      "Alex",
      null,
      [
        {
          cardName: "animeStats",
          variation: "minimal",
          useCustomSettings: false,
        },
      ],
      undefined,
      ["favoritesGrid", "animeGenres", "animeStats"],
      "2026-04-10T00:00:00.000Z",
      ["favoritesGrid", "animeGenres", "animeStats"],
    );

    const state = useUserPageEditor.getState();

    expect(state.cardOrder).toEqual([
      "favoritesGrid",
      "animeGenres",
      "animeStats",
    ]);
    expect(state.baselineCardOrder).toEqual([
      "favoritesGrid",
      "animeGenres",
      "animeStats",
    ]);
    expect(state.serverUpdatedAt).toBe("2026-04-10T00:00:00.000Z");
    expect(state.cardConfigs.animeStats).toMatchObject({
      cardId: "animeStats",
      enabled: true,
      variant: "minimal",
    });
    expect(state.cardConfigs.favoritesGrid).toEqual({
      cardId: "favoritesGrid",
      enabled: false,
      variant: "default",
      colorOverride: { useCustomSettings: false },
      advancedSettings: {},
    });
    expect(state.cardConfigs.animeGenres).toEqual({
      cardId: "animeGenres",
      enabled: false,
      variant: "default",
      colorOverride: { useCustomSettings: false },
      advancedSettings: {},
    });
  });

  it("does not add templates to memory when create persistence fails", () => {
    const restoreSetItem = blockLocalStorageWrites();

    try {
      const snapshot = useUserPageEditor.getState().getGlobalSettingsSnapshot();
      const result = useUserPageEditor
        .getState()
        .createSettingsTemplate("Blocked", snapshot);

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error("Expected template creation to fail.");
      }
      expect(result.error).toBe(
        "Couldn't save template changes in this browser. Check storage permissions and try again.",
      );
      expect(useUserPageEditor.getState().settingsTemplates).toEqual([]);
    } finally {
      restoreSetItem();
    }
  });

  it("keeps existing templates unchanged when rename or delete persistence fails", () => {
    const snapshot = useUserPageEditor.getState().getGlobalSettingsSnapshot();
    const createResult = useUserPageEditor
      .getState()
      .createSettingsTemplate("Original", snapshot);

    expect(createResult.ok).toBe(true);

    const templateId = useUserPageEditor.getState().settingsTemplates[0]?.id;
    if (!templateId) {
      throw new Error("Expected template to be created.");
    }

    const restoreSetItem = blockLocalStorageWrites();

    try {
      const renameResult = useUserPageEditor
        .getState()
        .renameSettingsTemplate(templateId, "Renamed");
      expect(renameResult.ok).toBe(false);

      const deleteResult = useUserPageEditor
        .getState()
        .deleteSettingsTemplate(templateId);
      expect(deleteResult.ok).toBe(false);
    } finally {
      restoreSetItem();
    }

    const templates = useUserPageEditor.getState().settingsTemplates;
    expect(templates).toHaveLength(1);
    expect(templates[0]?.name).toBe("Original");
  });

  it("does not import templates into memory when persistence fails", () => {
    const template: SettingsTemplateV1 = {
      id: "template-import",
      name: "Imported",
      snapshot: useUserPageEditor.getState().getGlobalSettingsSnapshot(),
      createdAt: 1,
      updatedAt: 1,
    };

    const restoreSetItem = blockLocalStorageWrites();

    try {
      const result = useUserPageEditor
        .getState()
        .importSettingsTemplates([template]);
      expect(result.ok).toBe(false);
    } finally {
      restoreSetItem();
    }

    expect(useUserPageEditor.getState().settingsTemplates).toEqual([]);
  });
});
