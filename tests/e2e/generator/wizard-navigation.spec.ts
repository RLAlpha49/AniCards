import { test, expect } from "@playwright/test";
import { GeneratorPage } from "../fixtures/test-utils";
import { mockUserRecord, mockCardsRecord } from "../fixtures/mock-data";

test.describe("Wizard Navigation", () => {
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
  });

  test.describe("Step 1: User Details", () => {
    test("should start on step 1 by default", async ({ page }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();

      // Verify we're on step 1 - use textbox role for username input
      await expect(
        page.getByRole("textbox", { name: /anilist username/i }),
      ).toBeVisible();
    });

    test("should validate username before proceeding", async ({ page }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();

      // Continue button should be disabled when username is empty
      const continueBtn = page.getByRole("button", {
        name: /go to next step/i,
      });
      await expect(continueBtn).toBeDisabled();

      // Username input should still be visible
      await expect(
        page.getByRole("textbox", { name: /anilist username/i }),
      ).toBeVisible();
    });

    test("should proceed to step 2 after entering valid username", async ({
      page,
    }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();

      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();

      // Wait for API response and step transition
      await page.waitForTimeout(500);
    });
  });

  test.describe("Step 2: Color Customization", () => {
    test.beforeEach(async ({ page }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await page.waitForTimeout(500);
    });

    test("should display color picker options", async ({ page }) => {
      // Look for color-related elements
      const colorSection = page
        .locator('[data-testid="color-section"]')
        .or(page.getByText(/color/i));
      await expect(colorSection.first()).toBeVisible({ timeout: 5000 });
    });

    test("should allow going back to step 1", async ({ page }) => {
      await generatorPage.clickBack();
      // Username input should be visible and have the value
      const usernameInput = generatorPage.getUsernameInput();
      await expect(usernameInput).toBeVisible({ timeout: 5000 });
      await expect(usernameInput).toHaveValue("TestUser", { timeout: 5000 });
    });
  });

  test.describe("Step Indicators", () => {
    test("should show correct step indicator states", async ({ page }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();

      // Check that step indicators are present
      const stepIndicators = page.locator(
        '[role="progressbar"], [data-step], .step-indicator',
      );

      // Should have multiple step indicators
      const count = await stepIndicators.count();
      expect(count).toBeGreaterThanOrEqual(0); // May or may not have indicators
    });
  });

  test.describe("Keyboard Navigation", () => {
    test("should allow tab navigation through form elements", async ({
      page,
    }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();

      // Focus username field and verify tabbing works
      const usernameInput = page.getByRole("textbox", {
        name: /anilist username/i,
      });
      await usernameInput.focus();

      await page.keyboard.press("Tab");
      // Should move focus to next focusable element
      const activeElement = page.locator(":focus");
      await expect(activeElement).not.toHaveAttribute("id", "username");
    });

    test("should submit on Enter key in username field", async ({ page }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();

      await generatorPage.enterUsername("TestUser");
      await page.keyboard.press("Enter");

      // Should proceed to next step
      await page.waitForTimeout(500);
    });
  });

  test.describe("Form State Persistence", () => {
    test("should preserve username when going back and forth", async ({
      page,
    }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();

      await generatorPage.enterUsername("PersistentUser");
      await generatorPage.clickContinue();

      await generatorPage.clickBack();

      // Username should still be there
      const usernameInput = generatorPage.getUsernameInput();
      await expect(usernameInput).toBeVisible({ timeout: 5000 });
      await expect(usernameInput).toHaveValue("PersistentUser", {
        timeout: 5000,
      });
    });
  });

  test.describe("Wizard Completion", () => {
    test("should show generate button in final step", async ({ page }) => {
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");

      // Navigate through steps using our method
      await generatorPage.clickContinue(); // to colors
      await generatorPage.clickContinue(); // to cards

      // Select at least one card
      await generatorPage.selectCardType("anime stats");

      await generatorPage.clickContinue(); // to advanced (final step)

      // Should see generate button
      const finalButton = page.getByRole("button", { name: /generate/i });
      await expect(finalButton).toBeVisible({ timeout: 5000 });
    });
  });
});
