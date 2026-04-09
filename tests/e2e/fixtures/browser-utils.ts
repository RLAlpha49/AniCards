import { expect, type Locator, type Page } from "@playwright/test";

const themeControlSelector = [
  '[aria-label="Toggle color mode"]',
  '[aria-label="Switch to dark mode"]',
  '[aria-label="Switch to light mode"]',
].join(", ");

export async function waitForAppReady(page: Page): Promise<void> {
  const themeControl = page.locator(themeControlSelector).first();
  await page.waitForLoadState("domcontentloaded");

  try {
    await page.waitForLoadState("load", { timeout: 10000 });
  } catch {
    // Some Firefox/dev-server navigations keep a late resource pending even though
    // the app shell is already rendered and interactive.
  }

  await expect(page.getByRole("banner")).toBeVisible({ timeout: 15000 });

  if ((await themeControl.count()) > 0) {
    await expect(themeControl).toBeVisible({ timeout: 15000 });
  }

  await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });
}

export async function dismissAnalyticsPromptIfVisible(
  page: Page,
): Promise<void> {
  const dismissButton = page.getByRole("button", {
    name: /keep it off/i,
  });

  if (await dismissButton.isVisible()) {
    await dismissButton.click();
  }
}

export async function gotoReady(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForAppReady(page);
  await dismissAnalyticsPromptIfVisible(page);
}

export async function waitForUiReady(target: Locator): Promise<void> {
  await expect(target).toBeVisible({ timeout: 15000 });

  try {
    await expect(target).toHaveAttribute("data-ui-ready", "true", {
      timeout: 5000,
    });
  } catch {
    // Some browsers can paint the interactive editor before this mount flag settles.
  }
}

export async function clickAnchorAndExpectUrl(
  page: Page,
  locator: Locator,
  urlPattern: RegExp,
): Promise<void> {
  const clickAnchor = async () => {
    await dismissAnalyticsPromptIfVisible(page);
    await locator.scrollIntoViewIfNeeded();
    await expect(locator).toBeVisible({ timeout: 15000 });
    await locator.click();
  };

  try {
    await clickAnchor();
  } catch (error) {
    const dismissButton = page.getByRole("button", {
      name: /keep it off/i,
    });

    if (!(await dismissButton.isVisible())) {
      throw error;
    }

    await dismissButton.click();
    await clickAnchor();
  }

  await expect(page).toHaveURL(urlPattern, { timeout: 15000 });
}
