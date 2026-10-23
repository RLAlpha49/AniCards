import { test, expect } from "@playwright/test";
import { GeneratorPage } from "../fixtures/test-utils";

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
      await page.getByPlaceholder(/search by card name/i).fill("Voice Actors");
    });

    await expect
      .poll(async () => await variants.count())
      .toBeLessThan(initialCount);

    const filteredCount = await variants.count();
    expect(filteredCount).toBeGreaterThan(0);
  });

  test("navigates to the generator from the examples CTA", async ({ page }) => {
    const generator = new GeneratorPage(page);

    await test.step("Follow the CTA", async () => {
      await page.getByRole("button", { name: /create your cards/i }).click();
      /* Client-side route change: poll the URL rather than waiting for a
         navigation event that never fires. */
      await expect.poll(() => page.url()).toContain("/generator");
      await generator.waitForGeneratorOpen();
    });

    await test.step("The generator renders its first step", async () => {
      await expect(
        page.getByRole("heading", { name: /whose stats/i, level: 2 }),
      ).toBeVisible();
    });
  });
});
