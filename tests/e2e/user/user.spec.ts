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

    await test.step("Per-card quick actions are hidden by default and appear on preview hover/focus", async () => {
      // Ensure we are not accidentally hovering a card tile before asserting hidden state.
      await page.getByRole("heading", { name: /your cards/i }).hover();

      const tile = page.getByTestId("card-tile-animeStats");
      const openLink = tile.getByRole("link", { name: /^open/i, includeHidden: true });
      const copyTrigger = tile.getByRole("button", {
        name: /copy url/i,
        includeHidden: true,
      });
      const downloadTrigger = tile.getByRole("button", {
        name: /^download$/i,
        includeHidden: true,
      });

      await expect(openLink).toBeHidden();
      await expect(copyTrigger).toBeHidden();
      await expect(downloadTrigger).toBeHidden();

      // Keyboard users should get quick actions via focus-within on the preview itself.
      const previewToggle = tile.getByRole("button", {
        name: /toggle actions for/i,
      });
      await previewToggle.focus();
      await expect(openLink).toBeVisible();
      await expect(copyTrigger).toBeVisible();
      await expect(downloadTrigger).toBeVisible();

      await expect(openLink).toHaveAttribute("target", "_blank");
      await expect(openLink).toHaveAttribute(
        "rel",
        /\bnoopener\b.*\bnoreferrer\b|\bnoreferrer\b.*\bnoopener\b/i,
      );
      await expect(openLink).toHaveAttribute("href", /\/api\/card/i);

      // And mouse users via hover.
      // First move focus off the preview so we're only validating hover.
      await tile
        .getByRole("checkbox", { name: /select anime stats card/i })
        .focus();
      await page.getByRole("heading", { name: /your cards/i }).hover();
      await expect(openLink).toBeHidden();

      await tile
        .getByRole("img", { name: /preview/i })
        .first()
        .hover({ position: { x: 10, y: 10 } });
      await expect(openLink).toBeVisible();
      await expect(copyTrigger).toBeVisible();
      await expect(downloadTrigger).toBeVisible();
    });

    await test.step("Variant comparison view can be toggled", async () => {
      const tile = page.getByTestId("card-tile-animeStats");
      const expandButton = tile.getByRole("button", { name: /expand/i });
      await expect(expandButton).toBeVisible();
      await expandButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      const compareButton = dialog.getByRole("button", { name: /compare/i });
      await expect(compareButton).toBeVisible();

      // Default is single preview; after enabling compare it should render two previews.
      const previews = dialog.getByRole("img", { name: /preview/i });
      await expect(previews).toHaveCount(1);

      await compareButton.click();
      await expect(previews).toHaveCount(2);

      // Both previews should have quick actions available (Open + Download, etc.).
      const openLinks = dialog.getByRole("link", {
        name: /^open/i,
        includeHidden: true,
      });
      const copyButtons = dialog.getByRole("button", {
        name: /copy url/i,
        includeHidden: true,
      });
      const downloadButtons = dialog.getByRole("button", {
        name: /^download$/i,
        includeHidden: true,
      });
      await expect(openLinks).toHaveCount(2);
      await expect(copyButtons).toHaveCount(2);
      await expect(downloadButtons).toHaveCount(2);

      // Hovering one preview should only show quick actions for that preview.
      await dialog.hover({ position: { x: 10, y: 10 } });
      await previews.nth(0).hover({ position: { x: 10, y: 10 } });
      await expect(openLinks.nth(0)).toBeVisible();
      await expect(openLinks.nth(1)).toBeHidden();
      await expect(downloadButtons.nth(0)).toBeVisible();
      await expect(downloadButtons.nth(1)).toBeHidden();

      await dialog.hover({ position: { x: 10, y: 10 } });
      await previews.nth(1).hover({ position: { x: 10, y: 10 } });
      await expect(openLinks.nth(1)).toBeVisible();
      await expect(openLinks.nth(0)).toBeHidden();
      await expect(downloadButtons.nth(1)).toBeVisible();
      await expect(downloadButtons.nth(0)).toBeHidden();

      // Close the dialog so subsequent steps can interact with the page.
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
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

      // Use role-based selectors scoped to the toolbar so the test doesn't rely on button order
      const selectAllButton = toolbar.getByRole("button", {
        name: /select all enabled/i,
      });
      const copyButton = toolbar.getByRole("button", {
        name: /copy/i,
      });
      const downloadButton = toolbar.getByRole("button", {
        name: /download/i,
      });

      await expect(selectAllButton).toBeVisible();
      await expect(copyButton).toBeVisible();
      await expect(downloadButton).toBeVisible();

      // Open the copy popover and verify its contents
      await copyButton.click();
      await expect(page.getByText(/raw urls/i)).toBeVisible();

      // Open the download popover and verify its contents
      await downloadButton.click();
      await expect(page.getByText(/png/i)).toBeVisible();
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
              avatar: { medium: "https://s1.anilist.co/avatar.png" },
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

      await page.route("**s1.anilist.co/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "image/png",
          body: "",
        });
      });
    });

    await page.goto("/user?userId=999");

    await expect(
      page.getByRole("heading", { level: 1, name: /newuser/i }),
    ).toBeVisible({ timeout: 15000 });

    // Wait for at least one preview image to appear (initial cards snapshot should enable previews)
    const images = page.locator("main").getByRole("img");
    await expect(images.first()).toBeVisible();
  });
});
