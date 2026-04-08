import { expect, type Locator, type Page, test } from "@playwright/test";

import { gotoReady } from "../fixtures/browser-utils";

async function waitForSearchFormHydrated(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const userIdRadio = document.querySelector(
        'input[type="radio"][value="userId"], input[type="radio"][value="userid"]',
      );

      if (!(userIdRadio instanceof HTMLInputElement)) {
        return false;
      }

      return Object.keys(userIdRadio).some(
        (key) =>
          key.startsWith("__reactProps$") || key.startsWith("__reactFiber$"),
      );
    },
    undefined,
    { timeout: 30000 },
  );
}

async function selectLookupMethod(
  page: Page,
  label: "Username" | "User ID",
): Promise<void> {
  const radio = page.getByRole("radio", {
    name: new RegExp(`^${label}$`, "i"),
  });
  const option = page
    .locator("label")
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`, "i") })
    .first();

  await option.click();

  await expect(radio).toBeChecked();
  await flushPaintFrames(page);
}

async function setSearchValue(
  page: Page,
  input: Locator,
  value: string,
): Promise<void> {
  await input.click();
  await input.fill("");
  await input.pressSequentially(value, { delay: 20 });

  await expect.poll(async () => await input.inputValue()).toBe(value);
  await flushPaintFrames(page);
}

async function flushPaintFrames(page: Page, count = 2): Promise<void> {
  for (let frame = 0; frame < count; frame += 1) {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
  }
}

async function submitSearchForm(page: Page): Promise<void> {
  await page.getByRole("button", { name: /find profile/i }).click();

  await flushPaintFrames(page, 3);
}

test.describe("Search page", () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page, "/search");
    await waitForSearchFormHydrated(page);
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

    const userIdInput = page.getByLabel(/AniList User ID/i);
    await selectLookupMethod(page, "User ID");
    await expect(userIdToggle).toBeChecked();
    await expect(userIdInput).toBeVisible();
    await expect(userIdInput).toHaveAttribute("type", "text");
    await expect(userIdInput).toHaveAttribute("inputmode", "numeric");
    await expect(userIdInput).toHaveAttribute("autocomplete", "off");
    await expect(userIdInput).toHaveAttribute("placeholder", /542244/i);
    await expect(page.getByLabel(/AniList Username/i)).toHaveCount(0);

    await selectLookupMethod(page, "Username");
    await expect(usernameToggle).toBeChecked();
    await expect(usernameInput).toBeVisible();
  });

  test("shows validation errors for empty submissions", async ({ page }) => {
    const usernameInput = page.getByLabel(/AniList Username/i);

    await submitSearchForm(page);
    const usernameAlert = page.getByText(
      /you'll need to enter a username first/i,
    );
    await expect(usernameAlert).toBeVisible({ timeout: 15000 });
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

    await selectLookupMethod(page, "User ID");

    await submitSearchForm(page);
    const userIdAlert = page.getByText(/you'll need to enter a user id first/i);
    await expect(userIdAlert).toBeVisible({ timeout: 15000 });

    const userIdInput = page.getByLabel(/AniList User ID/i);
    await expect(userIdInput).toHaveAttribute("aria-invalid", "true");
    await setSearchValue(page, userIdInput, "542244");
    await expect(
      page.getByText(/you'll need to enter a user id first/i),
    ).toHaveCount(0);
  });

  test("navigates to user page with loading overlay for username search", async ({
    page,
  }) => {
    const input = page.getByLabel(/AniList Username/i);
    await setSearchValue(page, input, "Alpha49");

    await submitSearchForm(page);
    await expect(page).toHaveURL(/\/user\/Alpha49/i, { timeout: 15000 });
  });

  test("navigates to user page when searching by user ID", async ({ page }) => {
    await selectLookupMethod(page, "User ID");

    const input = page.getByLabel(/AniList User ID/i);
    await setSearchValue(page, input, "123456");

    await submitSearchForm(page);
    await expect(page).toHaveURL(/\/user\?userId=123456/i, { timeout: 15000 });
  });
});
