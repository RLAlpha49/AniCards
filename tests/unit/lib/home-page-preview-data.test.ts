import { describe, expect, it } from "bun:test";

import {
  HOME_CARD_MARQUEE_ROWS,
  HOME_HERO_PREVIEW_CARDS,
} from "@/lib/home-page-preview-data";

describe("home page preview data", () => {
  it("keeps the hero preview cards fully dimensioned for stable placeholders", () => {
    expect(HOME_HERO_PREVIEW_CARDS).toHaveLength(3);

    expect(HOME_HERO_PREVIEW_CARDS).toEqual([
      expect.objectContaining({
        cardType: "animeStats",
        height: 195,
        width: 450,
      }),
      expect.objectContaining({
        cardType: "animeGenres",
        height: 205,
        width: 340,
      }),
      expect.objectContaining({
        cardType: "socialStats",
        height: 195,
        width: 280,
      }),
    ]);

    for (const card of HOME_HERO_PREVIEW_CARDS) {
      expect(card.previewUrls.light).toMatch(/\/card\.svg\?/);
      expect(card.previewUrls.dark).toMatch(/\/card\.svg\?/);
    }
  });

  it("builds two marquee rows without favorites-grid entries and preserves explicit dimensions", () => {
    expect(HOME_CARD_MARQUEE_ROWS).toHaveLength(2);

    const flatCards = HOME_CARD_MARQUEE_ROWS.flat();

    expect(flatCards.length).toBeGreaterThan(10);
    expect(new Set(flatCards.map((card) => card.key)).size).toBe(
      flatCards.length,
    );
    expect(
      flatCards.some((card) => card.key.startsWith("favoritesGrid-")),
    ).toBe(false);

    for (const card of flatCards) {
      expect(card.width).toBeGreaterThan(0);
      expect(card.height).toBeGreaterThan(0);
      expect(card.previewUrls.light).toMatch(/\/card\.svg\?/);
      expect(card.previewUrls.dark).toMatch(/\/card\.svg\?/);
    }
  });
});
