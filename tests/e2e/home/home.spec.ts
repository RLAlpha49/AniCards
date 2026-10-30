import { test, expect } from "@playwright/test";
import { GeneratorPage } from "../fixtures/test-utils";

test.describe("Home page", () => {
  test("navigates to the generator from the hero CTA", async ({ page }) => {
    const generator = new GeneratorPage(page);

    await test.step("Open homepage", async () => {
      await page.goto("/");
    });

    await test.step("Follow the hero CTA", async () => {
      await page.getByRole("button", { name: /create your card/i }).click();
      /* The CTA routes on the client, so there is no load event to wait for.
         Polling the URL is the deterministic check. */
      await expect.poll(() => page.url()).toContain("/generator");
      await generator.waitForGeneratorOpen();
    });

    await test.step("Generator has an address to return to", async () => {
      expect(page.url()).toContain("/generator");
      await expect(
        page.getByRole("heading", { name: /whose stats/i, level: 2 }),
      ).toBeVisible();
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

    await expect
      .poll(() =>
        showcase.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return rect.top <= window.innerHeight * 0.95;
        }),
      )
      .toBe(true);

    const viewportState = await showcase.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, viewportHeight: window.innerHeight };
    });

    expect(viewportState.top).toBeLessThanOrEqual(
      viewportState.viewportHeight * 0.95,
    );
  });
});
