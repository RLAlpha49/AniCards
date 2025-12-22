import { expect, Page, test } from "@playwright/test";
import { GeneratorPage } from "../fixtures/test-utils";

const CARD_SETTINGS_KEY = "anicards-card-settings";

const readCardSettings = (page: Page) =>
  page.evaluate((storageKey) => {
    const raw = globalThis.localStorage.getItem(storageKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed.state ?? parsed;
    } catch {
      return null;
    }
  }, CARD_SETTINGS_KEY);

test.describe("Generator customization and options", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test("enables border styling and stores radius/color", async ({ page }) => {
    const generator = new GeneratorPage(page);

    await test.step("Open generator and reach Colors step", async () => {
      await generator.goto();
      await generator.openGenerator();
      await generator.enterUsername("BorderTester");
      const dialog = generator.getDialog();

      await generator.goToColorsStep();

      // Wait for animations to complete and content to be visible
      await page.waitForTimeout(1500);

      // The ColorPresetManager renders with a live preview
      await expect(
        dialog.getByText(/Live Preview|Presets/i).first(),
      ).toBeVisible({ timeout: 5000 });

      await expect(dialog.getByRole("button", { name: /Border/i })).toBeVisible(
        { timeout: 8000 },
      );
    });

    await test.step("Enable border tab controls", async () => {
      const dialog = generator.getDialog();
      const borderTab = dialog.getByRole("button", { name: /Border/i });
      await borderTab.click();

      const borderSection = dialog
        .locator("div", { hasText: /Enable Border/i })
        .first();
      await expect(borderSection).toBeVisible();

      const borderSwitch = borderSection.getByRole("switch").first();
      await borderSwitch.scrollIntoViewIfNeeded();
      await borderSwitch.click({ force: true });
      const radiusSection = dialog
        .locator("div", { hasText: /Border Radius/i })
        .first();
      await expect(radiusSection).toBeVisible();

      await page.getByRole("button", { name: /^20$/ }).click();

      const borderColorSection = dialog
        .locator("div", { hasText: /Custom Border Color/i })
        .first();
      await expect(borderColorSection).toBeVisible();

      const borderColorSwitch = borderColorSection.getByRole("switch").first();
      await borderColorSwitch.scrollIntoViewIfNeeded();
    });

    await test.step("Persist border settings", async () => {
      const dialog = generator.getDialog();

      await expect
        .poll(async () => (await readCardSettings(page))?.defaultBorderEnabled)
        .toBe(true);

      const radiusInput = dialog
        .locator("div", { hasText: /Border Radius/i })
        .getByRole("spinbutton")
        .first();
      await expect(radiusInput).toHaveValue("20.0");

      const borderColorSwitch = dialog
        .locator("div", { hasText: /Custom Border Color/i })
        .first()
        .getByRole("switch")
        .first();
      await expect(borderColorSwitch).toHaveAttribute("data-state", "checked");
    });
  });

  test("persists advanced option toggles", async ({ page }) => {
    const generator = new GeneratorPage(page);

    await test.step("Navigate to Advanced step", async () => {
      await generator.goto();
      await generator.openGenerator();
      await generator.enterUsername("OptionsUser");
      await generator.goToAdvancedStep();

      await expect(
        page.getByRole("heading", { name: /Advanced Options/i }),
      ).toBeVisible();
    });

    await test.step("Toggle status and chart options", async () => {
      const dialog = generator.getDialog();
      const switches = dialog.getByRole("switch");

      await switches.nth(0).click();
      await switches.nth(1).click();
      await switches.nth(2).click();
    });

    await test.step("Verify card settings persistence", async () => {
      await expect
        .poll(async () => (await readCardSettings(page))?.useAnimeStatusColors)
        .toBe(true);
      await expect
        .poll(async () => (await readCardSettings(page))?.useMangaStatusColors)
        .toBe(true);
      await expect
        .poll(async () => (await readCardSettings(page))?.showPiePercentages)
        .toBe(true);
    });
  });

  test("saves favorites and variant selection for card types", async ({
    page,
  }) => {
    const generator = new GeneratorPage(page);

    await test.step("Open generator and move to card selection", async () => {
      await generator.goto();
      await generator.openGenerator();
      await generator.enterUsername("FavoritesUser");
      await generator.clickContinue(); // Colors
      await generator.clickContinue(); // Cards
    });

    await test.step("Select card, variant, and favorites", async () => {
      await page.getByRole("tab", { name: /Anime Deep Dive/i }).click();

      const voiceActorsCard = page
        .getByText(/Anime Voice Actors/i)
        .first()
        .locator("xpath=ancestor::div[contains(@class,'rounded-2xl')]");
      await expect(voiceActorsCard).toBeVisible();

      const cardCheckbox = voiceActorsCard.getByRole("checkbox").first();
      await cardCheckbox.click();
      await expect(cardCheckbox).toBeChecked();

      const variantCombo = voiceActorsCard.getByRole("combobox");
      await variantCombo.click();
      await page.getByRole("option", { name: /Pie Chart/i }).click();

      const favoritesToggle = voiceActorsCard.getByLabel(/Show Favorites/i);
      await favoritesToggle.click();
      await expect(favoritesToggle).toBeChecked();
    });

    await test.step("Persist card selection choices", async () => {
      await expect
        .poll(async () =>
          (await readCardSettings(page))?.defaultCardTypes?.includes(
            "animeVoiceActors",
          ),
        )
        .toBe(true);

      await expect
        .poll(
          async () =>
            (await readCardSettings(page))?.defaultVariants?.animeVoiceActors,
        )
        .toBe("pie");

      await expect
        .poll(
          async () =>
            (await readCardSettings(page))?.defaultShowFavoritesByCard
              ?.animeVoiceActors,
        )
        .toBe(true);
    });
  });
});
