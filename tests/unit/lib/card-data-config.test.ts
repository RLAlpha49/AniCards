import { describe, expect, it } from "bun:test";

import { colorPresets } from "@/components/stat-card-generator/constants";
import {
  buildCardConfigFromParams,
  isCustomPreset,
  needsCardConfigFromDb,
  processCardConfig,
  resolveEffectiveColorPreset,
} from "@/lib/card-data/config";
import { CardDataError } from "@/lib/card-data/validation";
import type { CardsRecord, UserRecord } from "@/lib/types/records";
import { clampBorderRadius } from "@/lib/utils";
import { mockUserRecord } from "@/tests/e2e/fixtures/mock-data";

function createUserRecord(): UserRecord {
  return structuredClone(mockUserRecord);
}

describe("card-data config lookup decisions", () => {
  it("requires the database when a custom preset link omits explicit colors", () => {
    expect(
      needsCardConfigFromDb({
        colorPresetParam: "custom",
        titleColorParam: "#ffffff",
        backgroundColorParam: null,
        textColorParam: "#111111",
        circleColorParam: "#222222",
        baseCardType: "animeStats",
        variationParam: null,
      }),
    ).toBe(true);
  });

  it("requires the database when a relevant runtime flag is missing", () => {
    expect(
      needsCardConfigFromDb({
        colorPresetParam: "anilistDark",
        baseCardType: "animeStaff",
        variationParam: "default",
        showFavoritesParam: null,
      }),
    ).toBe(true);

    expect(
      needsCardConfigFromDb({
        colorPresetParam: "anilistDark",
        baseCardType: "favoritesGrid",
        variationParam: "default",
        gridColsParam: "3",
        gridRowsParam: null,
      }),
    ).toBe(true);
  });

  it("skips the database when params fully resolve colors and relevant flags", () => {
    expect(
      needsCardConfigFromDb({
        colorPresetParam: "anilistDark",
        baseCardType: "animeStatusDistribution",
        variationParam: "pie",
        statusColorsParam: "false",
        piePercentagesParam: "true",
      }),
    ).toBe(false);

    expect(
      needsCardConfigFromDb({
        colorPresetParam: "custom",
        titleColorParam: "#ff0000",
        backgroundColorParam: "#000000",
        textColorParam: "#ffffff",
        circleColorParam: "#00ff00",
        baseCardType: "animeStaff",
        variationParam: "default",
        showFavoritesParam: "false",
      }),
    ).toBe(false);
  });
});

describe("card-data config helpers", () => {
  it("prefers the URL preset when resolving the effective preset", () => {
    expect(resolveEffectiveColorPreset("custom", "anilistDark")).toBe("custom");
    expect(resolveEffectiveColorPreset(null, "anilistDark")).toBe(
      "anilistDark",
    );
    expect(resolveEffectiveColorPreset(null, undefined)).toBeUndefined();
    expect(isCustomPreset("custom")).toBe(true);
    expect(isCustomPreset("anilistDark")).toBe(false);
  });

  it("builds a config from a named preset with explicit URL overrides", () => {
    const config = buildCardConfigFromParams({
      cardType: "animeStatusDistribution",
      baseCardType: "animeStatusDistribution",
      variationParam: "pie",
      showFavoritesParam: null,
      statusColorsParam: "false",
      piePercentagesParam: "true",
      colorPresetParam: "anilistDark",
      titleColorParam: "#ff00ff",
      backgroundColorParam: null,
      textColorParam: null,
      circleColorParam: null,
      borderColorParam: "#123456",
      borderRadiusParam: "999",
    });

    expect(config).toMatchObject({
      cardName: "animeStatusDistribution",
      variation: "pie",
      colorPreset: "anilistDark",
      titleColor: "#ff00ff",
      backgroundColor: colorPresets.anilistDark.colors[1],
      textColor: colorPresets.anilistDark.colors[2],
      circleColor: colorPresets.anilistDark.colors[3],
      borderColor: "#123456",
      borderRadius: clampBorderRadius(999),
      useStatusColors: false,
      showPiePercentages: true,
    });
  });

  it("clamps favorites grid dimensions when building config from params", () => {
    const config = buildCardConfigFromParams({
      cardType: "favoritesGrid",
      baseCardType: "favoritesGrid",
      variationParam: null,
      showFavoritesParam: null,
      statusColorsParam: null,
      piePercentagesParam: null,
      colorPresetParam: "custom",
      titleColorParam: "#111111",
      backgroundColorParam: "#222222",
      textColorParam: "#333333",
      circleColorParam: "#444444",
      gridColsParam: "99",
      gridRowsParam: "oops",
    });

    expect(config.gridCols).toBe(5);
    expect(config.gridRows).toBe(3);
  });
});

describe("card-data processCardConfig", () => {
  const baseParams = {
    numericUserId: 123456,
    variationParam: null,
    showFavoritesParam: null,
    statusColorsParam: null,
    piePercentagesParam: null,
  } as const;

  it("merges global settings before applying runtime favorites logic", () => {
    const cardDoc: CardsRecord = {
      userId: 123456,
      updatedAt: "2026-03-29T00:00:00.000Z",
      cards: [{ cardName: "animeStaff" }],
      globalSettings: {
        colorPreset: "anilistDark",
        borderEnabled: true,
        borderColor: "#123456",
        borderRadius: 999,
        showFavorites: true,
      },
    };

    const { cardConfig, effectiveVariation, favorites } = processCardConfig(
      cardDoc,
      {
        ...baseParams,
        cardType: "animeStaff",
        baseCardType: "animeStaff",
      },
      createUserRecord(),
    );

    expect(effectiveVariation).toBe("default");
    expect(cardConfig).toMatchObject({
      colorPreset: "anilistDark",
      titleColor: colorPresets.anilistDark.colors[0],
      backgroundColor: colorPresets.anilistDark.colors[1],
      textColor: colorPresets.anilistDark.colors[2],
      circleColor: colorPresets.anilistDark.colors[3],
      borderColor: "#123456",
      borderRadius: clampBorderRadius(999),
      showFavorites: true,
    });
    expect(favorites).toEqual([
      "Hiroyuki Sawano",
      "Yuki Kajiura",
      "Kevin Penkin",
    ]);
  });

  it("lets fully-specified custom URL colors override stored custom colors", () => {
    const cardDoc: CardsRecord = {
      userId: 123456,
      updatedAt: "2026-03-29T00:00:00.000Z",
      cards: [
        {
          cardName: "favoritesGrid",
          variation: "default",
          colorPreset: "custom",
          titleColor: "#111111",
          backgroundColor: "#222222",
          textColor: "#333333",
          circleColor: "#444444",
          gridCols: 2,
          gridRows: 4,
        },
      ],
    };

    const { cardConfig } = processCardConfig(
      cardDoc,
      {
        ...baseParams,
        cardType: "favoritesGrid",
        baseCardType: "favoritesGrid",
        colorPresetParam: "custom",
        titleColorParam: "#aaaaaa",
        backgroundColorParam: "#bbbbbb",
        textColorParam: "#cccccc",
        circleColorParam: "#dddddd",
        gridColsParam: "0",
        gridRowsParam: "99",
      },
      createUserRecord(),
    );

    expect(cardConfig.titleColor).toBe("#aaaaaa");
    expect(cardConfig.backgroundColor).toBe("#bbbbbb");
    expect(cardConfig.textColor).toBe("#cccccc");
    expect(cardConfig.circleColor).toBe("#dddddd");
    expect(cardConfig.gridCols).toBe(1);
    expect(cardConfig.gridRows).toBe(5);
  });

  it("throws a 404 when the requested card config is absent", () => {
    const cardDoc: CardsRecord = {
      userId: 123456,
      updatedAt: "2026-03-29T00:00:00.000Z",
      cards: [{ cardName: "animeStats" }],
    };

    let error: unknown;
    try {
      processCardConfig(
        cardDoc,
        {
          ...baseParams,
          cardType: "animeGenres",
          baseCardType: "animeGenres",
        },
        createUserRecord(),
      );
    } catch (error_) {
      error = error_;
    }

    expect(error).toBeInstanceOf(CardDataError);
    expect((error as CardDataError).status).toBe(404);
    expect((error as CardDataError).message).toBe(
      "Not Found: Card config not found. Try to regenerate the card.",
    );
  });
});
