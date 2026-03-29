import { expect, test } from "@playwright/test";

import { gotoReady } from "../fixtures/browser-utils";

const SVG_IMAGE_RESPONSE = `
  <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <rect width="640" height="360" fill="#171325" />
    <rect x="24" y="24" width="592" height="312" rx="24" fill="#0c0a10" stroke="#c99836" stroke-width="8" />
  </svg>
`;

const CARD_PREVIEW_ROUTE = /\/(?:api\/card|card\.svg)(?:\?.*)?$/;

test.use({ serviceWorkers: "block" });

test.describe("ImageWithSkeleton", () => {
  test("keeps skeletons visible during slow image loads until a real response completes", async ({
    page,
  }) => {
    const imageGate = Promise.withResolvers<void>();

    await page.context().route(CARD_PREVIEW_ROUTE, async (route) => {
      await imageGate.promise;
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: SVG_IMAGE_RESPONSE,
      });
    });

    await gotoReady(page, "/examples");

    const gallery = page.locator("#card-gallery");
    await expect(gallery).toBeVisible({
      timeout: 15000,
    });
    await gallery.scrollIntoViewIfNeeded();

    const firstImageCard = gallery.locator("[data-image-state]").first();
    await expect(firstImageCard).toBeVisible({ timeout: 15000 });
    const firstSlowImage = firstImageCard.getByRole("img");

    await expect(firstImageCard.locator(".animate-pulse")).toBeVisible({
      timeout: 15000,
    });
    await expect(firstImageCard).toHaveAttribute("data-image-state", "slow", {
      timeout: 15000,
    });
    await expect(firstImageCard).toHaveAttribute("aria-busy", "true");
    await expect(firstImageCard.locator(".animate-pulse")).toBeVisible();
    await expect(firstSlowImage).toHaveClass(/opacity-0/);

    imageGate.resolve();

    await expect(firstImageCard).toHaveAttribute("data-image-state", "loaded", {
      timeout: 15000,
    });
    await expect(firstSlowImage).toHaveClass(/opacity-100/, {
      timeout: 15000,
    });
    await expect(firstSlowImage).toBeVisible({ timeout: 15000 });

    await expect(
      gallery
        .locator("button")
        .filter({ hasText: /use in editor/i })
        .first(),
    ).toBeVisible();
  });

  test("preserves the error fallback instead of pretending failed images loaded", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });

    await gotoReady(page, "/examples");

    const gallery = page.locator("#card-gallery");
    await expect(gallery).toBeVisible({ timeout: 15000 });
    await gallery.scrollIntoViewIfNeeded();

    const targetImage = gallery.locator("[data-image-state] img[alt]").first();
    await expect(targetImage).toBeVisible({ timeout: 15000 });

    await targetImage.evaluate((image) => {
      image.setAttribute("src", "data:image/png;base64,invalid-image-data");
    });

    const errorCards = gallery.locator('[data-image-state="error"]');
    await expect
      .poll(async () => await errorCards.count(), {
        timeout: 15000,
      })
      .toBeGreaterThan(0);

    await expect(gallery.getByText(/failed to load/i).first()).toBeVisible();

    await expect(
      page.getByRole("heading", { name: /anime statistics/i }),
    ).toBeVisible();

    await expect(
      gallery
        .locator("button")
        .filter({ hasText: /use in editor/i })
        .first(),
    ).toBeVisible();
  });
});
