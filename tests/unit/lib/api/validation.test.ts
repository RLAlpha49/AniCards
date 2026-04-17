import "@/tests/unit/__setup__";

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const {
  getSchemaValidationIssueSummary,
  isValidUsername,
  validateCardData,
  validatePersistedUserRecord,
  validateUserData,
} = await import("@/lib/api/validation");

const originalConsoleWarn = console.warn;

async function readApiError(response: Response) {
  return (await response.json()) as {
    error: string;
    category: string;
    retryable: boolean;
    status: number;
    invalidCardNames?: string[];
    suggestions?: Record<string, string[]>;
  };
}

describe("lib/api/validation", () => {
  const endpoint = "/api/store-cards";
  const request = new Request(`https://anicards.test${endpoint}`, {
    method: "POST",
  });

  beforeEach(() => {
    console.warn = mock(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (..._args: unknown[]) => undefined,
    ) as typeof console.warn;
  });

  afterEach(() => {
    console.warn = originalConsoleWarn;
  });

  it("accepts valid user payloads and normalizes concurrency fields", () => {
    const result = validateUserData(
      {
        userId: "42",
        username: " Alex ",
        stats: { anime: true },
        ifMatchUpdatedAt: "2026-04-16T00:00:00Z",
        ifMatchRevision: "7",
        ifMatchSnapshotToken: "token-123",
      },
      endpoint,
      request,
    );

    expect(result).toEqual({
      success: true,
      data: {
        userId: 42,
        username: "Alex",
        stats: { anime: true },
        ifMatchUpdatedAt: "2026-04-16T00:00:00.000Z",
        ifMatchRevision: 7,
        ifMatchSnapshotToken: "token-123",
      },
    });
    expect(isValidUsername("User_Name-123")).toBe(true);
    expect(isValidUsername("bad@email.example")).toBe(false);
  });

  it("rejects unsupported top-level user payload fields", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const consoleWarn = mock((..._args: unknown[]) => undefined);
    console.warn = consoleWarn as typeof console.warn;

    const result = validateUserData(
      {
        userId: 42,
        stats: {},
        rogueField: true,
      },
      endpoint,
      request,
    );

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected user payload validation to fail.");
    }

    expect(await readApiError(result.error)).toMatchObject({
      error: "Invalid data",
      category: "invalid_data",
      retryable: false,
      status: 400,
    });
    expect(consoleWarn).toHaveBeenCalledTimes(1);
    expect(String(consoleWarn.mock.calls[0]?.[0])).toContain(
      "Request contains unsupported top-level fields",
    );
  });

  it("rejects invalid usernames and stats arrays in user payloads", async () => {
    const invalidUsernameResult = validateUserData(
      {
        userId: 42,
        username: "Alex@example.com",
        stats: {},
      },
      endpoint,
      request,
    );
    const invalidStatsResult = validateUserData(
      {
        userId: 42,
        stats: [],
      },
      endpoint,
      request,
    );

    expect(invalidUsernameResult.success).toBe(false);
    expect(invalidStatsResult.success).toBe(false);
    if (invalidUsernameResult.success || invalidStatsResult.success) {
      throw new Error("Expected invalid user payloads to fail validation.");
    }

    expect(await readApiError(invalidUsernameResult.error)).toMatchObject({
      error: "Invalid data",
      status: 400,
    });
    expect(await readApiError(invalidStatsResult.error)).toMatchObject({
      error: "Invalid data",
      status: 400,
    });
  });

  it("accepts valid card payloads, disabled cards, and typed optional fields", () => {
    const result = validateCardData(
      [
        {
          cardName: "animeStats",
          variation: "minimal",
          colorPreset: "default",
          borderColor: "#123456",
          borderRadius: 18,
          showFavorites: true,
          useStatusColors: false,
          showPiePercentages: true,
          gridCols: 5,
          gridRows: 2,
          useCustomSettings: false,
        },
        {
          cardName: "profileOverview",
          disabled: true,
        },
      ],
      42,
      endpoint,
      request,
    );

    expect(result).toEqual({
      success: true,
      cards: [
        {
          cardName: "animeStats",
          variation: "minimal",
          colorPreset: "default",
          titleColor: undefined,
          backgroundColor: undefined,
          textColor: undefined,
          circleColor: undefined,
          borderColor: "#123456",
          borderRadius: 18,
          showFavorites: true,
          useStatusColors: false,
          showPiePercentages: true,
          gridCols: 5,
          gridRows: 2,
          useCustomSettings: false,
          disabled: undefined,
        },
        {
          cardName: "profileOverview",
          variation: undefined,
          colorPreset: undefined,
          titleColor: undefined,
          backgroundColor: undefined,
          textColor: undefined,
          circleColor: undefined,
          borderColor: undefined,
          borderRadius: undefined,
          showFavorites: undefined,
          useStatusColors: undefined,
          showPiePercentages: undefined,
          gridCols: undefined,
          gridRows: undefined,
          useCustomSettings: undefined,
          disabled: true,
        },
      ],
    });
  });

  it("rejects invalid card type names with fuzzy suggestions", async () => {
    const result = validateCardData(
      [
        {
          cardName: "animeStatz",
          variation: "default",
          titleColor: "#111111",
          backgroundColor: "#222222",
          textColor: "#333333",
          circleColor: "#444444",
        },
      ],
      42,
      endpoint,
      request,
    );

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected invalid card type validation to fail.");
    }

    expect(await readApiError(result.error)).toMatchObject({
      error: "Invalid data: Invalid card type",
      invalidCardNames: ["animeStatz"],
      suggestions: expect.objectContaining({
        animeStatz: expect.arrayContaining(["animeStats"]),
      }),
      status: 400,
    });
  });

  it("rejects cards that are missing required custom colors", async () => {
    const result = validateCardData(
      [
        {
          cardName: "animeStats",
          variation: "default",
          colorPreset: "custom",
          titleColor: "#111111",
          backgroundColor: "#222222",
          textColor: "#333333",
        },
      ],
      42,
      endpoint,
      request,
    );

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected missing custom colors to fail validation.");
    }

    expect(await readApiError(result.error)).toMatchObject({
      error: "Invalid data",
      status: 400,
    });
  });

  it("rejects invalid optional boolean, grid, and border radius fields", async () => {
    const invalidBoolean = validateCardData(
      [
        {
          cardName: "animeStats",
          variation: "default",
          showFavorites: "yes",
        },
      ],
      42,
      endpoint,
      request,
    );
    const invalidGrid = validateCardData(
      [
        {
          cardName: "favoritesGrid",
          variation: "anime",
          gridCols: 9,
        },
      ],
      42,
      endpoint,
      request,
    );
    const invalidRadius = validateCardData(
      [
        {
          cardName: "animeStats",
          variation: "default",
          borderColor: "#123456",
          borderRadius: 999,
        },
      ],
      42,
      endpoint,
      request,
    );

    expect(invalidBoolean.success).toBe(false);
    expect(invalidGrid.success).toBe(false);
    expect(invalidRadius.success).toBe(false);
    if (
      invalidBoolean.success ||
      invalidGrid.success ||
      invalidRadius.success
    ) {
      throw new Error("Expected invalid optional field payloads to fail.");
    }

    expect(await readApiError(invalidBoolean.error)).toMatchObject({
      error: "Invalid data",
      status: 400,
    });
    expect(await readApiError(invalidGrid.error)).toMatchObject({
      error: "Invalid data",
      status: 400,
    });
    expect(await readApiError(invalidRadius.error)).toMatchObject({
      error: "Invalid data",
      status: 400,
    });
  });

  it("summarizes persisted user record validation issues", () => {
    const result = validatePersistedUserRecord({
      userId: "42",
      stats: {},
      createdAt: "2026-04-16T00:00:00.000Z",
      updatedAt: 123,
    } as never);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected persisted user record validation to fail.");
    }

    expect(getSchemaValidationIssueSummary(result.error)).toContain(":");
  });
});
