import "@/tests/unit/__setup__";

import { describe, expect, it } from "bun:test";

import {
  buildCardUrlWithParams,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";

function readCardUrl(url: string): URL {
  return new URL(url);
}

describe("card group URL helpers", () => {
  it("maps stored configs to profile overview params with safe defaults and legacy username support", () => {
    // Arrange
    const storedConfig = {
      cardName: "profileOverview-compact",
      variation: "minimal",
      borderColor: "#ffffff",
      borderRadius: 120.49,
      titleColor: "#111111",
      backgroundColor: "#222222",
      textColor: "#333333",
      circleColor: "#444444",
    };

    // Act
    const params = mapStoredConfigToCardUrlParams(storedConfig, {
      includeColors: true,
      userName: "LegacyUser",
    });

    // Assert
    expect(params).toEqual({
      cardType: "profileOverview-compact",
      userId: undefined,
      username: "LegacyUser",
      variation: "default",
      colorPreset: "custom",
      borderColor: "#ffffff",
      borderRadius: 100,
      titleColor: "#111111",
      backgroundColor: "#222222",
      textColor: "#333333",
      circleColor: "#444444",
    });
  });

  it("keeps named presets authoritative when preset color overrides are disabled", () => {
    // Arrange
    const storedConfig = {
      cardName: "animeStats",
      colorPreset: "sunset",
      titleColor: "#111111",
      backgroundColor: "#222222",
      textColor: "#333333",
      circleColor: "#444444",
    };

    // Act
    const params = mapStoredConfigToCardUrlParams(storedConfig, {
      includeColors: true,
      allowPresetColorOverrides: false,
      username: "Alpha49",
    });

    // Assert
    expect(params).toEqual({
      cardType: "animeStats",
      userId: undefined,
      username: "Alpha49",
      variation: "default",
      colorPreset: "sunset",
      borderColor: undefined,
      borderRadius: undefined,
    });
  });

  it("adds branch-specific defaults for favorites, status colors, pie percentages, and favorites grid bounds", () => {
    // Arrange
    const favoritesParams = mapStoredConfigToCardUrlParams({
      cardName: "animeStaff",
    });
    const statusParams = mapStoredConfigToCardUrlParams({
      cardName: "animeStatusDistribution",
      useStatusColors: true,
      variation: "bar",
    });
    const pieParams = mapStoredConfigToCardUrlParams({
      cardName: "animeGenres",
      variation: "pie",
    });
    const gridParams = mapStoredConfigToCardUrlParams({
      cardName: "favoritesGrid",
      gridCols: 9.8,
      gridRows: 0.2,
    });

    // Act
    const result = {
      favorites: favoritesParams.showFavorites,
      statusColors: statusParams.statusColors,
      piePercentages: pieParams.piePercentages,
      gridCols: gridParams.gridCols,
      gridRows: gridParams.gridRows,
    };

    // Assert
    expect(result).toEqual({
      favorites: false,
      statusColors: true,
      piePercentages: false,
      gridCols: 5,
      gridRows: 1,
    });
  });

  it("serializes false booleans, zero values, and legacy usernames into the card URL", () => {
    // Arrange
    const baseUrl = "https://cards.example.test/card.svg";
    const params = {
      cardType: "animeStaff",
      userName: "LegacyUser",
      variation: "default",
      colorPreset: "custom",
      titleColor: "#ffffff",
      borderColor: "#000000",
      borderRadius: 0,
      showFavorites: false,
      statusColors: false,
      piePercentages: false,
      gridCols: 3,
      gridRows: 2,
    };

    // Act
    const url = readCardUrl(buildCardUrlWithParams(params, baseUrl));

    // Assert
    expect(url.origin + url.pathname).toBe(baseUrl);
    expect(url.searchParams.get("username")).toBe("LegacyUser");
    expect(url.searchParams.get("cardType")).toBe("animeStaff");
    expect(url.searchParams.get("showFavorites")).toBe("false");
    expect(url.searchParams.get("statusColors")).toBe("false");
    expect(url.searchParams.get("piePercentages")).toBe("false");
    expect(url.searchParams.get("borderRadius")).toBe("0");
    expect(url.searchParams.get("gridCols")).toBe("3");
    expect(url.searchParams.get("gridRows")).toBe("2");
    expect(url.searchParams.get("titleColor")).toBe("#ffffff");
  });

  it("omits empty string parameters from the built card URL", () => {
    // Arrange
    const params = {
      cardType: "animeStats",
      username: "Alpha49",
      variation: "",
      colorPreset: undefined,
      titleColor: "",
      backgroundColor: undefined,
      textColor: "",
      circleColor: undefined,
    };

    // Act
    const url = readCardUrl(
      buildCardUrlWithParams(params, "https://cards.example.test/card.svg"),
    );

    // Assert
    expect(url.searchParams.get("cardType")).toBe("animeStats");
    expect(url.searchParams.get("username")).toBe("Alpha49");
    expect(url.searchParams.has("variation")).toBe(false);
    expect(url.searchParams.has("colorPreset")).toBe(false);
    expect(url.searchParams.has("titleColor")).toBe(false);
    expect(url.searchParams.has("textColor")).toBe(false);
  });
});
