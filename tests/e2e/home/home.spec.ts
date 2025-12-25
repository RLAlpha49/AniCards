import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("navigates to search from hero CTA", async ({ page }) => {
    await test.step("Open homepage", async () => {
      await page.goto("/");
    });

    await test.step("Navigate to search via hero CTA", async () => {
      await page.getByRole("button", { name: /create your card/i }).click();
      await expect(page).toHaveURL(/\/search(?:\?|$)/);
      await expect(page.getByLabel(/anilist username/i)).toBeVisible();
    });
  });

  test("scrolls to preview showcase from View Examples CTA", async ({
    page,
  }) => {
    await page.goto("/");

    const showcase = page.locator("#preview-showcase");
    await expect(showcase).toBeVisible();
    const initialScrollY = await page.evaluate(() => window.scrollY);

    await test.step("Trigger smooth scroll", async () => {
      await page
        .getByRole("button", { name: /view examples/i })
        .first()
        .click();
    });

    await expect
      .poll(async () => await page.evaluate(() => window.scrollY))
      .toBeGreaterThan(initialScrollY);

    const viewportState = await showcase.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: window.innerHeight,
      };
    });

    // Ensure the showcase is at least partially visible in the viewport
    expect(viewportState.top).toBeLessThan(viewportState.viewportHeight);
    expect(viewportState.bottom).toBeGreaterThan(0);
  });
});
