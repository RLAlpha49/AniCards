import { test as base, expect, Page, Route } from "@playwright/test";
import {
  mockUserRecord,
  mockCardsRecord,
  mockRateLimitError,
  mockUserNotFoundError,
} from "./mock-data";

/**
 * Custom fixture types for AniCards E2E tests.
 */
export interface AniCardsFixtures {
  /** Opens the card generator dialog and returns utilities for interaction */
  generatorPage: GeneratorPage;
  /** Mocks the API responses for successful scenarios */
  mockSuccessfulApi: void;
  /** Mocks the API to return rate limit error */
  mockRateLimitedApi: void;
  /** Mocks the API to return user not found error */
  mockUserNotFoundApi: void;
  /** Mocks the API to simulate network error */
  mockNetworkError: void;
}

/**
 * Page Object Model for the Card Generator component.
 * Provides methods for common interactions with the generator wizard.
 */
export class GeneratorPage {
  constructor(private readonly page: Page) {}

  /** Navigate to the home page */
  async goto() {
    await this.page.goto("/");
  }

  /** Open the card generator dialog */
  async openGenerator() {
    // Look for the "Create Your Card" button on the hero section
    const getStartedButton = this.page.getByRole("button", {
      name: /create your card|get started|create.*cards|generate/i,
    });

    // If not found, try looking for a link
    if (!(await getStartedButton.count())) {
      const link = this.page.getByRole("link", {
        name: /create your card|get started|create.*cards|generate/i,
      });
      if (await link.count()) {
        await link.click();
        return;
      }
    }

    await getStartedButton.first().click();
    await this.waitForGeneratorOpen();
  }

  /** Wait for the generator dialog to be open */
  async waitForGeneratorOpen() {
    await expect(
      this.page.getByRole("dialog", { name: /card generator/i }),
    ).toBeVisible();
  }

  /** Get the dialog container */
  getDialog() {
    return this.page.getByRole("dialog", { name: /card generator/i });
  }

  /** Get the username input field */
  getUsernameInput() {
    return this.page.getByRole("textbox", { name: /anilist username/i });
  }

  /** Enter a username in the input field */
  async enterUsername(username: string) {
    const input = this.getUsernameInput();
    await input.fill(username);
    await expect(input).toHaveValue(username);
  }

  /** Click the Continue/Next button */
  async clickContinue() {
    // The button shows "Go to next step (X)" where X is the next step name
    const continueBtn = this.page.getByRole("button", {
      name: /go to next step|continue/i,
    });
    await continueBtn.waitFor({ state: "visible", timeout: 20000 });
    await expect(continueBtn).toBeEnabled({ timeout: 10000 });
    await continueBtn.click();
    await this.page.waitForTimeout(1200);
    await expect(this.getDialog()).toBeVisible({ timeout: 5000 });
  }

  /** Click the Back button */
  async clickBack() {
    const backBtn = this.page.getByRole("button", {
      name: /go to previous step|back/i,
    });
    await backBtn.waitFor({ state: "visible", timeout: 10000 });
    await backBtn.click();
    await this.page.waitForTimeout(600);
    await expect(this.getDialog()).toBeVisible({ timeout: 5000 });
  }

  /** Click the Cancel button */
  async clickCancel() {
    await this.page.getByRole("button", { name: /cancel/i }).click();
  }

  /** Click the Generate button */
  async clickGenerate() {
    await this.page.getByRole("button", { name: /generate/i }).click();
  }

  /** Close the generator dialog */
  async closeGenerator() {
    await this.page
      .getByRole("button", { name: /close.*generator|close/i })
      .click();
  }

  /** Get the current step indicator */
  getCurrentStep() {
    return this.page.locator('[aria-selected="true"]');
  }

  /** Navigate to a specific step by clicking its tab or using Continue button */
  async goToStep(stepName: string) {
    // Try to click tab (desktop view)
    const tab = this.page.getByRole("tab", { name: new RegExp(stepName, "i") });
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
    } else {
      // On mobile, use Continue button to navigate to next step
      // This assumes sequential navigation
      await this.clickContinue();
    }
  }

  /** Navigate to Colors step (step 2) */
  async goToColorsStep() {
    const tab = this.page.getByRole("tab", { name: /Colors/i });
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
      await this.page.waitForTimeout(800);
    } else {
      // Mobile: navigate from step 1 (User) to step 2 (Colors)
      await this.clickContinue();
      // Wait for Colors step to fully render
      await this.page.waitForTimeout(1000);
    }
  }

  /** Navigate to Advanced step (step 4) */
  async goToAdvancedStep() {
    const tab = this.page.getByRole("tab", { name: /Advanced/i });
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
      await this.page.waitForTimeout(800);
    } else {
      // Mobile: navigate sequentially to Advanced step
      // From User -> Colors -> Cards -> Advanced
      await this.clickContinue(); // User -> Colors
      await this.page.waitForTimeout(800);
      await this.clickContinue(); // Colors -> Cards
      await this.page.waitForTimeout(800);
      await this.clickContinue(); // Cards -> Advanced
      await this.page.waitForTimeout(800);
    }
  }

  /** Check if we're on a specific step */
  async assertOnStep(stepNumber: number) {
    // The progress dots should show the current step
    const stepIndicator = this.page.locator(
      `[aria-valuenow="${stepNumber + 1}"]`,
    );
    await expect(stepIndicator).toBeVisible();
  }

  /** Select a card type by its name (e.g., "Anime Stats", "Manga Stats") */
  async selectCardType(cardName: string) {
    // Cards are displayed with checkboxes. The text is sibling to the checkbox.
    // We need to find the checkbox near the text
    const cardRow = this.page.locator(`text=${cardName}`).first();

    // Wait for the card row to be visible
    await cardRow.waitFor({ state: "visible", timeout: 10000 });

    // Try to find the checkbox in the row
    let checkbox = cardRow
      .locator("..")
      .locator('input[type="checkbox"], [role="checkbox"]');

    if ((await checkbox.count()) > 0) {
      await checkbox.first().waitFor({ state: "visible", timeout: 5000 });
      await checkbox.first().click();
      return;
    }

    // Fallback: try to find by searching all checkboxes
    const checkboxes = this.page.locator('[role="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      const parent = checkboxes.nth(i).locator("..");
      const text = await parent.textContent();
      if (text && new RegExp(cardName, "i").test(text)) {
        await checkboxes.nth(i).waitFor({ state: "visible", timeout: 5000 });
        await checkboxes.nth(i).click();
        return;
      }
    }

    throw new Error(`Card type "${cardName}" not found`);
  }

  /** Toggle the "Select All" option */
  async toggleSelectAll() {
    await this.page
      .getByRole("button", { name: /select all|deselect all/i })
      .click();
  }

  /** Get the number of selected cards */
  async getSelectedCardsCount(): Promise<number> {
    const badge = this.page.locator(
      'button:has-text("Generate") span.rounded-full',
    );
    if (await badge.count()) {
      const text = await badge.textContent();
      return Number.parseInt(text ?? "0", 10);
    }
    return 0;
  }

  /** Wait for loading to complete */
  async waitForLoadingComplete() {
    // Wait for the Generate button to not be in a loading state
    // The button text changes from "Generate" to "Generating..." during loading
    const generateButton = this.page.getByRole("button", {
      name: /generate/i,
    });

    // Wait for either:
    // 1. The generating button to disappear (replaced with results)
    // 2. Or the button to show "Generate" again (not "Generating...")
    await expect(generateButton.filter({ hasText: /generating/i }))
      .not.toBeVisible({ timeout: 30000 })
      .catch(() => {
        // Button might have been replaced with results, that's fine
      });
  }

  /** Check if error popup is visible */
  async isErrorPopupVisible() {
    const errorPopup = this.page
      .locator('[role="alert"]')
      .or(this.page.getByText(/error|failed/i));
    return errorPopup.isVisible();
  }

  /** Get the error message from the error popup */
  async getErrorMessage() {
    const errorText = this.page.locator('[role="alert"]').first();
    return errorText.textContent();
  }

  /** Close the error popup */
  async closeErrorPopup() {
    const dialogs = this.page.getByRole("dialog");
    const count = await dialogs.count();
    for (let i = 0; i < count; i++) {
      const dialog = dialogs.nth(i);
      // Find a heading or error indicator inside the dialog
      const heading = dialog.locator('h2, [role="heading"]').first();
      if ((await heading.count()) > 0) {
        const text = (await heading.textContent()) ?? "";
        if (
          /error|failed|user not found|rate limit|network connection|generation error/i.test(
            text,
          )
        ) {
          const closeButton = dialog.getByRole("button", {
            name: /close|dismiss|ok/i,
          });
          if ((await closeButton.count()) > 0) {
            await closeButton.first().click({ force: true });
            return;
          }
        }
      }
    }

    // Fallback: try any close button if we couldn't find an explicit error dialog
    const fallback = this.page.getByRole("button", {
      name: /close|dismiss|ok/i,
    });
    if ((await fallback.count()) > 0) {
      await fallback.first().click({ force: true });
      return;
    }

    throw new Error("No error dialog close button found");
  }

  /** Use keyboard navigation */
  async pressKey(key: string) {
    await this.page.keyboard.press(key);
  }
}

/**
 * Extended test with AniCards-specific fixtures.
 */
export const test = base.extend<AniCardsFixtures>({
  generatorPage: async ({ page }, use) => {
    const generatorPage = new GeneratorPage(page);
    await use(generatorPage);
  },

  mockSuccessfulApi: async ({ page }, use) => {
    // Mock the card API endpoint
    await page.route("**/api/card**", async (route: Route) => {
      const url = new URL(route.request().url());
      const username = url.searchParams.get("username");

      if (!username) {
        await route.fulfill({
          status: 400,
          contentType: "image/svg+xml",
          body: createErrorSvg("Missing username parameter"),
        });
        return;
      }

      // Return a mock SVG card
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: createMockCardSvg(username),
        headers: {
          "Access-Control-Allow-Origin": "*",
          "X-Card-Border-Radius": "8",
        },
      });
    });

    // Mock the get-user API endpoint
    await page.route("**/api/get-user**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUserRecord),
      });
    });

    // Mock the get-cards API endpoint
    await page.route("**/api/get-cards**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockCardsRecord),
      });
    });

    // Mock the store-cards API endpoint
    await page.route("**/api/store-cards**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    // Mock the store-users API endpoint
    await page.route("**/api/store-users**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await use();
  },

  mockRateLimitedApi: async ({ page }, use) => {
    await page.route("**/api/card**", async (route: Route) => {
      await route.fulfill({
        status: 429,
        contentType: "image/svg+xml",
        body: createErrorSvg("Rate limit exceeded"),
        headers: {
          "Retry-After": "60",
        },
      });
    });

    await page.route("**/api/get-user**", async (route: Route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify(mockRateLimitError),
      });
    });

    await use();
  },

  mockUserNotFoundApi: async ({ page }, use) => {
    await page.route("**/api/card**", async (route: Route) => {
      await route.fulfill({
        status: 404,
        contentType: "image/svg+xml",
        body: createErrorSvg("User not found"),
      });
    });

    await page.route("**/api/get-user**", async (route: Route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify(mockUserNotFoundError),
      });
    });

    await use();
  },

  mockNetworkError: async ({ page }, use) => {
    await page.route("**/api/**", async (route: Route) => {
      await route.abort("failed");
    });

    await use();
  },
});

/**
 * Create a mock SVG card for testing.
 */
function createMockCardSvg(username: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="800" height="400" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
  <style>
    .title { font-family: monospace; font-size: 24px; fill: #ffffff; }
    .stat { font-family: monospace; font-size: 16px; fill: #eaeaea; }
  </style>
  <rect width="100%" height="100%" fill="#1a1a2e" rx="8"/>
  <text x="50" y="50" class="title">${username}'s Anime Stats</text>
  <text x="50" y="100" class="stat">Episodes Watched: 3500</text>
  <text x="50" y="130" class="stat">Mean Score: 75.5</text>
  <text x="50" y="160" class="stat">Total Anime: 250</text>
  <circle cx="650" cy="200" r="80" fill="none" stroke="#4a9eff" stroke-width="8"/>
</svg>`;
}

/**
 * Create an error SVG for testing error states.
 */
function createErrorSvg(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="800" height="400" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
  <style>
    .error-text { font-family: monospace; font-size: 20px; fill: #ff5555; }
  </style>
  <rect width="100%" height="100%" fill="#1a1a1a"/>
  <text x="50%" y="50%" class="error-text" text-anchor="middle" dominant-baseline="middle">
    ${message}
  </text>
</svg>`;
}

export { expect } from "@playwright/test";
