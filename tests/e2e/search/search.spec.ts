import { expect, test } from "@playwright/test";

import { gotoReady } from "../fixtures/browser-utils";

test.describe("Search page", () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page, "/search");
  });

  test("switches between username and user ID modes", async ({ page }) => {
    const usernameToggle = page.getByRole("radio", { name: /^username$/i });
    const userIdToggle = page.getByRole("radio", { name: /user id/i });

    const usernameInput = page.getByLabel(/AniList Username/i);
    await expect(usernameToggle).toBeChecked();
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveAttribute("type", "search");
    await expect(usernameInput).toHaveAttribute("inputmode", "search");
    await expect(usernameInput).toHaveAttribute("autocomplete", "off");
    await expect(usernameInput).toHaveAttribute("autocapitalize", "none");
    await expect(usernameInput).toHaveAttribute("autocorrect", "off");
    await expect(usernameInput).toHaveAttribute("placeholder", /Alpha49/i);

    await userIdToggle.check();
    await expect(page.getByText(/^AniList User ID$/)).toBeVisible({
      timeout: 15000,
    });

    const userIdInput = page.getByLabel(/AniList User ID/i);
    await expect(userIdToggle).toBeChecked();
    await expect(userIdInput).toBeVisible();
    await expect(userIdInput).toHaveAttribute("type", "text");
    await expect(userIdInput).toHaveAttribute("inputmode", "numeric");
    await expect(userIdInput).toHaveAttribute("autocomplete", "off");
    await expect(userIdInput).toHaveAttribute("placeholder", /542244/i);

    await usernameToggle.check();
    await expect(page.getByText(/^AniList Username$/)).toBeVisible({
      timeout: 15000,
    });
    await expect(usernameToggle).toBeChecked();
    await expect(usernameInput).toBeVisible();
  });

  test("shows validation errors for empty submissions", async ({ page }) => {
    const submit = page.getByRole("button", { name: /find profile/i });
    const usernameInput = page.getByLabel(/AniList Username/i);

    await submit.click();
    const usernameAlert = page.getByText(
      /you'll need to enter a username first/i,
    );
    await expect(usernameAlert).toBeVisible();
    await expect(usernameInput).toHaveAttribute("aria-invalid", "true");
    await expect(usernameInput).toHaveAttribute(
      "aria-describedby",
      /search-hint/,
    );
    await expect(usernameInput).toHaveAttribute(
      "aria-describedby",
      /search-error/,
    );
    await expect(page).toHaveURL(/\/search$/);

    const userIdOption = page.locator("label").filter({
      hasText: /^User ID$/,
    });
    await userIdOption.click();

    await submit.click();
    const userIdAlert = page.getByText(/you'll need to enter a user id first/i);
    await expect(userIdAlert).toBeVisible();

    const userIdInput = page.getByLabel(/AniList User ID/i);
    await expect(userIdInput).toHaveAttribute("aria-invalid", "true");
    await userIdInput.fill("542244");
    await expect(
      page.getByText(/you'll need to enter a user id first/i),
    ).toHaveCount(0);
  });

  test("navigates to user page with loading overlay for username search", async ({
    page,
  }) => {
    const input = page.getByLabel(/AniList Username/i);
    await input.fill("Alpha49");

    await page.getByRole("button", { name: /find profile/i }).click();

    const loadingText = page.getByText(/pulling up their page/i);
    await expect(loadingText).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/user\/Alpha49/i, { timeout: 15000 });
  });

  test("navigates to user page when searching by user ID", async ({ page }) => {
    await page.getByRole("radio", { name: /user id/i }).check();

    const input = page.getByLabel(/AniList User ID/i);
    await input.fill("123456");

    await page.getByRole("button", { name: /find profile/i }).click();

    const loadingText = page.getByText(/pulling up their page/i);
    await expect(loadingText).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/user\?userId=123456/i, { timeout: 15000 });
  });
});
