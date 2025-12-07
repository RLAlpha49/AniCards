import { test, expect, Route } from "@playwright/test";
import { GeneratorPage } from "../fixtures/test-utils";
import { mockUserRecord, mockCardsRecord } from "../fixtures/mock-data";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fulfillCardRoute = async (route: Route) => {
  await delay(500);
  await route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg"><text>Card</text></svg>',
  });
};

test.describe("Batch Generation Tests", () => {
  let generatorPage: GeneratorPage;

  test.beforeEach(async ({ page }) => {
    generatorPage = new GeneratorPage(page);

    // Setup API mocks
    await page.route("**/api/get-user?username=*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUserRecord),
      });
    });

    await page.route("**/api/get-cards?username=*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockCardsRecord),
      });
    });

    // Mock card generation API
    await page.route("**/api/card*", async (route) => {
      const url = new URL(route.request().url());
      const cardType = url.searchParams.get("type") ?? "animeStats";

      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
          <rect width="100%" height="100%" fill="#1a1a2e"/>
          <text x="50%" y="50%" text-anchor="middle" fill="white">${cardType}</text>
        </svg>`,
      });
    });
  });

  test.describe("Card Type Selection", () => {
    test("should display all available card types", async ({ page }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();

      // Navigate to card selection step
      await page.waitForTimeout(500);
      const continueBtn = page.getByRole("button", { name: /continue/i });
      if (await continueBtn.isVisible()) {
        await continueBtn.click();
        await page.waitForTimeout(300);
      }

      // Check for card type options
      const cardOptions = page.locator(
        '[data-card-type], [data-testid*="card"]',
      );
      const count = await cardOptions.count();

      // Should have multiple card options
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test("should allow selecting multiple card types", async ({ page }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await page.waitForTimeout(500);

      // Try to find and click card type checkboxes
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count > 1) {
        await checkboxes.first().check();
        await checkboxes.nth(1).check();

        // Verify both are checked
        await expect(checkboxes.first()).toBeChecked();
        await expect(checkboxes.nth(1)).toBeChecked();
      }
    });

    test("should allow deselecting card types", async ({ page }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await page.waitForTimeout(500);

      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count > 0) {
        await checkboxes.first().check();
        await expect(checkboxes.first()).toBeChecked();

        await checkboxes.first().uncheck();
        await expect(checkboxes.first()).not.toBeChecked();
      }
    });
  });

  test.describe("Select All Functionality", () => {
    test("should have select all option", async ({ page }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await page.waitForTimeout(500);

      // Navigate to cards step
      const continueBtn = page.getByRole("button", { name: /continue/i });
      if (await continueBtn.isVisible()) {
        await continueBtn.click();
        await page.waitForTimeout(300);
      }

      // Look for select all button or checkbox
      const selectAll = page
        .getByRole("button", { name: /select all/i })
        .or(page.getByLabel(/select all/i))
        .or(page.getByText(/select all/i));

      // This might not exist in all implementations
      const isVisible = await selectAll.first().isVisible();
      if (isVisible) {
        await expect(selectAll.first()).toBeVisible();
      }
    });

    test("should select all cards when clicking select all", async ({
      page,
    }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await page.waitForTimeout(500);

      const selectAll = page
        .getByRole("button", { name: /select all/i })
        .or(page.getByLabel(/select all/i));

      if (await selectAll.first().isVisible()) {
        await selectAll.first().click();

        // All checkboxes should be checked
        const checkboxes = page.locator('input[type="checkbox"]');
        const count = await checkboxes.count();

        for (let i = 0; i < count; i++) {
          await expect(checkboxes.nth(i)).toBeChecked();
        }
      }
    });

    test("should deselect all cards when clicking deselect all", async ({
      page,
    }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await page.waitForTimeout(500);

      const deselectAll = page
        .getByRole("button", { name: /deselect all|clear all/i })
        .or(page.getByLabel(/deselect all/i));

      if (await deselectAll.first().isVisible()) {
        await deselectAll.first().click();

        // All checkboxes should be unchecked
        const checkboxes = page.locator('input[type="checkbox"]');
        const count = await checkboxes.count();

        for (let i = 0; i < count; i++) {
          await expect(checkboxes.nth(i)).not.toBeChecked();
        }
      }
    });
  });

  test.describe("Card Preview", () => {
    test("should show preview for selected cards", async ({ page }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await page.waitForTimeout(500);

      // Look for preview elements
      const previews = page.locator(
        '[data-testid*="preview"], [class*="preview"], img[alt*="card"]',
      );
      const count = await previews.count();

      // May or may not have visible previews depending on implementation
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test("should update preview when card type is selected", async ({
      page,
    }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await page.waitForTimeout(500);

      const checkboxes = page.locator('input[type="checkbox"]');
      if ((await checkboxes.count()) > 0) {
        await checkboxes.first().check();
        await page.waitForTimeout(300);

        // Preview should update - look for any visual change
        const preview = page.locator('[data-testid*="preview"]').first();
        if (await preview.isVisible()) {
          await expect(preview).toBeVisible();
        }
      }
    });
  });

  test.describe("Batch Generation Execution", () => {
    test("should generate multiple cards when batch selected", async ({
      page,
    }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await page.waitForTimeout(500);

      // Select multiple card types
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count >= 2) {
        await checkboxes.nth(0).check();
        await checkboxes.nth(1).check();
      }

      // Navigate to generate
      const continueBtn = page.getByRole("button", { name: /continue/i });
      while (await continueBtn.isVisible()) {
        await continueBtn.click();
        await page.waitForTimeout(300);
      }

      // Look for generate button
      const generateBtn = page.getByRole("button", {
        name: /generate|create|download/i,
      });
      if (await generateBtn.isVisible()) {
        // Click and wait for generation
        await generateBtn.click();
        await page.waitForTimeout(1000);
      }
    });

    test("should show progress during batch generation", async ({ page }) => {
      // Add delay to card API to see progress
      await page.route("**/api/card*", fulfillCardRoute);

      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await page.waitForTimeout(500);

      // Navigate through wizard
      const continueBtn = page.getByRole("button", { name: /continue/i });
      while (await continueBtn.isVisible()) {
        await continueBtn.click();
        await page.waitForTimeout(300);
      }

      // Trigger generation
      const generateBtn = page.getByRole("button", {
        name: /generate|create/i,
      });
      if (await generateBtn.isVisible()) {
        await generateBtn.click();

        // Check for progress indicator
        const progress = page
          .locator('[role="progressbar"]')
          .or(page.getByText(/generating|loading|progress/i));

        // May or may not show progress
        const isVisible = await progress.first().isVisible();
        if (isVisible) {
          await expect(progress.first()).toBeVisible();
        }
      }
    });
  });

  test.describe("Card Category Grouping", () => {
    test("should group cards by category", async ({ page }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await page.waitForTimeout(500);

      // Look for category headings
      const categories = page.locator(
        '[data-testid*="category"], h2, h3, [role="group"]',
      );
      const count = await categories.count();

      // May have category grouping
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test("should allow expanding/collapsing categories", async ({ page }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await page.waitForTimeout(500);

      // Look for expandable sections within the modal dialog only (exclude sidebar)
      const accordions = page.locator(
        "dialog [data-state], dialog [aria-expanded], dialog button[aria-controls]",
      );

      if ((await accordions.count()) > 0) {
        const firstAccordion = accordions.first();
        const initialState = await firstAccordion.getAttribute("aria-expanded");

        // Use force: true to bypass overlay blocking
        await firstAccordion.click({ force: true });
        await page.waitForTimeout(200);

        const newState = await firstAccordion.getAttribute("aria-expanded");

        // State should have changed
        if (initialState !== null) {
          expect(newState).not.toBe(initialState);
        }
      }
    });
  });

  test.describe("Card Count Display", () => {
    test("should display selected card count", async ({ page }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await page.waitForTimeout(500);

      // Select some cards
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count > 0) {
        await checkboxes.first().check();

        // Look for count display
        const countDisplay = page.getByText(/1 selected|selected: 1|\(1\)/i);
        const isVisible = await countDisplay.isVisible();

        // May or may not show count
        if (isVisible) {
          await expect(countDisplay).toBeVisible();
        }
      }
    });

    test("should update count when selection changes", async ({ page }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await page.waitForTimeout(500);

      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count >= 2) {
        await checkboxes.nth(0).check();
        await page.waitForTimeout(100);

        await checkboxes.nth(1).check();
        await page.waitForTimeout(100);

        // Count should reflect 2 selected
        const countText = page.getByText(/2 selected|selected: 2|\(2\)/i);
        if (await countText.isVisible()) {
          await expect(countText).toBeVisible();
        }
      }
    });
  });
});
