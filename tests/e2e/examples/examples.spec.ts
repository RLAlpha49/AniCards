import { expect, test } from "@playwright/test";

import { clickAnchorAndExpectUrl, gotoReady } from "../fixtures/browser-utils";

test.describe("Examples gallery", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/*", (route) => {
      if (route.request().resourceType() === "image") {
        return route.fulfill({
          status: 200,
          contentType: "image/svg+xml",
          body: "<svg></svg>",
        });
      }
      return route.continue();
    });

    await gotoReady(page, "/examples");
  });

  test("filters card variants via search", async ({ page }) => {
    const variants = page.getByRole("heading", { level: 4 });
    const searchInput = page.getByLabel(/search gallery cards/i);
    const animeStatistics = page.getByRole("heading", {
      level: 4,
      name: /anime statistics/i,
    });
    const voiceActors = page.getByRole("heading", {
      level: 4,
      name: /voice actors/i,
    });

    await expect(variants.first()).toBeVisible({ timeout: 15000 });
    await expect(searchInput).toHaveAttribute("type", "search");
    await expect(searchInput).toHaveAttribute("autocomplete", "off");

    const initialCount = await variants.count();
    expect(initialCount).toBeGreaterThan(0);

    await test.step("Filter by Voice Actors", async () => {
      await searchInput.fill("Voice Actors");
    });

    await expect(voiceActors.first()).toBeVisible({ timeout: 15000 });
    await expect(animeStatistics.first()).not.toBeVisible();

    const filteredCount = await variants.count();
    expect(filteredCount).toBeGreaterThan(0);
  });

  test("navigates to search from examples CTA", async ({ page }) => {
    await test.step("Navigate to search from CTA", async () => {
      const createYoursLink = page.getByRole("link", {
        name: /^create yours$/i,
      });

      await expect(createYoursLink).toHaveAttribute("href", "/search");

      await clickAnchorAndExpectUrl(page, createYoursLink, /\/search(?:\?|$)/);

      await expect(page).toHaveURL(/\/search(?:\?|$)/);
      await expect(page.getByLabel(/anilist username/i)).toBeVisible();
    });
  });
});
