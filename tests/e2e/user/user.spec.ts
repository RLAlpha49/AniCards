import { test, expect } from "@playwright/test";
import {
  mockCardsRecord,
  mockServerError,
  mockUserRecord,
} from "../fixtures/mock-data";

const mockSvgCard =
  '<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="200" fill="#111" /></svg>';

test.describe("User page", () => {
  test("shows fallback when no query params are provided", async ({ page }) => {
    await test.step("Navigate to user page", async () => {
      await page.goto("/user");
    });

    await test.step("Render not found state", async () => {
      await expect(
        page.getByRole("heading", { name: /something went wrong/i }),
      ).toBeVisible();

      await expect(page.getByText(/no user specified/i)).toBeVisible();

      const searchForUser = page.getByRole("link", {
        name: /search for user/i,
      });
      await expect(searchForUser).toHaveAttribute("href", "/search");
    });
  });

  test("renders stat cards for a username query and exposes export controls", async ({
    page,
  }) => {
    await test.step("Mock user and cards API responses", async () => {
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
    });

    await test.step("Load the user page", async () => {
      await page.goto("/user?username=TestUser");
    });

    await test.step("Verify hero heading and rendered cards", async () => {
      // Page now shows a welcome heading for returning users
      await expect(
        page.getByRole("heading", { level: 1, name: /testuser/i }),
      ).toBeVisible();

      // Wait for the cards section to be visible then assert preview images exist
      await expect(
        page.getByRole("heading", { name: /your cards/i }),
      ).toBeVisible();
      const cards = page.getByRole("img", { name: /stats/i });
      await expect(cards).toHaveCount(mockCardsRecord.cards.length);
    });

    await test.step("Inspect export controls", async () => {
      // Select the rendered cards so the bulk actions toolbar appears
      await page
        .getByRole("checkbox", { name: /select anime stats card/i })
        .check();
      await page
        .getByRole("checkbox", { name: /select social stats card/i })
        .check();

      const toolbar = page.locator('[data-testid="bulk-actions-toolbar"]');
      await expect(toolbar).toBeVisible();

      const buttons = toolbar.locator("button");
      // Confirm button order and labels (Select all enabled will appear first)
      await expect(buttons.nth(0)).toContainText(/select all enabled/i);
      await expect(buttons.nth(1)).toContainText(/copy/i);
      await expect(buttons.nth(2)).toContainText(/download/i);

      // Copy popover trigger (second button in the toolbar - first is "Select all enabled")
      const copyTrigger = buttons.nth(1);
      await expect(copyTrigger).toBeVisible();
      await copyTrigger.click({ force: true });
      await expect(page.getByText(/raw urls/i)).toBeVisible({ timeout: 10000 });

      // Download popover trigger (third button in the toolbar)
      const downloadTrigger = buttons.nth(2);
      await expect(downloadTrigger).toBeVisible();
      await downloadTrigger.click({ force: true });
      await expect(page.getByText(/png/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test("surfaces a friendly error when user fetch fails", async ({ page }) => {
    await test.step("Mock failing user API", async () => {
      await page.route("**/api/get-user**", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify(mockServerError),
        });
      });
    });

    await test.step("Visit user page with invalid username", async () => {
      await page.goto("/user?username=BrokenUser");
    });

    await test.step("Show error UI with recovery", async () => {
      await expect(page.getByText(/something went wrong/i)).toBeVisible();
      // Server errors are surfaced directly (e.g. "Server error")
      await expect(
        page.getByText(/server error|an unexpected error occurred/i),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /search for user/i }),
      ).toBeVisible();
    });
  });

  test("falls back to initial enabled snapshot when get-cards returns empty for new user", async ({
    page,
  }) => {
    await test.step("Mock 404 get-user and subsequent endpoints", async () => {
      await page.route("**/api/get-user**", async (route) => {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "User not found" }),
        });
      });

      await page.route("**/api/anilist**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            User: {
              id: 999,
              name: "NewUser",
              avatar: { medium: "https://example.test/avatar.png" },
            },
          }),
        });
      });

      await page.route("**/api/store-users**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      });

      await page.route("**/api/store-cards**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      });

      await page.route("**/api/get-cards**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ cards: [] }),
        });
      });

      await page.route("**/api/card**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "image/svg+xml",
          body: mockSvgCard,
        });
      });
    });

    await page.goto("/user?userId=999");

    await expect(page.getByText(/welcome to anicards/i)).toBeVisible();

    const images = page.locator("main").locator("img");
    // Wait for at least one preview image to appear (initial cards snapshot should enable previews)
    await expect(images.first()).toBeVisible();
    const imageCount = await images.count();
    // We expect at least one preview image (cards were initialized and enabled)
    expect(imageCount).toBeGreaterThan(0);
  });
});
