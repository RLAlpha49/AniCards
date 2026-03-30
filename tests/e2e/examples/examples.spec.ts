import { expect, test } from "@playwright/test";

import {
  clickAnchorAndExpectUrl,
  dismissAnalyticsPromptIfVisible,
  gotoReady,
  waitForAppReady,
} from "../fixtures/browser-utils";

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
  });

  test("filters card variants via search", async ({ page }) => {
    await gotoReady(page, "/examples?search=Voice%20Actors");

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
    await expect(searchInput).toHaveValue("Voice Actors");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("search"))
      .toBe("Voice Actors");

    await expect(voiceActors.first()).toBeVisible({ timeout: 15000 });
    await expect(animeStatistics.first()).not.toBeVisible();

    const filteredCount = await variants.count();
    expect(filteredCount).toBeGreaterThan(0);
  });

  test("keeps filters in the URL across reload and back navigation", async ({
    page,
  }) => {
    await gotoReady(
      page,
      "/examples?search=Voice%20Actors&category=Anime%20Deep%20Dive",
    );

    const searchInput = page.getByLabel(/search gallery cards/i);
    const animeDeepDiveButton = page.getByRole("button", {
      name: /anime deep dive/i,
    });
    const privacyLink = page
      .getByRole("contentinfo")
      .getByRole("link", { name: /privacy disclosure/i });
    const voiceActors = page.getByRole("heading", {
      level: 4,
      name: /voice actors/i,
    });

    await expect(searchInput).toHaveValue("Voice Actors");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("search"))
      .toBe("Voice Actors");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("category"))
      .toBe("Anime Deep Dive");

    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissAnalyticsPromptIfVisible(page);
    await waitForAppReady(page);

    await expect(searchInput).toHaveValue("Voice Actors");
    await expect(animeDeepDiveButton).toHaveAttribute("aria-current", "page");
    await expect(voiceActors.first()).toBeVisible({ timeout: 15000 });

    await dismissAnalyticsPromptIfVisible(page);
    await privacyLink.scrollIntoViewIfNeeded();
    await privacyLink.click();
    await expect(page).toHaveURL(/\/privacy(?:\?|$)/, { timeout: 15000 });
    await waitForAppReady(page);
    await page.goBack({ waitUntil: "domcontentloaded" });
    await dismissAnalyticsPromptIfVisible(page);
    await waitForAppReady(page);

    await expect(page).toHaveURL(/\/examples(?:\?|$)/);
    await expect(searchInput).toHaveValue("Voice Actors");
    await expect(animeDeepDiveButton).toHaveAttribute("aria-current", "page");
  });

  test("drops invalid category params from the URL", async ({ page }) => {
    await gotoReady(
      page,
      "/examples?search=Voice%20Actors&category=Not%20A%20Real%20Category",
    );

    const searchInput = page.getByLabel(/search gallery cards/i);
    const allCategoriesButton = page.getByRole("button", { name: /^all/i });
    const voiceActors = page.getByRole("heading", {
      level: 4,
      name: /voice actors/i,
    });

    await expect(searchInput).toHaveValue("Voice Actors");
    await expect(voiceActors.first()).toBeVisible({ timeout: 15000 });
    await expect(allCategoriesButton).toHaveAttribute("aria-current", "page");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("search"))
      .toBe("Voice Actors");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("category"), {
        timeout: 30000,
      })
      .toBe(null);
  });

  test("navigates to search from examples CTA", async ({ page }) => {
    await gotoReady(page, "/examples");

    await test.step("Navigate to search from CTA", async () => {
      const createYoursLink = page.getByRole("link", {
        name: /^create yours$/i,
      });

      await expect(createYoursLink).toHaveAttribute("href", "/search");

      await clickAnchorAndExpectUrl(page, createYoursLink, /\/search(?:\?|$)/);

      await expect(page).toHaveURL(/\/search(?:\?|$)/);
      await expect(
        page.getByRole("heading", { name: /unlock any profile/i }),
      ).toBeVisible({ timeout: 15000 });
    });
  });
});
