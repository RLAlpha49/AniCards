import { expect, test } from "@playwright/test";

const SVG_IMAGE_RESPONSE = `
  <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <rect width="640" height="360" fill="#171325" />
    <rect x="24" y="24" width="592" height="312" rx="24" fill="#0c0a10" stroke="#c99836" stroke-width="8" />
  </svg>
`;

test.describe("ImageWithSkeleton", () => {
  test("keeps skeletons visible during slow image loads until a real response completes", async ({
    page,
  }) => {
    const imageGate = Promise.withResolvers<void>();

    await page.route("**/*", async (route) => {
      if (route.request().resourceType() !== "image") {
        await route.continue();
        return;
      }

      await imageGate.promise;
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: SVG_IMAGE_RESPONSE,
      });
    });

    await page.goto("/examples", { waitUntil: "domcontentloaded" });

    await expect(page.locator("[data-image-state]").first()).toBeVisible({
      timeout: 15000,
    });

    await page.waitForTimeout(2200);

    const slowCards = page.locator('[data-image-state="slow"]');
    await expect(slowCards.first()).toHaveAttribute("aria-busy", "true");
    await expect(slowCards.first().locator(".animate-pulse")).toBeVisible();

    imageGate.resolve();

    const loadedCards = page.locator('[data-image-state="loaded"]');
    await expect.poll(async () => await loadedCards.count()).toBeGreaterThan(0);
    await expect(loadedCards.first()).toHaveAttribute("aria-busy", "false");
    await expect(loadedCards.first().locator(".animate-pulse")).toHaveCount(0);
  });

  test("preserves the error fallback instead of pretending failed images loaded", async ({
    page,
  }) => {
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() !== "image") {
        await route.continue();
        return;
      }

      await route.abort("failed");
    });

    await page.goto("/examples", { waitUntil: "domcontentloaded" });

    const errorCards = page.locator('[data-image-state="error"]');
    await expect
      .poll(async () => await errorCards.count(), {
        timeout: 15000,
      })
      .toBeGreaterThan(0);

    await expect(errorCards.first()).toHaveAttribute("aria-busy", "false");
    await expect(errorCards.first().locator(".animate-pulse")).toHaveCount(0);
    await expect(errorCards.first()).toContainText("Failed to load");
  });
});
