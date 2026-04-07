import { expect, type Page, test } from "@playwright/test";

import { gotoReady } from "../fixtures/browser-utils";

const SVG_IMAGE_RESPONSE = `
  <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <rect width="640" height="360" fill="#171325" />
    <rect x="24" y="24" width="592" height="312" rx="24" fill="#0c0a10" stroke="#c99836" stroke-width="8" />
  </svg>
`;

const CARD_PREVIEW_ROUTE = /\/(?:api\/card|card\.svg)(?:\?.*)?$/;

async function forceDarkPreviewTheme(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      globalThis.localStorage.setItem("theme", "dark");
    } catch {
      // Ignore storage access failures in restrictive test contexts.
    }

    document.documentElement.classList.add("dark");
  });

  await page.emulateMedia({ colorScheme: "dark" });
}

async function mockExamplePreviewResponses(
  page: Page,
  options: Readonly<{ delay?: Promise<void> }> = {},
): Promise<void> {
  await page.context().route(CARD_PREVIEW_ROUTE, async (route) => {
    if (options.delay) {
      await options.delay;
    }

    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: SVG_IMAGE_RESPONSE,
    });
  });
}

test.describe("ImageWithSkeleton", () => {
  test("keeps skeletons visible during slow image loads until a real response completes", async ({
    page,
  }) => {
    const imageGate = Promise.withResolvers<void>();

    await forceDarkPreviewTheme(page);
    await mockExamplePreviewResponses(page, { delay: imageGate.promise });

    await gotoReady(page, "/examples");

    const gallery = page.locator("#card-gallery");
    await expect(gallery).toBeVisible({
      timeout: 15000,
    });
    await gallery.scrollIntoViewIfNeeded();

    const imageCards = gallery.locator("[data-image-state]");
    await expect
      .poll(async () => await imageCards.count(), {
        timeout: 30000,
      })
      .toBeGreaterThan(0);
    await expect(imageCards.first()).toBeVisible({ timeout: 15000 });

    await expect
      .poll(
        async () => await gallery.locator('[data-image-state="slow"]').count(),
        {
          timeout: 30000,
        },
      )
      .toBeGreaterThan(0);

    const firstSlowCard = gallery.locator('[data-image-state="slow"]').first();
    const firstSlowImage = firstSlowCard.locator("img[alt]");

    await expect(firstSlowCard.locator(".animate-pulse")).toBeVisible({
      timeout: 15000,
    });
    await expect(firstSlowCard).toHaveAttribute("aria-busy", "true");
    await expect(firstSlowImage).toHaveClass(/opacity-0/);

    imageGate.resolve();

    await expect
      .poll(
        async () =>
          await gallery.locator('[data-image-state="loaded"]').count(),
        {
          timeout: 30000,
        },
      )
      .toBeGreaterThan(0);

    const firstLoadedCard = gallery
      .locator('[data-image-state="loaded"]')
      .first();
    const firstLoadedImage = firstLoadedCard.locator("img[alt]");

    await expect(firstLoadedImage).toHaveClass(/opacity-100/, {
      timeout: 15000,
    });
    await expect(firstLoadedImage).toBeVisible({ timeout: 15000 });

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
    await forceDarkPreviewTheme(page);
    await mockExamplePreviewResponses(page);

    await gotoReady(page, "/examples");

    const gallery = page.locator("#card-gallery");
    await expect(gallery).toBeVisible({ timeout: 15000 });
    await gallery.scrollIntoViewIfNeeded();

    const imageCards = gallery.locator("[data-image-state]");
    await expect
      .poll(async () => await imageCards.count(), {
        timeout: 30000,
      })
      .toBeGreaterThan(0);

    const targetCard = imageCards.first();

    await targetCard.evaluate((element) => {
      element.dataset.playwrightTarget = "image-error-card";
    });

    const taggedCard = gallery.locator(
      '[data-playwright-target="image-error-card"]',
    );
    const targetImage = taggedCard.locator("img[alt]");

    await expect(targetImage).toHaveAttribute(
      "src",
      /\/(?:api\/card|card\.svg)/,
      {
        timeout: 15000,
      },
    );

    await targetImage.evaluate((image) => {
      image.dispatchEvent(new Event("error"));
    });

    await expect(taggedCard).toHaveAttribute("data-image-state", "error", {
      timeout: 15000,
    });

    await expect(taggedCard.getByText(/failed to load/i)).toBeVisible();

    await expect(
      gallery
        .locator("button")
        .filter({ hasText: /use in editor/i })
        .first(),
    ).toBeVisible();
  });
});
