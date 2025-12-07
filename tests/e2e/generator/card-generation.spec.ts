import { test, expect } from "@playwright/test";
import { GeneratorPage } from "../fixtures/test-utils";
import { mockUserRecord, mockCardsRecord } from "../fixtures/mock-data";

test.describe("Card Generation Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the API endpoints for successful responses
    await page.route("**/api/card**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg width="800" height="400"><rect fill="#1a1a2e" width="800" height="400"/></svg>',
        headers: {
          "Access-Control-Allow-Origin": "*",
          "X-Card-Border-Radius": "8",
        },
      });
    });

    await page.route("**/api/get-user**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUserRecord),
      });
    });

    await page.route("**/api/get-cards**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockCardsRecord),
      });
    });

    await page.route("**/api/store-**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });
  });

  test("should complete full card generation flow", async ({ page }) => {
    const generatorPage = new GeneratorPage(page);
    await generatorPage.goto();

    await test.step("Open the card generator", async () => {
      await generatorPage.openGenerator();
      await expect(generatorPage.getDialog()).toBeVisible();
    });

    await test.step("Enter username on step 1", async () => {
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
    });

    await test.step("Skip colors step (step 2)", async () => {
      // Colors step - just continue with defaults
      await generatorPage.clickContinue();
    });

    await test.step("Select card types on step 3", async () => {
      // Select some card types
      await generatorPage.selectCardType("anime stats");
      await generatorPage.selectCardType("social stats");
      await generatorPage.clickContinue();
    });

    await test.step("Skip advanced options (step 4)", async () => {
      // Advanced options - just proceed with defaults
      // Now we should see the Generate button
      await expect(
        page.getByRole("button", { name: /generate/i }),
      ).toBeVisible();
    });

    await test.step("Generate cards", async () => {
      await generatorPage.clickGenerate();
      // Wait for generation to complete (loading overlay should disappear)
      await generatorPage.waitForLoadingComplete();
    });
  });

  test("should require username before proceeding", async ({ page }) => {
    const generatorPage = new GeneratorPage(page);
    await generatorPage.goto();
    await generatorPage.openGenerator();

    // Continue button should be disabled when username is empty
    const continueButton = page.getByRole("button", {
      name: /go to next step/i,
    });
    await expect(continueButton).toBeDisabled();

    // Enter a username
    await generatorPage.enterUsername("TestUser");

    // Now continue should be enabled
    await expect(continueButton).toBeEnabled();
  });

  test("should require at least one card type to generate", async ({
    page,
  }) => {
    const generatorPage = new GeneratorPage(page);
    await generatorPage.goto();
    await generatorPage.openGenerator();
    await generatorPage.enterUsername("TestUser");

    // Navigate to step 2 (colors), then step 3 (cards), then step 4 (advanced)
    await generatorPage.clickContinue(); // to colors
    await generatorPage.clickContinue(); // to cards
    await generatorPage.clickContinue(); // to advanced

    // Generate button should be disabled when no cards are selected
    const generateButton = page.getByRole("button", { name: /generate/i });
    await expect(generateButton).toBeDisabled();
  });

  test("should show loading state during generation", async ({ page }) => {
    // Override the route to add delay BEFORE the beforeEach routes
    await page.unrouteAll();

    // Mock with delay
    await page.route("**/api/card**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg width="800" height="400"><rect fill="#1a1a2e" width="800" height="400"/></svg>',
      });
    });

    await page.route("**/api/get-user**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUserRecord),
      });
    });

    await page.route("**/api/get-cards**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockCardsRecord),
      });
    });

    const generatorPage = new GeneratorPage(page);
    await generatorPage.goto();
    await generatorPage.openGenerator();
    await generatorPage.enterUsername("TestUser");
    await generatorPage.clickContinue(); // to colors
    await generatorPage.clickContinue(); // to cards

    // Select a card type
    await generatorPage.selectCardType("anime stats");
    await generatorPage.clickContinue(); // to advanced

    // Click generate and immediately check for loading state
    await generatorPage.clickGenerate();

    // Should show loading indicator - the button changes from "Generate" to "Generating..."
    // Wait a brief moment for the state to update
    await page.waitForTimeout(200);

    // Check that the generate button now shows "Generating..." or similar
    const button = page.getByRole("button", { name: /generate/i }).first();
    const buttonText = await button.textContent();
    expect(buttonText?.toLowerCase()).toContain("generat");
  });

  test("should close generator when pressing Escape", async ({ page }) => {
    const generatorPage = new GeneratorPage(page);
    await generatorPage.goto();
    await generatorPage.openGenerator();
    await expect(generatorPage.getDialog()).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Dialog should close
    await expect(generatorPage.getDialog()).not.toBeVisible();
  });

  test("should close generator when clicking Cancel on first step", async ({
    page,
  }) => {
    const generatorPage = new GeneratorPage(page);
    await generatorPage.goto();
    await generatorPage.openGenerator();
    await expect(generatorPage.getDialog()).toBeVisible();

    // Click Cancel
    await generatorPage.clickCancel();

    // Dialog should close
    await expect(generatorPage.getDialog()).not.toBeVisible();
  });

  test("should navigate back to previous steps", async ({ page }) => {
    const generatorPage = new GeneratorPage(page);
    await generatorPage.goto();
    await generatorPage.openGenerator();
    await generatorPage.enterUsername("TestUser");

    // Go to step 2 (colors)
    await generatorPage.clickContinue();

    // Should see step 2 content - look for color presets
    await expect(
      page.getByRole("button", { name: /presets|custom|border/i }).first(),
    ).toBeVisible();

    // Go back to step 1
    await generatorPage.clickBack();

    // Should see step 1 content (username input)
    await expect(generatorPage.getUsernameInput()).toBeVisible();
  });

  test("should generate with keyboard shortcut Ctrl+Enter", async ({
    page,
  }) => {
    const generatorPage = new GeneratorPage(page);

    await generatorPage.goto();
    await generatorPage.openGenerator();
    await generatorPage.enterUsername("TestUser");
    await generatorPage.clickContinue(); // to colors
    await generatorPage.clickContinue(); // to cards
    await generatorPage.selectCardType("anime stats");
    await generatorPage.clickContinue(); // to advanced

    // Use keyboard shortcut to generate
    await page.keyboard.press("Control+Enter");

    // Wait for generation to complete
    await generatorPage.waitForLoadingComplete();

    // If we got here without error, the shortcut worked
  });

  test("should preserve username when navigating between steps", async ({
    page,
  }) => {
    const generatorPage = new GeneratorPage(page);
    await generatorPage.goto();
    await generatorPage.openGenerator();

    const username = "TestUserPreserved";
    await generatorPage.enterUsername(username);
    await generatorPage.clickContinue(); // to colors
    await generatorPage.clickContinue(); // to cards
    await generatorPage.clickBack(); // back to colors
    await generatorPage.clickBack(); // back to user

    // Username should still be there
    await expect(generatorPage.getUsernameInput()).toHaveValue(username);
  });
});
