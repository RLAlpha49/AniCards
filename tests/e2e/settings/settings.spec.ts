import { test, expect } from "@playwright/test";

const CARD_SETTINGS_STORAGE_KEY = "anicards-card-settings";
const USER_PREFERENCES_STORAGE_KEY = "anicards-user-preferences";

test.describe("Settings page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /application settings/i,
      }),
    ).toBeVisible();
  });

  test("lets users switch themes and persists the choice", async ({ page }) => {
    const html = page.locator("html");
    const darkOption = page.getByRole("button", { name: /^dark$/i });
    const lightOption = page.getByRole("button", { name: /^light$/i });
    const getStoredTheme = () =>
      page.evaluate(() => localStorage.getItem("theme"));

    await test.step("Switch to dark theme", async () => {
      await darkOption.click();
      await expect.poll(getStoredTheme).toBe("dark");
      await expect(html).toHaveClass(/dark/);
    });

    await test.step("Switch back to light theme", async () => {
      await lightOption.click();
      await expect.poll(getStoredTheme).toBe("light");
      await expect(html).not.toHaveClass(/dark/);
    });
  });

  test("persists the default username across reloads", async ({ page }) => {
    const username = `tester-${Date.now()}`;
    const input = page.getByPlaceholder(/enter your anilist username/i);
    const getStoredUsername = () =>
      page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const state = parsed.state ?? parsed;
        return state?.defaultUsername ?? null;
      }, USER_PREFERENCES_STORAGE_KEY);

    await test.step("Fill a default username", async () => {
      await input.fill(username);
      await expect(input).toHaveValue(username);

      await expect.poll(getStoredUsername).toBe(username);
    });

    await test.step("Reload keeps the username", async () => {
      await page.reload();
      await expect(
        page.getByPlaceholder(/enter your anilist username/i),
      ).toHaveValue(username);
    });
  });

  test("allows selecting all card types at once", async ({ page }) => {
    const cardCheckboxes = page.locator(
      '[role="checkbox"][id]:not([id^="default-show-favorites"])',
    );

    await expect.poll(async () => cardCheckboxes.count()).toBeGreaterThan(0);
    const totalCardTypes = await cardCheckboxes.count();

    const toggleAll = page.getByRole("button", {
      name: /select all|unselect all/i,
    });

    const getStoredCount = () =>
      page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return 0;
        const parsed = JSON.parse(raw);
        const state = parsed.state ?? parsed;
        const types = state?.defaultCardTypes;
        return Array.isArray(types) ? types.length : 0;
      }, CARD_SETTINGS_STORAGE_KEY);

    await test.step("Select all card types", async () => {
      await toggleAll.click();

      await expect
        .poll(async () =>
          page
            .locator(
              '[role="checkbox"][id]:not([id^="default-show-favorites"])[data-state="checked"]',
            )
            .count(),
        )
        .toBe(totalCardTypes);

      await expect.poll(getStoredCount).toBe(totalCardTypes);
    });

    await test.step("Unselect all card types", async () => {
      await toggleAll.click();

      await expect
        .poll(async () =>
          page
            .locator(
              '[role="checkbox"][id]:not([id^="default-show-favorites"])[data-state="checked"]',
            )
            .count(),
        )
        .toBe(0);

      await expect.poll(getStoredCount).toBe(0);
    });
  });
});
