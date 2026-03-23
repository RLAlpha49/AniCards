import { expect, test } from "@playwright/test";

test.describe("Home page", () => {
  test("navigates to search from hero CTA", async ({ page }) => {
    await test.step("Open homepage", async () => {
      await page.goto("/");
    });

    await test.step("Navigate to search via hero CTA", async () => {
      await page.getByRole("button", { name: /get started/i }).click();
      await expect(page).toHaveURL(/\/search(?:\?|$)/);
      await expect(page.getByLabel(/anilist username/i)).toBeVisible();
    });
  });

  test("navigates to examples from View Gallery CTA", async ({ page }) => {
    await page.goto("/");

    await test.step("Open the examples gallery", async () => {
      await page.getByRole("link", { name: /view gallery/i }).click();
    });

    await expect(page).toHaveURL(/\/examples(?:\?|$)/);
    await expect(
      page.getByRole("heading", { name: /every card, every variant/i }),
    ).toBeVisible();
  });
});
