import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { colorPresets } from "@/components/stat-card-generator/constants";
import { buildPreviewUrl } from "@/components/user/tile/buildPreviewUrl";
import type { CardAdvancedSettings } from "@/lib/stores/user-page-editor";
import type { ColorValue } from "@/lib/types/card";
import { createCardConfig } from "@/tests/unit/hooks/test-helpers";

const originalConsoleWarn = console.warn;
const consoleWarnMock = mock(() => undefined);

const DEFAULT_EFFECTIVE_COLORS: ColorValue[] = [
  "#111111",
  "#222222",
  "#333333",
  "#444444",
];

type BuildPreviewUrlArgs = Parameters<typeof buildPreviewUrl>[0];

function createGlobalAdvancedSettings(
  overrides: Partial<CardAdvancedSettings> = {},
): CardAdvancedSettings {
  return {
    useStatusColors: true,
    showPiePercentages: true,
    showFavorites: true,
    gridCols: 3,
    gridRows: 3,
    ...overrides,
  };
}

function createBuildPreviewUrlArgs(
  overrides: Partial<BuildPreviewUrlArgs> = {},
): BuildPreviewUrlArgs {
  return {
    userId: "42",
    cardId: "animeStats",
    config: createCardConfig("animeStats"),
    urlColorPreset: undefined,
    effectiveColors: [...DEFAULT_EFFECTIVE_COLORS],
    effectiveBorderColor: undefined,
    effectiveBorderRadius: 8,
    globalAdvancedSettings: createGlobalAdvancedSettings(),
    ...overrides,
  };
}

function getPreviewSearchParams(
  overrides: Partial<BuildPreviewUrlArgs> = {},
): URLSearchParams {
  const url = buildPreviewUrl(createBuildPreviewUrlArgs(overrides));

  if (!url) {
    throw new Error("Expected buildPreviewUrl to return a preview URL.");
  }

  return new URL(url).searchParams;
}

beforeEach(() => {
  consoleWarnMock.mockReset();
  console.warn = consoleWarnMock as typeof console.warn;
});

afterEach(() => {
  console.warn = originalConsoleWarn;
});

describe("buildPreviewUrl", () => {
  it("returns null when the preview cannot be tied to a user", () => {
    const previewUrl = buildPreviewUrl(
      createBuildPreviewUrlArgs({
        userId: null,
      }),
    );

    expect(previewUrl).toBeNull();
  });

  it("uses global advanced settings when the card is not using custom settings", () => {
    const params = getPreviewSearchParams({
      cardId: "favoritesGrid",
      config: createCardConfig("favoritesGrid", {
        variant: "mixed",
        colorOverride: {
          useCustomSettings: false,
        },
        advancedSettings: {
          gridCols: 1,
          gridRows: 5,
        },
      }),
      globalAdvancedSettings: createGlobalAdvancedSettings({
        gridCols: 4,
        gridRows: 2,
      }),
    });

    expect(params.get("gridCols")).toBe("4");
    expect(params.get("gridRows")).toBe("2");
  });

  it("uses per-card advanced settings with global fallback when custom settings are enabled", () => {
    const params = getPreviewSearchParams({
      cardId: "animeStatusDistribution",
      config: createCardConfig("animeStatusDistribution", {
        variant: "pie",
        colorOverride: {
          useCustomSettings: true,
        },
        advancedSettings: {
          useStatusColors: false,
        },
      }),
      globalAdvancedSettings: createGlobalAdvancedSettings({
        useStatusColors: true,
        showPiePercentages: true,
      }),
    });

    expect(params.get("statusColors")).toBe("false");
    expect(params.get("piePercentages")).toBe("true");
  });

  it("fills missing preview colors from the default preset and warns once", () => {
    const defaultColors = colorPresets.default.colors as [
      ColorValue,
      ColorValue,
      ColorValue,
      ColorValue,
    ];

    const params = getPreviewSearchParams({
      effectiveColors: ["#101010"],
    });

    expect(consoleWarnMock).toHaveBeenCalledWith(
      "[buildPreviewUrl] effectiveColors has 1 entries; expected >=4. Filling missing values with defaults.",
    );
    expect(params.get("titleColor")).toBe("#101010");
    expect(params.get("backgroundColor")).toBe(String(defaultColors[1]));
    expect(params.get("textColor")).toBe(String(defaultColors[2]));
    expect(params.get("circleColor")).toBe(String(defaultColors[3]));
  });

  it("omits explicit color params when the preview is pinned to a named preset", () => {
    const params = getPreviewSearchParams({
      urlColorPreset: "anilistDarkGradient",
      effectiveColors: ["#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd"],
    });

    expect(params.get("colorPreset")).toBe("anilistDarkGradient");
    expect(params.get("titleColor")).toBeNull();
    expect(params.get("backgroundColor")).toBeNull();
    expect(params.get("textColor")).toBeNull();
    expect(params.get("circleColor")).toBeNull();
  });
});
