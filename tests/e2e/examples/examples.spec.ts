import { test, expect } from "@playwright/test";

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

    await page.goto("/examples");
  });

  test("filters card variants via search", async ({ page }) => {
    const variants = page.getByRole("heading", { level: 4 });
    await expect(variants.first()).toBeVisible({ timeout: 15000 });

    const initialCount = await variants.count();
    expect(initialCount).toBeGreaterThan(0);

    await test.step("Filter by Voice Actors", async () => {
      await page.getByPlaceholder(/search cards/i).fill("Voice Actors");
    });

    await expect
      .poll(async () => await variants.count())
      .toBeLessThan(initialCount);

    const filteredCount = await variants.count();
    expect(filteredCount).toBeGreaterThan(0);
  });

  test("navigates to search from examples CTA", async ({ page }) => {
    await test.step("Navigate to search from CTA", async () => {
      await page
        .getByRole("button", { name: /create your cards/i })
        .first()
        .click();
      await expect(page).toHaveURL(/\/search(?:\?|$)/);
      await expect(page.getByLabel(/anilist username/i)).toBeVisible();
    });
  });
});
