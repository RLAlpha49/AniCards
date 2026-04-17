import "@/tests/unit/__setup__";

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";

import { colorPresets } from "@/components/stat-card-generator/constants";
import type { ServerCardData, ServerGlobalSettings } from "@/lib/api/cards";
import type {
  CardEditorConfig,
  LocalEditsPatch,
  UserPageEditorStore,
} from "@/lib/stores/user-page-editor";
import { clampBorderRadius } from "@/lib/utils";
import {
  createGlobalSnapshot,
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

installHappyDom();

type RealUserPageEditorStoreModule =
  typeof import("@/lib/stores/user-page-editor");

async function importRealUserPageEditorStoreModule(): Promise<RealUserPageEditorStoreModule> {
  return await import(
    new URL("../../../lib/stores/user-page-editor.ts", import.meta.url).href
  );
}

let DEFAULT_BORDER_COLOR = "#e4e2e2";
let buildLocalEditsPatch: RealUserPageEditorStoreModule["buildLocalEditsPatch"];
let isCardCustomized: RealUserPageEditorStoreModule["isCardCustomized"];
let selectIsCardModified: RealUserPageEditorStoreModule["selectIsCardModified"];
let useUserPageEditor: RealUserPageEditorStoreModule["useUserPageEditor"];

const TEST_CARD_IDS = [
  "animeStats",
  "profileOverview",
  "animeStatusDistribution",
  "favoritesGrid",
  "animeGenres",
] as const;
const BASE_SERVER_UPDATED_AT = "2026-04-10T00:00:00.000Z";
const NON_DEFAULT_PRESET = Object.keys(colorPresets).find(
  (preset) => preset !== "default",
);

if (!NON_DEFAULT_PRESET) {
  throw new Error("Expected at least one non-default color preset.");
}

const compareAlphabetically = (left: string, right: string) =>
  left.localeCompare(right);

const originalDateNow = Date.now;
const originalCrypto = globalThis.crypto;

function getState() {
  return useUserPageEditor.getState();
}

function createExplicitCards(): ServerCardData[] {
  return [
    {
      cardName: "animeStats",
      variation: "default",
      useCustomSettings: false,
    },
    {
      cardName: "profileOverview",
      variation: "default",
      disabled: true,
      useCustomSettings: false,
    },
    {
      cardName: "animeStatusDistribution",
      variation: "pie",
      useCustomSettings: false,
    },
    {
      cardName: "favoritesGrid",
      variation: "anime",
      colorPreset: "custom",
      titleColor: "#111111",
      backgroundColor: "#222222",
      textColor: "#333333",
      circleColor: "#444444",
      borderColor: "#777777",
      borderRadius: 12,
      useCustomSettings: true,
      showFavorites: false,
      gridCols: 5,
      gridRows: 1,
    },
  ];
}

function createExplicitGlobalSettings(): ServerGlobalSettings {
  return {
    colorPreset: "default",
    borderEnabled: false,
    borderColor: DEFAULT_BORDER_COLOR,
    borderRadius: 8,
    useStatusColors: true,
    showPiePercentages: true,
    showFavorites: true,
    gridCols: 3,
    gridRows: 3,
  };
}

function initializeExplicitStore(options?: {
  cards?: ServerCardData[];
  globalSettings?: ServerGlobalSettings;
  allCardIds?: readonly string[];
  cardOrder?: readonly string[];
  serverUpdatedAt?: string | null;
}) {
  const cards = options?.cards ?? createExplicitCards();
  const allCardIds = options?.allCardIds ?? TEST_CARD_IDS;
  const cardOrder = options?.cardOrder ?? TEST_CARD_IDS;
  const globalSettings =
    options && "globalSettings" in options
      ? options.globalSettings
      : createExplicitGlobalSettings();

  getState().initializeFromServerData(
    "42",
    "Alex",
    "https://anicards.test/avatar.png",
    cards,
    globalSettings,
    allCardIds,
    options?.serverUpdatedAt ?? BASE_SERVER_UPDATED_AT,
    cardOrder,
  );

  return getState();
}

describe("user-page-editor store direct coverage", () => {
  beforeEach(async () => {
    resetHappyDom();
    mock.restore();
    ({
      DEFAULT_BORDER_COLOR,
      buildLocalEditsPatch,
      isCardCustomized,
      selectIsCardModified,
      useUserPageEditor,
    } = await importRealUserPageEditorStoreModule());
    getState().reset();
    Date.now = originalDateNow;
    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Date.now = originalDateNow;
    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      configurable: true,
      writable: true,
    });
  });

  afterAll(() => {
    restoreHappyDom();
  });

  it("tracks global dirty state without marking customized cards as globally modified", () => {
    initializeExplicitStore();

    const initial = getState();
    expect(isCardCustomized(initial.cardConfigs.favoritesGrid)).toBe(true);
    expect(selectIsCardModified(initial, "animeStats")).toBe(false);
    expect(selectIsCardModified(initial, "favoritesGrid")).toBe(false);

    initial.setGlobalAdvancedSetting("showFavorites", false);

    const next = getState();
    const patch = buildLocalEditsPatch(next);

    expect(next.isDirty).toBe(true);
    expect(next.isGlobalDirty).toBe(true);
    expect(next.isCardOrderDirty).toBe(false);
    expect(next.dirtyCardIds).toEqual({});
    expect(patch).toEqual({
      globalSnapshot: expect.objectContaining({
        advancedSettings: expect.objectContaining({
          showFavorites: false,
        }),
      }),
    });
    expect(patch?.cardConfigs).toBeUndefined();
    expect(patch?.cardOrder).toBeUndefined();
    expect(selectIsCardModified(next, "animeStats")).toBe(true);
    expect(selectIsCardModified(next, "favoritesGrid")).toBe(false);
  });

  it("updates only saved baselines when markSaved receives a partial applied patch", () => {
    initializeExplicitStore();

    const initial = getState();
    const initialBaselineGlobal = initial.baselineGlobalSnapshot;

    initial.setGlobalBorderEnabled(true);
    initial.setCardVariant("animeStats", "compact");
    initial.reorderCardsInScope({
      activeId: "animeGenres",
      overId: "animeStatusDistribution",
    });

    const changed = getState();
    const appliedPatch: LocalEditsPatch = {
      cardConfigs: {
        animeStats: changed.cardConfigs.animeStats,
      },
      cardOrder: changed.cardOrder,
    };

    Date.now = () => 1_717_171_717_000;

    changed.markSaved({
      appliedPatch,
      serverUpdatedAt: "2026-05-01T00:00:00.000Z",
    });

    const next = getState();
    const remainingPatch = buildLocalEditsPatch(next);

    expect(next.serverUpdatedAt).toBe("2026-05-01T00:00:00.000Z");
    expect(next.lastSavedAt).toBe(1_717_171_717_000);
    expect(next.isDirty).toBe(true);
    expect(next.isGlobalDirty).toBe(true);
    expect(next.isCardOrderDirty).toBe(false);
    expect(next.dirtyCardIds).toEqual({});
    expect(next.baselineGlobalSnapshot).toEqual(initialBaselineGlobal);
    expect(next.baselineCardConfigs.animeStats.variant).toBe("compact");
    expect(next.baselineCardOrder).toEqual(changed.cardOrder);
    expect(remainingPatch).toEqual({
      globalSnapshot: expect.objectContaining({
        borderEnabled: true,
      }),
    });
  });

  it("normalizes local edit patches and fully restores the captured baseline on discard", () => {
    initializeExplicitStore();

    const state = getState();
    state.selectCard("animeStats");
    state.bulkApplyColorPreset(["animeStatusDistribution"], NON_DEFAULT_PRESET);
    state.setSaveError("save conflict");

    const patchCard: CardEditorConfig = {
      cardId: "favoritesGrid",
      enabled: true,
      variant: "mixed",
      colorOverride: {
        useCustomSettings: true,
        colorPreset: "custom",
        colors: ["#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd"],
      },
      advancedSettings: {
        showFavorites: false,
        gridCols: 4,
        gridRows: 2,
      },
      borderColor: "#123123",
      borderRadius: 99,
    };
    const patch: LocalEditsPatch = {
      globalSnapshot: createGlobalSnapshot({
        borderEnabled: true,
        borderColor: "#999999",
        borderRadius: 999,
        advancedSettings: {
          gridCols: 99,
          gridRows: 0,
        },
      }),
      cardConfigs: {
        favoritesGrid: patchCard,
      },
      cardOrder: [
        "favoritesGrid",
        "ghost-card",
        "animeStats",
        "animeStats",
        "profileOverview",
      ],
    };

    state.applyLocalEditsPatch(patch);

    patchCard.borderColor = "#ff00ff";
    patchCard.colorOverride.colors = [
      "#000000",
      "#000000",
      "#000000",
      "#000000",
    ];

    const patched = getState();

    expect(patched.globalBorderEnabled).toBe(true);
    expect(patched.globalBorderColor).toBe("#999999");
    expect(patched.globalBorderRadius).toBe(clampBorderRadius(999));
    expect(patched.globalAdvancedSettings.gridCols).toBe(5);
    expect(patched.globalAdvancedSettings.gridRows).toBe(1);
    expect(patched.cardConfigs.favoritesGrid.borderColor).toBe("#123123");
    expect(patched.cardConfigs.favoritesGrid.colorOverride.colors).toEqual([
      "#aaaaaa",
      "#bbbbbb",
      "#cccccc",
      "#dddddd",
    ]);
    expect(patched.cardOrder).toEqual([
      "favoritesGrid",
      "animeStats",
      "profileOverview",
      "animeStatusDistribution",
      "animeGenres",
    ]);

    patched.discardChanges();

    const discarded = getState();

    expect(discarded.globalBorderEnabled).toBe(false);
    expect(discarded.globalBorderColor).toBe(DEFAULT_BORDER_COLOR);
    expect(discarded.globalBorderRadius).toBe(8);
    expect(discarded.cardOrder).toEqual([...TEST_CARD_IDS]);
    expect(discarded.cardConfigs.favoritesGrid).toMatchObject({
      borderColor: "#777777",
      borderRadius: 12,
      variant: "anime",
    });
    expect(discarded.selectedCardIds.size).toBe(0);
    expect(discarded.bulkPast).toEqual([]);
    expect(discarded.bulkFuture).toEqual([]);
    expect(discarded.bulkLastMessage).toBe("Discarded changes");
    expect(discarded.saveError).toBeNull();
    expect(discarded.isSaving).toBe(false);
    expect(discarded.isDirty).toBe(false);
    expect(discarded.isGlobalDirty).toBe(false);
    expect(discarded.isCardOrderDirty).toBe(false);
    expect(discarded.dirtyCardIds).toEqual({});
  });

  it("normalizes legacy server payloads while pruning unknown cards and seeding omitted ones", () => {
    initializeExplicitStore({
      cards: [
        {
          cardName: "animeStats",
          variation: "minimal",
          titleColor: "#121212",
          backgroundColor: "#232323",
          textColor: "#343434",
          circleColor: "#454545",
          borderColor: "#abcdef",
          borderRadius: 999,
          useCustomSettings: false,
        },
        {
          cardName: "favoritesGrid",
          variation: "staff",
          useCustomSettings: false,
          showFavorites: false,
          gridCols: 5,
          gridRows: 1,
        },
        {
          cardName: "animeStatusDistribution",
          variation: "donut",
          colorPreset: "custom",
          titleColor: "#aa0000",
          backgroundColor: "#00aa00",
          textColor: "#0000aa",
          circleColor: "#aaaa00",
          useCustomSettings: true,
          showPiePercentages: false,
          useStatusColors: false,
        },
        {
          cardName: "ghostLegacy",
          variation: "default",
          useCustomSettings: false,
        },
      ],
      globalSettings: undefined,
      allCardIds: [
        "animeStats",
        "favoritesGrid",
        "animeStatusDistribution",
        "profileOverview",
      ],
      cardOrder: [
        "ghostLegacy",
        "animeStatusDistribution",
        "animeStats",
        "animeStats",
      ],
    });

    const state = getState();

    expect(state.globalColorPreset).toBe("custom");
    expect(state.globalColors).toEqual([
      "#121212",
      "#232323",
      "#343434",
      "#454545",
    ]);
    expect(state.globalBorderEnabled).toBe(true);
    expect(state.globalBorderColor).toBe("#abcdef");
    expect(state.globalBorderRadius).toBe(clampBorderRadius(999));
    expect(state.cardConfigs.favoritesGrid.advancedSettings).toEqual({});
    expect(
      state.cardConfigs.animeStatusDistribution.advancedSettings,
    ).toMatchObject({
      showPiePercentages: false,
      useStatusColors: false,
    });
    expect(state.cardConfigs.ghostLegacy).toBeUndefined();
    expect(state.cardConfigs.profileOverview).toEqual({
      cardId: "profileOverview",
      enabled: false,
      variant: "default",
      colorOverride: { useCustomSettings: false },
      advancedSettings: {},
    });
    expect(state.cardOrder).toEqual([
      "animeStatusDistribution",
      "animeStats",
      "favoritesGrid",
      "profileOverview",
    ]);
    expect(state.baselineCardOrder).toEqual(state.cardOrder);
  });

  it("tracks bulk variant changes, skipped unsupported cards, and undo/redo history", () => {
    initializeExplicitStore();

    const state = getState();
    const result = state.bulkSetVariant(
      ["animeStats", "profileOverview", "animeStatusDistribution"],
      "minimal",
    );

    expect(result.applied).toEqual(["animeStats"]);
    expect(result.skipped.sort(compareAlphabetically)).toEqual([
      "animeStatusDistribution",
      "profileOverview",
    ]);
    expect(getState().cardConfigs.animeStats.variant).toBe("minimal");
    expect(getState().bulkPast).toHaveLength(1);
    expect(getState().bulkLastMessage).toBe(
      'Applied: Set variant to "minimal" (1 changed, 2 unsupported)',
    );

    getState().undoBulk();
    expect(getState().cardConfigs.animeStats.variant).toBe("default");
    expect(getState().bulkFuture).toHaveLength(1);
    expect(getState().bulkLastMessage).toBe(
      'Undid: Set variant to "minimal" (1 changed, 2 unsupported)',
    );

    getState().redoBulk();
    expect(getState().cardConfigs.animeStats.variant).toBe("minimal");
    expect(getState().bulkLastMessage).toBe(
      'Redid: Set variant to "minimal" (1 changed, 2 unsupported)',
    );

    const forced = getState().bulkSetVariant(["profileOverview"], "minimal", {
      skipUnsupported: false,
    });

    expect(forced).toEqual({ applied: ["profileOverview"], skipped: [] });
    expect(getState().cardConfigs.profileOverview.variant).toBe("minimal");
  });

  it("covers selection, simple ui flags, bulk enable-disable resets, and scoped ordering", () => {
    initializeExplicitStore();

    const state = getState();
    state.setUserData("99", "Blair", "https://anicards.test/blair.png");
    state.setLoading(true);
    state.setLoadError("load failed");
    state.setExpandedCard("animeStats");
    state.toggleExpandedCard("animeStats");
    state.toggleExpandedCard("profileOverview");
    state.toggleCardSelection("animeStats");
    state.selectCard("profileOverview");
    state.deselectCard("animeStats");
    state.clearSelection();
    state.markDirty();
    state.setSaving(true);
    state.setSaveError("save failed");

    expect(getState()).toMatchObject({
      userId: "99",
      username: "Blair",
      avatarUrl: "https://anicards.test/blair.png",
      isLoading: false,
      loadError: "load failed",
      expandedCardId: "profileOverview",
      isSaving: false,
      saveError: "save failed",
    });
    expect(getState().selectedCardIds.size).toBe(0);

    state.enableAllCards();
    state.selectAllEnabled();
    expect([...getState().selectedCardIds].sort(compareAlphabetically)).toEqual(
      [...TEST_CARD_IDS].sort(compareAlphabetically),
    );

    state.disableAllCards();
    expect(
      Object.values(getState().cardConfigs).every((config) => !config.enabled),
    ).toBe(true);

    state.selectCardsByGroup("Core Stats");
    expect([...getState().selectedCardIds].sort(compareAlphabetically)).toEqual(
      ["animeStats", "profileOverview"],
    );

    state.selectCardsByGroup("All");
    expect(getState().selectedCardIds.size).toBe(TEST_CARD_IDS.length);

    const presetResult = state.bulkApplyColorPreset(
      ["animeStats", "profileOverview"],
      NON_DEFAULT_PRESET,
    );
    expect(presetResult.applied.sort(compareAlphabetically)).toEqual([
      "animeStats",
      "profileOverview",
    ]);

    state.resetSelectedCardsToGlobal(["animeStats", "profileOverview"]);
    expect(isCardCustomized(getState().cardConfigs.animeStats)).toBe(false);
    expect(isCardCustomized(getState().cardConfigs.profileOverview)).toBe(
      false,
    );

    state.setCardColorPreset("animeGenres", NON_DEFAULT_PRESET);
    state.setCardBorderColor("animeGenres", "#123456");
    state.setCardBorderRadius("animeGenres", 21);
    state.setCardAdvancedSetting("animeGenres", "showPiePercentages", false);
    expect(isCardCustomized(getState().cardConfigs.animeGenres)).toBe(true);

    state.resetCardToGlobal("animeGenres");
    expect(isCardCustomized(getState().cardConfigs.animeGenres)).toBe(false);

    state.setCardColorPreset("animeGenres", NON_DEFAULT_PRESET);
    state.setCardBorderColor("animeGenres", "#654321");
    state.resetAllCardsToGlobal();
    expect(
      Object.values(getState().cardConfigs).every(
        (config) => !isCardCustomized(config),
      ),
    ).toBe(true);

    state.setCardEnabled("animeGenres", true);
    state.setCardOrder(["animeGenres", "animeStats", "animeStats", "ghost"]);
    expect(getState().cardOrder).toEqual([
      "animeGenres",
      "animeStats",
      "profileOverview",
      "animeStatusDistribution",
      "favoritesGrid",
    ]);

    state.reorderCardsInScope({
      activeId: "animeGenres",
      overId: "profileOverview",
      scopeIds: ["animeGenres", "profileOverview"],
    });

    expect(getState().cardOrder).toEqual([
      "profileOverview",
      "animeStats",
      "animeGenres",
      "animeStatusDistribution",
      "favoritesGrid",
    ]);
    expect(buildLocalEditsPatch(getState())?.cardOrder).toEqual([
      "profileOverview",
      "animeStats",
      "animeGenres",
      "animeStatusDistribution",
      "favoritesGrid",
    ]);
  });

  it("supports snapshots, template success paths, copy helpers, and effective getters", () => {
    initializeExplicitStore();

    let fakeNow = Date.UTC(2026, 0, 1, 0, 0, 0);
    Date.now = () => fakeNow;

    const randomUUID = mock(() => {
      const nextId = fakeIds.shift();
      if (!nextId) {
        throw new Error("Ran out of fake template ids.");
      }
      return nextId;
    });
    const fakeIds = ["tpl-1", "tpl-2", "tpl-3"];

    Object.defineProperty(globalThis, "crypto", {
      value: {
        ...originalCrypto,
        randomUUID,
      },
      configurable: true,
      writable: true,
    });

    const globalSnapshot = createGlobalSnapshot({
      borderEnabled: true,
      borderColor: "#999999",
      borderRadius: 22,
      advancedSettings: {
        gridCols: 4,
        gridRows: 2,
      },
    });
    const cardSnapshot = createGlobalSnapshot({
      colors: ["#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd"],
      borderEnabled: true,
      borderColor: "#123abc",
      borderRadius: 27,
      advancedSettings: {
        showFavorites: false,
        gridCols: 5,
        gridRows: 1,
      },
    });

    const initialCardSnapshot =
      getState().getCardSettingsSnapshot("profileOverview");
    const initialCustomSnapshot =
      getState().getCardSettingsSnapshot("favoritesGrid");

    expect(initialCardSnapshot).toMatchObject({
      colorPreset: "default",
      borderEnabled: false,
      borderColor: DEFAULT_BORDER_COLOR,
      borderRadius: 8,
    });
    expect(initialCustomSnapshot).toMatchObject({
      colorPreset: "custom",
      borderEnabled: true,
      borderColor: "#777777",
      borderRadius: 12,
    });

    getState().applySettingsSnapshotToGlobal(globalSnapshot);
    expect(getState().getGlobalSettingsSnapshot()).toEqual(globalSnapshot);

    getState().applySettingsSnapshotToCard("animeStats", cardSnapshot);
    expect(getState().getCardSettingsSnapshot("animeStats")).toEqual(
      cardSnapshot,
    );

    getState().copySettingsFromCard("animeStats", "profileOverview");
    expect(getState().cardConfigs.profileOverview).toMatchObject({
      colorOverride: {
        useCustomSettings: true,
        colorPreset: "custom",
        colors: ["#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd"],
      },
      borderColor: "#123abc",
      borderRadius: 27,
      advancedSettings: {
        showFavorites: false,
        gridCols: 5,
        gridRows: 1,
      },
    });

    const createResult = getState().createSettingsTemplate(
      "  My Template  ",
      globalSnapshot,
    );
    expect(createResult).toEqual({ ok: true });
    expect(getState().settingsTemplates[0]).toMatchObject({
      id: "tpl-1",
      name: "My Template",
      createdAt: fakeNow,
      updatedAt: fakeNow,
    });

    fakeNow += 1_000;
    const renameResult = getState().renameSettingsTemplate(
      "tpl-1",
      " Renamed ",
    );
    expect(renameResult).toEqual({ ok: true });
    expect(getState().settingsTemplates[0]).toMatchObject({
      id: "tpl-1",
      name: "Renamed",
      updatedAt: fakeNow,
    });

    getState().applySettingsTemplateToGlobal("tpl-1");
    expect(getState().globalBorderColor).toBe("#999999");
    expect(getState().globalBorderRadius).toBe(22);

    getState().applySettingsTemplateToCard("animeGenres", "tpl-1");
    expect(getState().getEffectiveColors("animeGenres")).toEqual(
      globalSnapshot.colors,
    );
    expect(getState().getEffectiveBorderColor("animeGenres")).toBe("#999999");
    expect(getState().getEffectiveBorderRadius("animeGenres")).toBe(22);

    fakeNow += 1_000;
    const exported = getState().exportSettingsTemplates();
    expect(exported).toMatchObject({
      schemaVersion: 1,
      scope: "templates",
      templates: getState().settingsTemplates,
    });
    expect(new Date(exported.exportedAt).toISOString()).toBe(
      exported.exportedAt,
    );

    fakeNow += 1_000;
    const importResult = getState().importSettingsTemplates([
      {
        id: "tpl-1",
        name: "Imported Copy",
        snapshot: cardSnapshot,
        createdAt: 5,
        updatedAt: 5,
      },
    ]);
    expect(importResult).toEqual({ ok: true });
    expect(getState().settingsTemplates).toHaveLength(2);
    expect(getState().settingsTemplates[1]).toMatchObject({
      id: "tpl-2",
      name: "Imported Copy",
      updatedAt: fakeNow,
    });

    const deleteResult = getState().deleteSettingsTemplate("tpl-2");
    expect(deleteResult).toEqual({ ok: true });
    expect(getState().settingsTemplates).toHaveLength(1);
  });

  it("falls back to full diffing when dirty tracker fields are malformed", () => {
    initializeExplicitStore();

    getState().setGlobalBorderEnabled(true);

    const malformedState = {
      ...getState(),
      dirtyCardIds: null,
      isGlobalDirty: undefined,
      isCardOrderDirty: undefined,
      isDirty: false,
    } as unknown as UserPageEditorStore;

    const patch = buildLocalEditsPatch(malformedState);

    expect(patch).toEqual({
      globalSnapshot: expect.objectContaining({
        borderEnabled: true,
      }),
    });
    expect(selectIsCardModified(malformedState, "animeStats")).toBe(true);
  });
});
