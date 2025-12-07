import { test, expect } from "@playwright/test";

const SOCIAL_NAMES = ["Discord", "GitHub", "AniList"];

test.describe("Contact page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contact");
  });

  test("shows social cards with safe external links", async ({ page }) => {
    for (const name of SOCIAL_NAMES) {
      await test.step(`Validate ${name} card`, async () => {
        const links = page.getByRole("link", { name: new RegExp(name, "i") });
        const linkCount = await links.count();

        expect(linkCount).toBeGreaterThan(0);

        for (let index = 0; index < linkCount; index += 1) {
          const link = links.nth(index);
          await expect(link).toBeVisible();
          await expect(link).toHaveAttribute("target", "_blank");
          await expect(link).toHaveAttribute("rel", /noopener/i);
        }
      });
    }
  });

  test("exposes email CTA and GitHub issues link", async ({ page }) => {
    await test.step("Validate email CTA", async () => {
      const emailLink = page.getByRole("link", {
        name: /contact@alpha49\.com/i,
      });
      await expect(emailLink).toBeVisible();
      await expect(emailLink).toHaveAttribute(
        "href",
        /mailto:contact@alpha49\.com/i,
      );
    });

    await test.step("Validate GitHub issues link", async () => {
      const issuesLink = page.getByRole("link", {
        name: /open an issue on github/i,
      });
      await expect(issuesLink).toBeVisible();
      await expect(issuesLink).toHaveAttribute(
        "href",
        /github\.com\/RLAlpha49\/AniCards\/issues/i,
      );
      await expect(issuesLink).toHaveAttribute("target", "_blank");
    });
  });
});
