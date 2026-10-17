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

const goToCardSelectionStep = async (generatorPage: GeneratorPage) => {
  const dialog = generatorPage.getDialog();
  await generatorPage.goto();
  await generatorPage.openGenerator();
  await generatorPage.enterUsername("TestUser");
  await generatorPage.clickContinue();
  await expect(
    dialog.getByRole("heading", { name: /Live Preview/i }),
  ).toBeVisible();
  await generatorPage.clickContinue();
  await expect(
    dialog.getByRole("heading", { name: /Select Your Cards/i }),
  ).toBeVisible();
};

const getCardTypeCheckboxes = (generatorPage: GeneratorPage) =>
  generatorPage.getDialog().locator('[role="checkbox"]:not([id^="fav-"])');

const getCardSelectionSummary = (generatorPage: GeneratorPage) =>
  generatorPage.getDialog().getByText(/^\d+ of \d+ cards selected$/);

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
    test("should display all available card types", async () => {
      await goToCardSelectionStep(generatorPage);

      const cardOptions = getCardTypeCheckboxes(generatorPage);
      await expect(cardOptions.first()).toBeVisible();
      const count = await cardOptions.count();
      expect(count).toBeGreaterThan(1);
    });

    test("should allow selecting multiple card types", async () => {
      await goToCardSelectionStep(generatorPage);

      const checkboxes = getCardTypeCheckboxes(generatorPage);
      await expect(checkboxes.nth(1)).toBeVisible();
      await checkboxes.first().click();
      await checkboxes.nth(1).click();

      await expect(checkboxes.first()).toBeChecked();
      await expect(checkboxes.nth(1)).toBeChecked();
    });

    test("should allow deselecting card types", async () => {
      await goToCardSelectionStep(generatorPage);

      const checkbox = getCardTypeCheckboxes(generatorPage).first();
      await expect(checkbox).toBeVisible();
      await checkbox.click();
      await expect(checkbox).toBeChecked();

      await checkbox.click();
      await expect(checkbox).not.toBeChecked();
    });
  });

  test.describe("Select All Functionality", () => {
    test("should have select all option", async () => {
      await goToCardSelectionStep(generatorPage);

      const selectAll = generatorPage
        .getDialog()
        .getByRole("button", { name: /select all cards/i });
      await expect(selectAll).toBeVisible();
    });

    test("should select all cards when clicking select all", async () => {
      await goToCardSelectionStep(generatorPage);

      const selectAll = generatorPage.getDialog().getByRole("button", {
        name: /select all cards|unselect all cards/i,
      });
      const checkboxes = getCardTypeCheckboxes(generatorPage);
      await selectAll.click();

      await expect(selectAll).toHaveAccessibleName(/unselect all cards/i);
      const count = await checkboxes.count();
      for (let i = 0; i < count; i++) {
        await expect(checkboxes.nth(i)).toBeChecked();
      }
    });

    test("should deselect all cards when clicking deselect all", async () => {
      await goToCardSelectionStep(generatorPage);

      const selectAll = generatorPage
        .getDialog()
        .getByRole("button", { name: /select all cards|unselect all cards/i });
      await selectAll.click();
      await expect(selectAll).toHaveAccessibleName(/unselect all cards/i);

      await selectAll.click();
      await expect(selectAll).toHaveAccessibleName(/select all cards/i);
      await expect(getCardSelectionSummary(generatorPage)).toHaveText(
        /^0 of \d+ cards selected$/,
      );

      const checkboxes = getCardTypeCheckboxes(generatorPage);
      const count = await checkboxes.count();
      for (let i = 0; i < count; i++) {
        await expect(checkboxes.nth(i)).not.toBeChecked();
      }
    });
  });

  test.describe("Card Preview", () => {
    test("should show preview for selected cards", async ({ page }) => {
      await goToCardSelectionStep(generatorPage);

      const dialog = generatorPage.getDialog();
      const checkbox = getCardTypeCheckboxes(generatorPage).first();
      await checkbox.click();
      await expect(checkbox).toBeChecked();

      await dialog.locator('button[title="Preview Card"]').first().click();
      const previewDialog = page
        .getByRole("dialog")
        .filter({ hasText: /Card Preview/i });
      await expect(previewDialog).toBeVisible();
      await expect(
        previewDialog.getByRole("img", {
          name: /Preview of animeStats stat card/i,
        }),
      ).toBeVisible();
    });

    test("should update preview when card type is selected", async ({
      page,
    }) => {
      await goToCardSelectionStep(generatorPage);

      const dialog = generatorPage.getDialog();
      const checkbox = getCardTypeCheckboxes(generatorPage).nth(1);
      await expect(checkbox).toBeVisible();
      await checkbox.click();
      await expect(checkbox).toBeChecked();
      await expect(getCardSelectionSummary(generatorPage)).toHaveText(
        /^1 of \d+ cards selected$/,
      );

      await dialog.locator('button[title="Preview Card"]').nth(1).click();
      const previewDialog = page
        .getByRole("dialog")
        .filter({ hasText: /Card Preview/i });
      await expect(
        previewDialog.getByRole("img", {
          name: /Preview of mangaStats stat card/i,
        }),
      ).toBeVisible();
    });
  });

  test.describe("Batch Generation Execution", () => {
    test("should generate multiple cards when batch selected", async () => {
      await goToCardSelectionStep(generatorPage);

      const dialog = generatorPage.getDialog();
      const checkboxes = getCardTypeCheckboxes(generatorPage);
      await expect(checkboxes.nth(1)).toBeVisible();
      await checkboxes.nth(0).click();
      await checkboxes.nth(1).click();
      await expect(getCardSelectionSummary(generatorPage)).toHaveText(
        /^2 of \d+ cards selected$/,
      );

      await generatorPage.clickContinue();
      await expect(
        dialog.getByRole("heading", { name: /Advanced Options/i }),
      ).toBeVisible();

      const generateButton = dialog.getByRole("button", {
        name: /Generate cards with 2 selected cards/i,
      });
      await expect(generateButton).toBeEnabled();
      await generateButton.click();
      await expect(dialog.locator('output[aria-busy="true"]')).toBeVisible();
    });

    test("should show progress during batch generation", async ({ page }) => {
      // Add delay to card API to see progress
      await page.route("**/api/card*", fulfillCardRoute);

      await goToCardSelectionStep(generatorPage);

      const dialog = generatorPage.getDialog();
      const checkboxes = getCardTypeCheckboxes(generatorPage);
      await expect(checkboxes.nth(1)).toBeVisible();
      await checkboxes.nth(0).click();
      await checkboxes.nth(1).click();
      await expect(getCardSelectionSummary(generatorPage)).toHaveText(
        /^2 of \d+ cards selected$/,
      );

      await generatorPage.clickContinue();
      await expect(
        dialog.getByRole("heading", { name: /Advanced Options/i }),
      ).toBeVisible();

      await generatorPage.clickGenerate();
      await expect(dialog.locator('output[aria-busy="true"]')).toBeVisible();
    });
  });

  test.describe("Card Category Grouping", () => {
    test("should group cards by category", async () => {
      await goToCardSelectionStep(generatorPage);

      const categories = generatorPage
        .getDialog()
        .getByRole("navigation", { name: /Card category tabs/i })
        .getByRole("tab");
      await expect(categories.first()).toBeVisible();
      const count = await categories.count();
      expect(count).toBeGreaterThan(1);
    });

    test("should allow switching card categories", async () => {
      await goToCardSelectionStep(generatorPage);

      const dialog = generatorPage.getDialog();
      const animeDeepDiveTab = dialog.getByRole("tab", {
        name: /Anime Deep Dive category/i,
      });
      await animeDeepDiveTab.click();

      await expect(animeDeepDiveTab).toHaveAttribute("aria-selected", "true");
      await expect(dialog.getByText(/Anime Voice Actors/i)).toBeVisible();
    });
  });

  test.describe("Card Count Display", () => {
    test("should display selected card count", async () => {
      await goToCardSelectionStep(generatorPage);

      const checkbox = getCardTypeCheckboxes(generatorPage).first();
      const countDisplay = getCardSelectionSummary(generatorPage);
      await expect(countDisplay).toHaveText(/^0 of \d+ cards selected$/);
      await checkbox.click();
      await expect(countDisplay).toHaveText(/^1 of \d+ cards selected$/);
    });

    test("should update count when selection changes", async () => {
      await goToCardSelectionStep(generatorPage);

      const checkboxes = getCardTypeCheckboxes(generatorPage);
      const countText = getCardSelectionSummary(generatorPage);
      await expect(checkboxes.nth(1)).toBeVisible();

      await checkboxes.nth(0).click();
      await expect(countText).toHaveText(/^1 of \d+ cards selected$/);

      await checkboxes.nth(1).click();
      await expect(countText).toHaveText(/^2 of \d+ cards selected$/);
    });
  });
});
