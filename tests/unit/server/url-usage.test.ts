import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  sharedRedisMockPipelineHincrby,
  sharedRedisMockPipelineExpire,
  sharedRedisMockPipelineExec,
} from "@/tests/unit/__setup__.test";
import { VARIATION_LABEL_MAP } from "@/lib/card-groups";
import {
  KNOWN_VARIATIONS,
  buildCardUrlProfile,
  buildCardUrlProfileKey,
  statusClass,
  trackCardUrlProfile,
  type CardUrlProfileInput,
} from "@/lib/server/url-usage";

/**
 * Builds a profile input with URL-complete defaults so each test only states
 * the fields it exercises.
 * @param overrides - Fields to replace on the default input.
 * @returns A complete CardUrlProfileInput.
 * @source
 */
function createProfileInput(
  overrides: Partial<CardUrlProfileInput> = {},
): CardUrlProfileInput {
  return {
    routePath: "/card.svg",
    cardType: "animeStats",
    baseCardType: "animeStats",
    variationParam: null,
    colorPresetParam: "anilistDark",
    titleColorParam: null,
    backgroundColorParam: null,
    textColorParam: null,
    circleColorParam: null,
    borderColorParam: null,
    borderRadiusParam: null,
    showFavoritesParam: null,
    statusColorsParam: null,
    piePercentagesParam: null,
    gridColsParam: null,
    gridRowsParam: null,
    classification: { source: "url" },
    ...overrides,
  };
}

describe("Card URL usage tracking", () => {
  beforeEach(() => {
    sharedRedisMockPipelineHincrby.mockReset();
    sharedRedisMockPipelineExpire.mockReset();
    sharedRedisMockPipelineExec.mockReset();
    sharedRedisMockPipelineExec.mockResolvedValue([]);
  });

  afterEach(() => {
    mock.clearAllMocks();
  });

  describe("Variation coverage", () => {
    it("should list every variation the UI can build", () => {
      const uiVariations = Object.keys(VARIATION_LABEL_MAP).sort();
      const trackedVariations = Array.from(KNOWN_VARIATIONS).sort();

      expect(trackedVariations).toEqual(uiVariations);
    });
  });

  describe("Profile construction", () => {
    it("should record the route path, card type, variation, and source", () => {
      const profile = buildCardUrlProfile(createProfileInput());

      expect(profile).toBe(
        "/card.svg?cardType=animeStats&variation=default&colorPreset=anilistDark&source=url",
      );
    });

    it("should keep both rewrite aliases distinct", () => {
      const aliasProfile = buildCardUrlProfile(
        createProfileInput({ routePath: "/api/card.svg" }),
      );

      expect(aliasProfile.startsWith("/api/card.svg?")).toBe(true);
    });

    it("should collapse unknown paths to /other", () => {
      const profile = buildCardUrlProfile(
        createProfileInput({ routePath: "/api/card" }),
      );

      expect(profile.startsWith("/api/card?")).toBe(true);
      expect(
        buildCardUrlProfile(createProfileInput({ routePath: "/unexpected" })),
      ).toContain("/other?");
    });

    it("should prefer the variation parameter over the card type suffix", () => {
      const profile = buildCardUrlProfile(
        createProfileInput({
          cardType: "animeGenres-pie",
          baseCardType: "animeGenres",
          variationParam: "bar",
        }),
      );

      expect(profile).toContain("variation=bar");
    });

    it("should read the variation from the card type suffix when absent", () => {
      const profile = buildCardUrlProfile(
        createProfileInput({
          cardType: "animeGenres-pie",
          baseCardType: "animeGenres",
        }),
      );

      expect(profile).toContain("variation=pie");
    });

    it("should mark unrecognized variations as unknown", () => {
      const profile = buildCardUrlProfile(
        createProfileInput({ variationParam: "sparkline" }),
      );

      expect(profile).toContain("variation=unknown");
    });

    it("should record a named preset by name and an unknown preset as unknown", () => {
      expect(
        buildCardUrlProfile(
          createProfileInput({ colorPresetParam: "default" }),
        ),
      ).toContain("colorPreset=default");

      expect(
        buildCardUrlProfile(
          createProfileInput({ colorPresetParam: "not-a-preset" }),
        ),
      ).toContain("colorPreset=unknown");
    });

    it("should record individual colors by presence, not by value", () => {
      const profile = buildCardUrlProfile(
        createProfileInput({
          colorPresetParam: null,
          titleColorParam: "#fe428e",
          backgroundColorParam: "#141321",
          textColorParam: "#a9fef7",
          circleColorParam: "#fe428e",
        }),
      );

      expect(profile).toContain("colors=explicit");
      expect(profile).not.toContain("#fe428e");
      expect(profile).not.toContain("titleColor");
    });

    it("should record a partial color set as none", () => {
      const profile = buildCardUrlProfile(
        createProfileInput({
          colorPresetParam: null,
          titleColorParam: "#fe428e",
        }),
      );

      expect(profile).toContain("colors=none");
    });

    it("should include flags only for the card types that use them", () => {
      const statsProfile = buildCardUrlProfile(createProfileInput());
      expect(statsProfile).not.toContain("showFavorites");
      expect(statsProfile).not.toContain("statusColors");
      expect(statsProfile).not.toContain("piePercentages");

      const favoritesProfile = buildCardUrlProfile(
        createProfileInput({
          cardType: "animeStaff",
          baseCardType: "animeStaff",
          showFavoritesParam: "true",
        }),
      );
      expect(favoritesProfile).toContain("showFavorites=true");

      const statusProfile = buildCardUrlProfile(
        createProfileInput({
          cardType: "animeStatusDistribution",
          baseCardType: "animeStatusDistribution",
          statusColorsParam: "false",
        }),
      );
      expect(statusProfile).toContain("statusColors=false");

      const pieProfile = buildCardUrlProfile(
        createProfileInput({
          cardType: "animeGenres",
          baseCardType: "animeGenres",
          variationParam: "pie",
          piePercentagesParam: "true",
        }),
      );
      expect(pieProfile).toContain("piePercentages=true");
    });

    it("should record an absent flag as unset", () => {
      const profile = buildCardUrlProfile(
        createProfileInput({
          cardType: "animeStaff",
          baseCardType: "animeStaff",
        }),
      );

      expect(profile).toContain("showFavorites=unset");
    });

    it("should clamp favorites grid dimensions the way the renderer does", () => {
      const profile = buildCardUrlProfile(
        createProfileInput({
          cardType: "favoritesGrid",
          baseCardType: "favoritesGrid",
          gridColsParam: "03",
          gridRowsParam: "9",
        }),
      );

      expect(profile).toContain("gridCols=3");
      expect(profile).toContain("gridRows=5");
    });

    it("should record border settings without leaking color values", () => {
      const profile = buildCardUrlProfile(
        createProfileInput({
          borderColorParam: "#3cc8ff",
          borderRadiusParam: "6.25",
        }),
      );

      expect(profile).toContain("borderColor=set");
      expect(profile).toContain("borderRadius=6");
      expect(profile).not.toContain("#3cc8ff");
    });

    it("should clamp border radius the way the renderer does", () => {
      const profile = buildCardUrlProfile(
        createProfileInput({ borderRadiusParam: "150" }),
      );

      expect(profile).toContain("borderRadius=100");
    });

    it("should record the configuration source and reason", () => {
      const profile = buildCardUrlProfile(
        createProfileInput({
          colorPresetParam: "custom",
          classification: { source: "db", reason: "custom_preset" },
        }),
      );

      expect(profile).toContain("source=db");
      expect(profile).toContain("reason=custom_preset");
    });

    it("should omit the reason when the URL is complete", () => {
      const profile = buildCardUrlProfile(createProfileInput());

      expect(profile).toContain("source=url");
      expect(profile).not.toContain("reason=");
    });

    it("should never include user identifiers or cache busters", () => {
      const profile = buildCardUrlProfile(createProfileInput());

      expect(profile).not.toContain("userId");
      expect(profile).not.toContain("userName");
      expect(profile).not.toContain("_t");
    });
  });

  describe("Daily buckets", () => {
    it("should key buckets by UTC day", () => {
      const key = buildCardUrlProfileKey(new Date("2026-10-14T23:59:59.000Z"));

      expect(key).toBe("card_url_profiles:2026-10-14");
    });

    it("should classify status codes into coarse classes", () => {
      expect(statusClass(200)).toBe("2xx");
      expect(statusClass(304)).toBe("3xx");
      expect(statusClass(404)).toBe("4xx");
      expect(statusClass(500)).toBe("5xx");
      expect(statusClass(0)).toBe("other");
    });
  });

  describe("Recording", () => {
    it("should increment the profile field and set a non-sliding TTL", async () => {
      await trackCardUrlProfile("/card.svg?cardType=animeStats&source=url", {
        cache: "hit",
        status: 200,
      });

      expect(sharedRedisMockPipelineHincrby).toHaveBeenCalledWith(
        expect.stringMatching(/^card_url_profiles:\d{4}-\d{2}-\d{2}$/),
        "/card.svg?cardType=animeStats&source=url|cache=hit|status=2xx",
        1,
      );
      expect(sharedRedisMockPipelineExpire).toHaveBeenCalledWith(
        expect.stringMatching(/^card_url_profiles:\d{4}-\d{2}-\d{2}$/),
        90 * 24 * 60 * 60,
        "NX",
      );
      expect(sharedRedisMockPipelineExec).toHaveBeenCalled();
    });

    it("should record the cache outcome and status class", async () => {
      await trackCardUrlProfile("/card.svg?cardType=animeStats&source=db", {
        cache: "miss",
        status: 404,
      });

      expect(sharedRedisMockPipelineHincrby).toHaveBeenCalledWith(
        expect.any(String),
        "/card.svg?cardType=animeStats&source=db|cache=miss|status=4xx",
        1,
      );
    });

    it("should swallow Redis failures so card responses are unaffected", async () => {
      sharedRedisMockPipelineExec.mockRejectedValueOnce(
        new Error("redis unavailable"),
      );

      await expect(
        trackCardUrlProfile("/card.svg?cardType=animeStats&source=url", {
          cache: "miss",
          status: 200,
        }),
      ).resolves.toBeUndefined();
    });
  });
});
