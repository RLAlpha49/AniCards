import { describe, expect, it } from "bun:test";

import { statCardTypes } from "@/lib/card-types";
import type { SettingsSnapshot } from "@/lib/user-page-settings-io";
import {
  buildNewUserStarterCardsSnapshot,
  buildNewUserStarterGlobalSettings,
  NEW_USER_STARTER_GLOBAL_SETTINGS,
} from "@/lib/user-page-starters";

function getSeededCard(
  cards: ReturnType<typeof buildNewUserStarterCardsSnapshot>,
  cardName: string,
) {
  const card = cards.find((candidate) => candidate.cardName === cardName);

  if (!card) {
    throw new Error(`Expected starter seed to include ${cardName}.`);
  }

  return card;
}

describe("user-page-starters", () => {
  it("returns a fresh copy of the default global starter settings when no snapshot is provided", () => {
    const starterGlobals = buildNewUserStarterGlobalSettings();

    expect(starterGlobals).toEqual(NEW_USER_STARTER_GLOBAL_SETTINGS);
    expect(starterGlobals).not.toBe(NEW_USER_STARTER_GLOBAL_SETTINGS);

    starterGlobals.gridCols = 1;

    expect(buildNewUserStarterGlobalSettings()).toEqual(
      NEW_USER_STARTER_GLOBAL_SETTINGS,
    );
  });

  it("preserves explicit false flags while clamping border radius and filling missing advanced defaults", () => {
    const snapshot = {
      colorPreset: "sunset",
      colors: ["#010101", "#020202", "#030303", "#040404"],
      borderEnabled: true,
      borderColor: "#123456",
      borderRadius: 999,
      advancedSettings: {
        useStatusColors: false,
        showPiePercentages: false,
        showFavorites: false,
      },
    } satisfies SettingsSnapshot;

    const starterGlobals = buildNewUserStarterGlobalSettings(snapshot);

    expect(starterGlobals).toEqual({
      colorPreset: "sunset",
      titleColor: "#010101",
      backgroundColor: "#020202",
      textColor: "#030303",
      circleColor: "#040404",
      borderEnabled: true,
      borderColor: "#123456",
      borderRadius: 100,
      useStatusColors: false,
      showPiePercentages: false,
      showFavorites: false,
      gridCols: 3,
      gridRows: 3,
    });
  });

  it("applies the selected preset to every seeded starter card", () => {
    const snapshot = {
      colorPreset: "arcticAurora",
      colors: ["#010101", "#020202", "#030303", "#040404"],
      borderEnabled: false,
      borderColor: "#e4e2e2",
      borderRadius: 8,
      advancedSettings: {},
    } satisfies SettingsSnapshot;

    const cards = buildNewUserStarterCardsSnapshot(snapshot);

    expect(cards).toHaveLength(statCardTypes.length);

    for (const card of cards) {
      expect(card.colorPreset).toBe("arcticAurora");
    }
  });

  it("enables only the curated starter subset while preserving canonical default variations", () => {
    const cards = buildNewUserStarterCardsSnapshot();

    expect(getSeededCard(cards, "animeStats")).toMatchObject({
      disabled: undefined,
      variation: "default",
    });
    expect(getSeededCard(cards, "favoritesGrid")).toMatchObject({
      disabled: undefined,
      variation: "mixed",
    });
    expect(getSeededCard(cards, "statusCompletionOverview")).toMatchObject({
      disabled: undefined,
      variation: "combined",
    });
    expect(getSeededCard(cards, "animeGenres")).toMatchObject({
      disabled: true,
      variation: "default",
    });
  });
});
