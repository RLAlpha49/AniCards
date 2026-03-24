import { expect, test } from "@playwright/test";

import { mockCardsRecord, mockUserRecord } from "../fixtures/mock-data";

const mockSvgCard =
  '<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="200" fill="#111" /></svg>';

test.describe("User page editor - save UX", () => {
  test("Ctrl+S triggers a minimal /api/store-cards payload", async ({
    page,
  }) => {
    const savePayloads: unknown[] = [];

    await test.step("Mock user, cards, preview, and save endpoints", async () => {
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

      await page.route("**/api/card**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "image/svg+xml",
          body: mockSvgCard,
        });
      });

      await page.route("**/api/store-cards", async (route) => {
        const postData = route.request().postData();
        savePayloads.push(postData ? JSON.parse(postData) : null);

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            updatedAt: "2025-01-01T00:00:00.000Z",
          }),
        });
      });
    });

    await test.step("Load the user editor", async () => {
      await page.goto("/user?username=TestUser");
      await expect(
        page.getByRole("heading", { level: 1, name: /testuser/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Your Cards" }),
      ).toBeVisible();
      await expect(page.getByTestId("card-tile-animeStats")).toBeVisible();
    });

    await test.step("Make an edit to enable saving", async () => {
      const animeToggle = page.getByRole("switch", {
        name: /toggle anime stats card/i,
      });
      await expect(animeToggle).toBeVisible();

      await expect(animeToggle).toHaveAttribute("aria-checked", "true");
      await animeToggle.click();
      await expect(animeToggle).toHaveAttribute("aria-checked", "false");
    });

    await test.step("Press Ctrl+S and capture the save payload", async () => {
      const startCount = savePayloads.length;
      await page.keyboard.press("Control+S");

      await expect
        .poll(() => savePayloads.length, { timeout: 5000 })
        .toBe(startCount + 1);

      const payload = savePayloads.at(-1) as Record<string, unknown>;
      expect(String(payload.userId)).toBe("123456");
      expect(payload.ifMatchUpdatedAt).toBe(mockCardsRecord.updatedAt);

      const cards = payload.cards as Array<Record<string, unknown>>;
      expect(Array.isArray(cards)).toBe(true);
      expect(cards).toHaveLength(1);
      expect(cards[0]?.cardName).toBe("animeStats");
      expect(cards[0]?.disabled).toBe(true);
    });

    await test.step("Editor should become clean after save", async () => {
      const saveButton = page.getByRole("button", { name: /save changes/i });
      await expect(saveButton).toBeDisabled();
    });
  });

  test("Discard confirmation reverts edits", async ({ page }) => {
    let saveCount = 0;

    await test.step("Mock endpoints", async () => {
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

      await page.route("**/api/card**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "image/svg+xml",
          body: mockSvgCard,
        });
      });

      await page.route("**/api/store-cards", async (route) => {
        saveCount += 1;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            updatedAt: "2025-01-01T00:00:00.000Z",
          }),
        });
      });
    });

    await test.step("Load the user editor", async () => {
      await page.goto("/user?username=TestUser");
      await expect(
        page.getByRole("heading", { name: "Your Cards" }),
      ).toBeVisible();
    });

    await test.step("Toggle a card and then discard changes", async () => {
      const animeToggle = page.getByRole("switch", {
        name: /toggle anime stats card/i,
      });

      await expect(animeToggle).toHaveAttribute("aria-checked", "true");
      await animeToggle.click();
      await expect(animeToggle).toHaveAttribute("aria-checked", "false");

      await page
        .getByRole("button", { name: /discard unsaved changes/i })
        .click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: /discard changes/i })
        .click();

      await expect(animeToggle).toHaveAttribute("aria-checked", "true");
      await expect(
        page.getByRole("button", { name: /save changes/i }),
      ).toBeDisabled();
    });

    await test.step("No autosave should have fired after discarding", async () => {
      await expect.poll(() => saveCount, { timeout: 2500 }).toBe(0);
    });
  });
});
