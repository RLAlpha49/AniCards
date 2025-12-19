import { test, expect } from "@playwright/test";

test.describe("Search page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/search");
  });

  test("switches between username and user ID modes", async ({ page }) => {
    const usernameToggle = page.getByRole("button", { name: /username/i });
    const userIdToggle = page.getByRole("button", { name: /user id/i });

    const usernameInput = page.getByLabel(/AniList Username/i);
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveAttribute("placeholder", /username/i);

    await userIdToggle.click();

    const userIdInput = page.getByLabel(/AniList User ID/i);
    await expect(userIdInput).toBeVisible();
    await expect(userIdInput).toHaveAttribute("placeholder", /user id/i);

    await usernameToggle.click();
    await expect(usernameInput).toBeVisible();
  });

  test("shows validation errors for empty submissions", async ({ page }) => {
    const submit = page.getByRole("button", { name: /search user/i });

    await submit.click();
    const usernameAlert = page
      .getByRole("alert")
      .filter({ hasText: /Please enter a username/i });
    await expect(usernameAlert).toBeVisible();
    await expect(page).toHaveURL(/\/search$/);

    const userIdToggle = page.getByRole("button", { name: /user id/i });
    await userIdToggle.click();

    await submit.click();
    const userIdAlert = page
      .getByRole("alert")
      .filter({ hasText: /Please enter a user ID/i });
    await expect(userIdAlert).toBeVisible();

    const userIdInput = page.getByLabel(/AniList User ID/i);
    await userIdInput.fill("542244");
    await expect(
      page.getByRole("alert").filter({ hasText: /Please enter a user ID/i }),
    ).toHaveCount(0);
  });

  test("navigates to user page with loading overlay for username search", async ({
    page,
  }) => {
    const input = page.getByLabel(/AniList Username/i);
    await input.fill("Alpha49");

    const navigation = page.waitForURL(/\/user(\/lookup)?|user\?.*/i, {
      timeout: 15000,
    });

    await page.getByRole("button", { name: /search user/i }).click();

    const loadingText = page
      .getByRole("paragraph")
      .filter({ hasText: "Searching for user..." });
    await expect(loadingText).toBeVisible({ timeout: 5000 });
    await navigation;
  });

  test("navigates to user page when searching by user ID", async ({ page }) => {
    await page.getByRole("button", { name: /user id/i }).click();

    const input = page.getByLabel(/AniList User ID/i);
    await input.fill("123456");

    const navigation = page.waitForURL(/\/user\?userId=123456/i, {
      timeout: 15000,
    });

    await page.getByRole("button", { name: /search user/i }).click();

    const loadingText = page
      .getByRole("paragraph")
      .filter({ hasText: "Searching for user..." });
    await expect(loadingText).toBeVisible({ timeout: 10000 });
    await navigation;
  });
});
