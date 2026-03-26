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
    await page.addInitScript(() => {
      void navigator.serviceWorker
        ?.getRegistrations?.()
        .then((registrations) =>
          Promise.all(
            registrations.map((registration) => registration.unregister()),
          ),
        );

      if ("caches" in globalThis) {
        void caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
      }
    });

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

    const gallery = page.locator("#card-gallery");
    await expect(gallery).toBeVisible({
      timeout: 15000,
    });
    await gallery.scrollIntoViewIfNeeded();

    const galleryImages = gallery.getByRole("img");
    await galleryImages.first().scrollIntoViewIfNeeded();
    await expect(galleryImages.first()).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(2200);

    const slowCards = gallery.locator('[data-image-state="slow"]');
    await expect(slowCards.first()).toHaveAttribute("aria-busy", "true");
    await expect(slowCards.first().locator(".animate-pulse")).toBeVisible();

    imageGate.resolve();

    await expect(gallery.getByRole("img").first()).toBeVisible({
      timeout: 15000,
    });

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

    await page.goto("/examples", { waitUntil: "domcontentloaded" });

    const gallery = page.locator("#card-gallery");
    await expect(gallery).toBeVisible({ timeout: 15000 });
    await gallery.scrollIntoViewIfNeeded();

    const galleryImages = gallery.getByRole("img");
    await galleryImages.first().scrollIntoViewIfNeeded();

    await galleryImages.first().evaluate((image) => {
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
