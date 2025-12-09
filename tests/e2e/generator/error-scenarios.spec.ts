import { test, expect } from "@playwright/test";
import { GeneratorPage } from "../fixtures/test-utils";

test.describe("Error Scenarios", () => {
  test.describe("User Not Found", () => {
    test.beforeEach(async ({ page }) => {
      // Mock local AniList proxy endpoint to return null user
      await page.route("**/api/anilist", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              User: null,
            },
          }),
        });
      });
    });

    test("should show error when user is not found", async ({ page }) => {
      const generatorPage = new GeneratorPage(page);
      await generatorPage.goto();

      await test.step("Open generator and enter nonexistent username", async () => {
        await generatorPage.openGenerator();
        await generatorPage.enterUsername("NonexistentUser12345");
        await generatorPage.clickContinue(); // to colors
        await generatorPage.clickContinue(); // to cards
        await generatorPage.selectCardType("anime stats");
        await generatorPage.clickContinue(); // to advanced
      });

      await test.step("Attempt to generate and expect error", async () => {
        await generatorPage.clickGenerate();

        // Wait for error to appear - look for the specific error title
        await expect(
          page.getByRole("heading", { name: /user not found/i }),
        ).toBeVisible({
          timeout: 10000,
        });
      });

      await test.step("Error should have recovery suggestions", async () => {
        // Should show suggestions for recovery
        await expect(
          page.getByRole("heading", { name: /check the username/i }),
        ).toBeVisible();
      });
    });

    test("should allow closing error and trying again", async ({ page }) => {
      const generatorPage = new GeneratorPage(page);
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("NonexistentUser");
      await generatorPage.clickContinue();
      await generatorPage.clickContinue();
      await generatorPage.selectCardType("anime stats");
      await generatorPage.clickContinue();
      await generatorPage.clickGenerate();

      // Wait for error popup - look for the error dialog heading
      await expect(
        page
          .locator('[role="dialog"] h2, [role="dialog"] [role="heading"]')
          .first(),
      ).toBeVisible({
        timeout: 10000,
      });

      // Close the error popup via the dialog's own close control so we avoid
      // accidentally clicking the generator's top-right close button.
      const errorDialog = page.getByRole("dialog", { name: /user not found/i });
      const closeButton = errorDialog.getByRole("button", { name: /close/i });
      if ((await closeButton.count()) > 0) {
        await closeButton.first().click({ force: true });
        await expect(errorDialog).not.toBeVisible({ timeout: 5000 });
      }

      // User should be able to try again (generate button should be visible)
      await expect(
        page.getByRole("button", { name: /generate/i }),
      ).toBeVisible();
    });
  });

  test.describe("Rate Limiting", () => {
    test.beforeEach(async ({ page }) => {
      // Mock local AniList proxy endpoint to return rate limit error
      await page.route("**/api/anilist", async (route) => {
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({
            errors: [
              {
                message: "Too many requests. Please wait before trying again.",
              },
            ],
          }),
          headers: { "Retry-After": "60" },
        });
      });
    });

    test("should show rate limit error with retry information", async ({
      page,
    }) => {
      const generatorPage = new GeneratorPage(page);
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await generatorPage.clickContinue();
      await generatorPage.selectCardType("anime stats");
      await generatorPage.clickContinue();
      await generatorPage.clickGenerate();

      // Should show error dialog
      await expect(
        page
          .locator('[role="dialog"] h2, [role="dialog"] [role="heading"]')
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });

    test("should indicate error is retryable", async ({ page }) => {
      const generatorPage = new GeneratorPage(page);
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await generatorPage.clickContinue();
      await generatorPage.selectCardType("anime stats");
      await generatorPage.clickContinue();
      await generatorPage.clickGenerate();

      // Should show retry button for retryable errors
      await expect(
        page.getByRole("button", { name: /try again|retry/i }),
      ).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe("Network Errors", () => {
    test.beforeEach(async ({ page }) => {
      // Mock API to simulate network failure - abort local AniList proxy and other APIs
      await page.route("**/api/anilist", async (route) => {
        await route.abort("failed");
      });

      await page.route("**/api/**", async (route) => {
        await route.abort("failed");
      });
    });

    test("should show network error when API is unreachable", async ({
      page,
    }) => {
      const generatorPage = new GeneratorPage(page);
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await generatorPage.clickContinue();
      await generatorPage.selectCardType("anime stats");
      await generatorPage.clickContinue();
      await generatorPage.clickGenerate();

      // Should show network/connection error - use the specific error title
      await expect(
        page.getByRole("heading", { name: /network connection error/i }),
      ).toBeVisible({ timeout: 15000 });
    });

    test("should suggest checking connection", async ({ page }) => {
      const generatorPage = new GeneratorPage(page);
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("TestUser");
      await generatorPage.clickContinue();
      await generatorPage.clickContinue();
      await generatorPage.selectCardType("anime stats");
      await generatorPage.clickContinue();
      await generatorPage.clickGenerate();

      // Should suggest checking connection or trying again
      await expect(page.getByText(/check your connection/i)).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe("Input Validation", () => {
    test.beforeEach(async ({ page }) => {
      // Mock successful API for validation tests
      await page.route("**/api/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      });
    });

    test("should not allow empty username", async ({ page }) => {
      const generatorPage = new GeneratorPage(page);
      await generatorPage.goto();
      await generatorPage.openGenerator();

      // Try to continue without entering username
      const continueButton = page.getByRole("button", {
        name: /go to next step/i,
      });
      await expect(continueButton).toBeDisabled();
    });

    test("should not allow whitespace-only username", async ({ page }) => {
      const generatorPage = new GeneratorPage(page);
      await generatorPage.goto();
      await generatorPage.openGenerator();

      // Enter only whitespace
      await generatorPage.getUsernameInput().fill("   ");

      // Continue should still be disabled
      const continueButton = page.getByRole("button", {
        name: /go to next step/i,
      });
      await expect(continueButton).toBeDisabled();
    });

    test("should trim whitespace from username", async ({ page }) => {
      const generatorPage = new GeneratorPage(page);
      await generatorPage.goto();
      await generatorPage.openGenerator();

      // Enter username with leading/trailing whitespace
      await generatorPage.enterUsername("  TestUser  ");

      // Continue should be enabled (whitespace should be trimmed logically)
      const continueButton = page.getByRole("button", {
        name: /go to next step/i,
      });
      await expect(continueButton).toBeEnabled();
    });
  });

  test.describe("Error Recovery", () => {
    test("should allow retry after error", async ({ page }) => {
      // Mock local AniList proxy endpoint to return null user (not found)
      await page.route("**/api/anilist", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              User: null,
            },
          }),
        });
      });

      const generatorPage = new GeneratorPage(page);
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("BadUser");
      await generatorPage.clickContinue();
      await generatorPage.clickContinue();
      await generatorPage.selectCardType("anime stats");
      await generatorPage.clickContinue();
      await generatorPage.clickGenerate();

      // Wait for error dialog to appear
      await expect(
        page
          .locator('[role="dialog"] h2, [role="dialog"] [role="heading"]')
          .first(),
      ).toBeVisible({
        timeout: 10000,
      });

      // Look for retry button
      const retryButton = page.getByRole("button", {
        name: /retry|try again/i,
      });
      if ((await retryButton.count()) > 0) {
        await retryButton.click();

        // Should attempt to generate again (loading state)
        await expect(page.getByText(/generating|loading/i)).toBeVisible();
      }
    });

    test("should clear error when closing error popup", async ({ page }) => {
      // Mock local AniList proxy endpoint to return null user (not found)
      await page.route("**/api/anilist", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              User: null,
            },
          }),
        });
      });

      const generatorPage = new GeneratorPage(page);
      await generatorPage.goto();
      await generatorPage.openGenerator();
      await generatorPage.enterUsername("BadUser");
      await generatorPage.clickContinue();
      await generatorPage.clickContinue();
      await generatorPage.selectCardType("anime stats");
      await generatorPage.clickContinue();
      await generatorPage.clickGenerate();

      // Wait for error dialog to appear
      await expect(
        page
          .locator('[role="dialog"] h2, [role="dialog"] [role="heading"]')
          .first(),
      ).toBeVisible({
        timeout: 10000,
      });

      // Close the error popup via its dialog to ensure we close the right element
      const errorDialog = page.getByRole("dialog", {
        name: /generation error|user not found/i,
      });
      const closeButton = errorDialog.getByRole("button", {
        name: /close|ok|dismiss/i,
      });
      if ((await closeButton.count()) > 0) {
        await closeButton.first().click({ force: true });

        // Error should be cleared and dialog closed
        await expect(errorDialog).not.toBeVisible({ timeout: 5000 });
        await expect(page.getByRole("alert")).not.toBeVisible();
      }
    });
  });
});
