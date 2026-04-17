/**
 * Playwright fixtures that package common AniCards API states for E2E specs.
 * Specs opt into these fixtures instead of repeating route mocks so scenario
 * setup stays readable and consistent across happy-path and failure flows.
 */

import { Page, Route, test as base } from "@playwright/test";

import {
  mockBootstrapUserRecord,
  mockCardsRecord,
  mockRateLimitError,
  mockUserNotFoundError,
} from "./mock-data";

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

type ApiRouteHandler = (route: Route) => Promise<void> | void;

export interface SuccessfulApiRouteOverrides {
  card?: ApiRouteHandler;
  getUser?: ApiRouteHandler;
  getCards?: ApiRouteHandler;
  storeCards?: ApiRouteHandler;
  storeUsers?: ApiRouteHandler;
}

export async function mockSuccessfulApiRoutes(
  page: Page,
  overrides: SuccessfulApiRouteOverrides = {},
): Promise<void> {
  await page.route(
    "**/api/card**",
    overrides.card ?? fulfillSuccessfulCardRoute,
  );
  await page.route(
    "**/api/get-user**",
    overrides.getUser ?? fulfillSuccessfulGetUserRoute,
  );
  await page.route(
    "**/api/get-cards**",
    overrides.getCards ?? fulfillSuccessfulGetCardsRoute,
  );
  await page.route(
    "**/api/store-cards**",
    overrides.storeCards ?? fulfillSuccessfulStoreCardsRoute,
  );
  await page.route(
    "**/api/store-users**",
    overrides.storeUsers ?? fulfillSuccessfulStoreUsersRoute,
  );
}

export const test = base.extend<AniCardsFixtures>({
  mockSuccessfulApi: async ({ page }, useFixture) => {
    await mockSuccessfulApiRoutes(page);

    await useFixture();
  },

  mockRateLimitedApi: async ({ page }, useFixture) => {
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

    await useFixture();
  },

  mockUserNotFoundApi: async ({ page }, useFixture) => {
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

    await page.route("**/api/anilist", async (route: Route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify(mockUserNotFoundError),
      });
    });

    await useFixture();
  },

  mockNetworkError: async ({ page }, useFixture) => {
    await page.route("**/api/**", async (route: Route) => {
      await route.abort("failed");
    });

    await useFixture();
  },
});

async function fulfillSuccessfulCardRoute(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const username = url.searchParams.get("username")?.trim() ?? null;
  const userId = url.searchParams.get("userId")?.trim() ?? null;

  if (!username && !userId) {
    await route.fulfill({
      status: 400,
      contentType: "image/svg+xml",
      body: createErrorSvg("Missing userId or username parameter"),
    });
    return;
  }

  const previewIdentity = username || `User ${userId}`;

  await route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: createMockCardSvg(previewIdentity),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "X-Card-Border-Radius": "8",
    },
  });
}

async function fulfillSuccessfulGetUserRoute(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(mockBootstrapUserRecord),
  });
}

async function fulfillSuccessfulGetCardsRoute(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(mockCardsRecord),
  });
}

async function fulfillSuccessfulStoreCardsRoute(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      success: true,
      userId: mockCardsRecord.userId,
      updatedAt: mockCardsRecord.updatedAt,
    }),
  });
}

async function fulfillSuccessfulStoreUsersRoute(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      success: true,
      userId: mockBootstrapUserRecord.userId,
      updatedAt: "2024-12-01T15:30:00.000Z",
    }),
  });
}

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
