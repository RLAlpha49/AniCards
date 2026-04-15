import { describe, expect, it } from "bun:test";

import type { CardEditorConfig } from "@/lib/stores/user-page-editor";
import {
  makeSettingsExport,
  makeWorkspaceBackup,
  parseLocalEditsPatch,
  parseSettingsExportJson,
  parseSettingsSnapshot,
  parseWorkspaceBackupJson,
  type SettingsSnapshot,
  type SettingsTemplateV1,
  stringifySettingsExport,
  stringifyWorkspaceBackup,
} from "@/lib/user-page-settings-io";
import { DEFAULT_CARD_BORDER_RADIUS } from "@/lib/utils";

const LINEAR_GRADIENT = {
  type: "linear" as const,
  angle: 45,
  stops: [
    { color: "#ffffff", offset: 0 },
    { color: "#000000", offset: 100, opacity: 0.5 },
  ],
};

function createSnapshot(
  overrides: Partial<SettingsSnapshot> = {},
): SettingsSnapshot {
  return {
    colorPreset: overrides.colorPreset ?? "custom",
    colors:
      overrides.colors ??
      ([
        "#111111",
        "#222222",
        "#333333",
        "#444444",
      ] as SettingsSnapshot["colors"]),
    borderEnabled: overrides.borderEnabled ?? true,
    borderColor: overrides.borderColor ?? "#fafafa",
    borderRadius: overrides.borderRadius ?? 12,
    advancedSettings: {
      useStatusColors: true,
      showPiePercentages: false,
      showFavorites: true,
      gridCols: 3,
      gridRows: 4,
      ...overrides.advancedSettings,
    },
  };
}

function createTemplate(
  overrides: Partial<SettingsTemplateV1> = {},
): SettingsTemplateV1 {
  return {
    id: overrides.id ?? "template-1",
    name: overrides.name ?? "Neon Grid",
    snapshot: overrides.snapshot ?? createSnapshot(),
    createdAt: overrides.createdAt ?? 1_700_000_000_000,
    updatedAt: overrides.updatedAt ?? 1_700_000_000_500,
  };
}

function createCardConfig(
  cardId: string,
  overrides: Partial<CardEditorConfig> = {},
): CardEditorConfig {
  return {
    cardId,
    enabled: overrides.enabled ?? true,
    variant: overrides.variant ?? "default",
    colorOverride: overrides.colorOverride ?? {
      useCustomSettings: false,
    },
    advancedSettings: overrides.advancedSettings ?? {},
    ...(overrides.borderColor !== undefined
      ? { borderColor: overrides.borderColor }
      : {}),
    ...(overrides.borderRadius !== undefined
      ? { borderRadius: overrides.borderRadius }
      : {}),
  };
}

function expectIsoTimestamp(value: string) {
  expect(typeof value).toBe("string");
  expect(Number.isNaN(Date.parse(value))).toBe(false);
  expect(new Date(value).toISOString()).toBe(value);
}

describe("user-page-settings-io snapshot parsing", () => {
  it("accepts a valid bare snapshot import", () => {
    const raw = JSON.stringify(
      createSnapshot({
        colors: [LINEAR_GRADIENT, "#223344", "#556677", "#8899aa"],
      }),
    );

    const parsed = parseSettingsExportJson(raw);

    expect(parsed).toEqual({
      ok: true,
      value: {
        kind: "snapshot",
        snapshot: createSnapshot({
          colors: [LINEAR_GRADIENT, "#223344", "#556677", "#8899aa"],
        }),
      },
    });
  });

  it("rejects malformed gradient colors in a snapshot", () => {
    const parsed = parseSettingsSnapshot({
      colorPreset: "custom",
      colors: [
        {
          type: "linear",
          stops: [{ color: "#ffffff", offset: 0 }],
        },
        "#223344",
        "#556677",
        "#8899aa",
      ],
      borderEnabled: false,
      borderColor: "#e4e2e2",
      borderRadius: 8,
      advancedSettings: {},
    });

    expect(parsed).toBeNull();
  });

  it("clamps grid dimensions into the supported 1-5 range", () => {
    const parsed = parseSettingsSnapshot({
      colorPreset: "custom",
      colors: ["#111111", "#222222", "#333333", "#444444"],
      borderEnabled: false,
      advancedSettings: {
        gridCols: 99.6,
        gridRows: -7.2,
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.advancedSettings).toEqual({
      gridCols: 5,
      gridRows: 1,
    });
    expect(parsed?.borderColor).toBe("#e4e2e2");
    expect(parsed?.borderRadius).toBe(DEFAULT_CARD_BORDER_RADIUS);
  });
});

describe("user-page-settings-io JSON import parsing", () => {
  it("rejects invalid JSON input", () => {
    expect(parseSettingsExportJson("{not valid json")).toEqual({
      ok: false,
      error: "Invalid JSON.",
    });
  });

  it("rejects oversized imports before parsing", () => {
    const oversized = "x".repeat(250_001);

    expect(parseSettingsExportJson(oversized)).toEqual({
      ok: false,
      error: "Import is too large (250001 chars).",
    });
  });

  it("rejects unsupported schema versions", () => {
    const raw = JSON.stringify({
      schemaVersion: 2,
      scope: "global",
      exportedAt: "2026-03-25T00:00:00.000Z",
      global: createSnapshot(),
    });

    expect(parseSettingsExportJson(raw)).toEqual({
      ok: false,
      error: "Unsupported settings JSON version. Expected schemaVersion=1.",
    });
  });

  it("rejects invalid export scopes", () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      scope: "galactic",
      exportedAt: "2026-03-25T00:00:00.000Z",
    });

    expect(parseSettingsExportJson(raw)).toEqual({
      ok: false,
      error: "Invalid scope. Expected global, card, templates, or all.",
    });
  });

  it("rejects invalid template array entries", () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      scope: "templates",
      exportedAt: "2026-03-25T00:00:00.000Z",
      templates: [
        createTemplate(),
        {
          id: "broken-template",
          name: "Broken",
          createdAt: 1_700_000_001_000,
          snapshot: createSnapshot(),
        },
      ],
    });

    expect(parseSettingsExportJson(raw)).toEqual({
      ok: false,
      error: "Invalid templates payload.",
    });
  });
});

describe("user-page-settings-io local draft patch parsing", () => {
  it("salvages recoverable draft sections and normalizes them", () => {
    const parsed = parseLocalEditsPatch({
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
    });

    expect(parsed).toEqual({
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
    });
  });

  it("rejects draft patches whose custom-card overrides cannot be trusted", () => {
    const parsed = parseLocalEditsPatch({
      cardConfigs: {
        animeStats: {
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
    });

    expect(parsed).toBeNull();
  });
});

describe("user-page-settings-io export round trips", () => {
  it("round-trips global exports through stringify + parse", () => {
    const exported = makeSettingsExport({
      schemaVersion: 1,
      scope: "global",
      global: createSnapshot(),
    });

    expectIsoTimestamp(exported.exportedAt);

    const reparsed = parseSettingsExportJson(stringifySettingsExport(exported));

    expect(reparsed).toEqual({
      ok: true,
      value: { kind: "export", value: exported },
    });
  });

  it("round-trips card exports through stringify + parse", () => {
    const exported = makeSettingsExport({
      schemaVersion: 1,
      scope: "card",
      cardId: "animeStats",
      cardLabel: "Anime Stats",
      card: createSnapshot({ borderEnabled: false }),
    });

    expectIsoTimestamp(exported.exportedAt);

    const reparsed = parseSettingsExportJson(stringifySettingsExport(exported));

    expect(reparsed).toEqual({
      ok: true,
      value: { kind: "export", value: exported },
    });
  });

  it("round-trips templates exports through stringify + parse", () => {
    const templates = [
      createTemplate(),
      createTemplate({
        id: "template-2",
        name: "Aurora",
        snapshot: createSnapshot({
          colors: ["#abcdef", LINEAR_GRADIENT, "#fedcba", "#112233"],
        }),
      }),
    ];

    const exported = makeSettingsExport({
      schemaVersion: 1,
      scope: "templates",
      templates,
    });

    expectIsoTimestamp(exported.exportedAt);

    const reparsed = parseSettingsExportJson(stringifySettingsExport(exported));

    expect(reparsed).toEqual({
      ok: true,
      value: { kind: "export", value: exported },
    });
  });

  it("round-trips all exports through stringify + parse", () => {
    const exported = makeSettingsExport({
      schemaVersion: 1,
      scope: "all",
      global: createSnapshot({
        colors: ["#101010", "#202020", LINEAR_GRADIENT, "#404040"],
      }),
      templates: [createTemplate()],
    });

    expectIsoTimestamp(exported.exportedAt);

    const reparsed = parseSettingsExportJson(stringifySettingsExport(exported));

    expect(reparsed).toEqual({
      ok: true,
      value: { kind: "export", value: exported },
    });
  });
});

describe("user-page-settings-io workspace backup parsing", () => {
  it("round-trips workspace backups through stringify + parse", () => {
    const backup = makeWorkspaceBackup({
      userId: "42",
      username: "TestUser",
      workspace: {
        global: createSnapshot({
          colors: ["#101010", "#202020", LINEAR_GRADIENT, "#404040"],
        }),
        cardConfigs: {
          favoritesGrid: createCardConfig("favoritesGrid", {
            enabled: false,
            variant: "mixed",
          }),
          animeStats: createCardConfig("animeStats", {
            variant: "compact",
            colorOverride: {
              useCustomSettings: true,
              colorPreset: "custom",
              colors: ["#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd"],
            },
            advancedSettings: {
              gridCols: 4,
            },
          }),
        },
        cardOrder: ["favoritesGrid", "animeStats"],
      },
      editorState: {
        templates: [
          createTemplate({ id: "template-z", name: "Zenith" }),
          createTemplate({ id: "template-a", name: "Aurora" }),
        ],
        draft: {
          savedAt: 1_700_000_100_000,
          patch: {
            cardOrder: ["animeStats", "favoritesGrid"],
            cardConfigs: {
              animeStats: createCardConfig("animeStats", {
                enabled: false,
                variant: "compact",
              }),
            },
          },
        },
        exitSaveFallback: {
          savedAt: 1_700_000_100_500,
          reason: "send_beacon_failed",
        },
      },
    });

    expectIsoTimestamp(backup.exportedAt);

    const reparsed = parseWorkspaceBackupJson(stringifyWorkspaceBackup(backup));

    expect(reparsed).toEqual({
      ok: true,
      value: backup,
    });
  });

  it("rejects malformed workspace draft payloads", () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      scope: "workspace",
      exportedAt: "2026-03-25T00:00:00.000Z",
      workspace: {
        global: createSnapshot(),
        cardConfigs: {
          animeStats: createCardConfig("animeStats"),
        },
        cardOrder: ["animeStats"],
      },
      editorState: {
        templates: [createTemplate()],
        draft: {
          savedAt: 1_700_000_200_000,
          patch: {
            cardConfigs: {
              animeStats: {
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
        },
      },
    });

    expect(parseWorkspaceBackupJson(raw)).toEqual({
      ok: false,
      error: "Invalid workspace draft payload.",
    });
  });
});
