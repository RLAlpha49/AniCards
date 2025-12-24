import { test as base, Route } from "@playwright/test";
import {
  mockUserRecord,
  mockCardsRecord,
  mockRateLimitError,
  mockUserNotFoundError,
} from "./mock-data";

/**
 * Custom fixture types for AniCards E2E tests.
 */
export interface AniCardsFixtures {
  /** Mocks the API responses for successful scenarios */
  mockSuccessfulApi: void;
  /** Mocks the API to return rate limit error */
  mockRateLimitedApi: void;
  /** Mocks the API to return user not found error */
  mockUserNotFoundApi: void;
  /** Mocks the API to simulate network error */
  mockNetworkError: void;
}

/**
 * Extended test with AniCards-specific fixtures.
 */
export const test = base.extend<AniCardsFixtures>({
  mockSuccessfulApi: async ({ page }, use) => {
    // Mock the card API endpoint
    await page.route("**/api/card**", async (route: Route) => {
      const url = new URL(route.request().url());
      const username = url.searchParams.get("username");

      if (!username) {
        await route.fulfill({
          status: 400,
          contentType: "image/svg+xml",
          body: createErrorSvg("Missing username parameter"),
        });
        return;
      }

      // Return a mock SVG card
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: createMockCardSvg(username),
        headers: {
          "Access-Control-Allow-Origin": "*",
          "X-Card-Border-Radius": "8",
        },
      });
    });

    // Mock the get-user API endpoint
    await page.route("**/api/get-user**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUserRecord),
      });
    });

    // Mock the get-cards API endpoint
    await page.route("**/api/get-cards**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockCardsRecord),
      });
    });

    // Mock the store-cards API endpoint
    await page.route("**/api/store-cards**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    // Mock the store-users API endpoint
    await page.route("**/api/store-users**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await use();
  },

  mockRateLimitedApi: async ({ page }, use) => {
    await page.route("**/api/card**", async (route: Route) => {
      await route.fulfill({
        status: 429,
        contentType: "image/svg+xml",
        body: createErrorSvg("Rate limit exceeded"),
        headers: {
          "Retry-After": "60",
        },
      });
    });

    await page.route("**/api/get-user**", async (route: Route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify(mockRateLimitError),
      });
    });

    await use();
  },

  mockUserNotFoundApi: async ({ page }, use) => {
    await page.route("**/api/card**", async (route: Route) => {
      await route.fulfill({
        status: 404,
        contentType: "image/svg+xml",
        body: createErrorSvg("User not found"),
      });
    });

    await page.route("**/api/get-user**", async (route: Route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify(mockUserNotFoundError),
      });
    });

    await use();
  },

  mockNetworkError: async ({ page }, use) => {
    await page.route("**/api/**", async (route: Route) => {
      await route.abort("failed");
    });

    await use();
  },
});

/**
 * Create a mock SVG card for testing.
 */
function createMockCardSvg(username: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="800" height="400" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
  <style>
    .title { font-family: monospace; font-size: 24px; fill: #ffffff; }
    .stat { font-family: monospace; font-size: 16px; fill: #eaeaea; }
  </style>
  <rect width="100%" height="100%" fill="#1a1a2e" rx="8"/>
  <text x="50" y="50" class="title">${username}'s Anime Stats</text>
  <text x="50" y="100" class="stat">Episodes Watched: 3500</text>
  <text x="50" y="130" class="stat">Mean Score: 75.5</text>
  <text x="50" y="160" class="stat">Total Anime: 250</text>
  <circle cx="650" cy="200" r="80" fill="none" stroke="#4a9eff" stroke-width="8"/>
</svg>`;
}

/**
 * Create an error SVG for testing error states.
 */
function createErrorSvg(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="800" height="400" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
  <style>
    .error-text { font-family: monospace; font-size: 20px; fill: #ff5555; }
  </style>
  <rect width="100%" height="100%" fill="#1a1a1a"/>
  <text x="50%" y="50%" class="error-text" text-anchor="middle" dominant-baseline="middle">
    ${message}
  </text>
</svg>`;
}

export { expect } from "@playwright/test";
