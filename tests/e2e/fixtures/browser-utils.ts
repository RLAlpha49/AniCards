import { expect, type Locator, type Page } from "@playwright/test";

const themeControlSelector = [
  '[aria-label="Toggle color mode"]',
  '[aria-label="Switch to dark mode"]',
  '[aria-label="Switch to light mode"]',
].join(", ");

export async function waitForAppReady(page: Page): Promise<void> {
  const themeControl = page.locator(themeControlSelector).first();
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("banner")).toBeVisible({ timeout: 15000 });

  if ((await themeControl.count()) > 0) {
    await expect(themeControl).toBeVisible({ timeout: 15000 });
    return;
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
  await expect(target).toHaveAttribute("data-ui-ready", "true", {
    timeout: 15000,
  });
}

export async function clickAnchorAndExpectUrl(
  page: Page,
  locator: Locator,
  urlPattern: RegExp,
): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible({ timeout: 15000 });
  await locator.click();
  await expect(page).toHaveURL(urlPattern, { timeout: 15000 });
}
