import { test, expect } from "@playwright/test";
import { GeneratorPage } from "../fixtures/test-utils";

test.describe("Home page", () => {
  test("opens generator from hero CTA", async ({ page }) => {
    const generator = new GeneratorPage(page);

    await test.step("Open homepage", async () => {
      await page.goto("/");
    });

    await test.step("Open generator via hero CTA", async () => {
      await page.getByRole("button", { name: /create your card/i }).click();
      await generator.waitForGeneratorOpen();
    });

    await test.step("Close generator with Escape", async () => {
      await page.keyboard.press("Escape");
      await expect(generator.getDialog()).not.toBeVisible();
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
      return { top: rect.top, viewportHeight: window.innerHeight };
    });

    expect(viewportState.top).toBeLessThanOrEqual(
      viewportState.viewportHeight * 0.95,
    );
  });
});
