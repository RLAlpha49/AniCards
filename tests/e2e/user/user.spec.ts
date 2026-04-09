import type { Page } from "@playwright/test";

import { gotoReady, waitForUiReady } from "../fixtures/browser-utils";
import {
  mockBootstrapUserRecord,
  mockServerError,
} from "../fixtures/mock-data";
import { expect, mockSuccessfulApiRoutes, test } from "../fixtures/test-utils";

async function waitForUserEditorReady(page: Page): Promise<void> {
  const editor = page.getByTestId("user-page-editor-main");
  await waitForUiReady(editor);
  await expect(page.locator("#card-search")).toBeVisible({ timeout: 15000 });
}

test.describe("User page", () => {
  test("shows fallback when no query params are provided", async ({ page }) => {
    await test.step("Navigate to user page", async () => {
      await gotoReady(page, "/user");
    });

    await test.step("Render not found state", async () => {
      await expect(
        page.getByRole("heading", { name: /something went wrong/i }),
      ).toBeVisible({ timeout: 15000 });

      await expect(page.getByText(/no user specified/i)).toBeVisible({
        timeout: 15000,
      });

      const searchForUser = page.getByRole("link", {
        name: /search for user/i,
      });
      await expect(searchForUser).toHaveAttribute("href", "/search");
    });
  });

  test("renders stat cards for a canonical username route and exposes export controls", async ({
    page,
    mockSuccessfulApi,
  }) => {
    void mockSuccessfulApi;

    await test.step("Load the user page", async () => {
      await gotoReady(page, "/user/TestUser");
    });

    await test.step("Verify hero heading and rendered cards", async () => {
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /testuser|your collection/i,
        }),
      ).toBeVisible();

      await expect(
        page.getByRole("heading", { name: /your cards/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("img", { name: /anime stats preview/i }),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("img", { name: /social stats preview/i }),
      ).toBeVisible({ timeout: 15000 });
    });

    await test.step("Per-card quick actions are visible and linked correctly", async () => {
      const tile = page.getByTestId("card-tile-animeStats");

      const openLink = tile.getByRole("link", {
        name: /open preview in new tab anime stats/i,
      });
      const copyTrigger = tile.getByRole("button", {
        name: /copy url/i,
      });
      const downloadTrigger = tile.getByRole("button", {
        name: /^download$/i,
      });

      await expect(openLink).toBeVisible();
      await expect(copyTrigger).toBeVisible();
      await expect(downloadTrigger).toBeVisible();

      await expect(openLink).toHaveAttribute("target", "_blank");
      await expect(openLink).toHaveAttribute(
        "rel",
        /\bnoopener\b.*\bnoreferrer\b|\bnoreferrer\b.*\bnoopener\b/i,
      );
      await expect(openLink).toHaveAttribute("href", /\/api\/card/i);
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

      const previews = dialog.getByRole("img", { name: /preview/i });
      await expect(previews).toHaveCount(1);

      await compareButton.click();
      await expect(previews).toHaveCount(2);

      const openLinks = dialog.getByRole("link", {
        name: /^open/i,
      });
      const copyButtons = dialog.getByRole("button", {
        name: /copy url/i,
      });
      const downloadButtons = dialog.getByRole("button", {
        name: /^download$/i,
      });
      await expect(openLinks).toHaveCount(2);
      await expect(copyButtons).toHaveCount(2);
      await expect(downloadButtons).toHaveCount(2);

      for (const action of [openLinks, copyButtons, downloadButtons]) {
        await expect(action.first()).toBeVisible();
        await expect(action.nth(1)).toBeVisible();
      }

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    });

    await test.step("Inspect export controls", async () => {
      await page
        .getByRole("checkbox", { name: /select anime stats card/i })
        .check();
      await page
        .getByRole("checkbox", { name: /select social stats card/i })
        .check();

      const toolbar = page.locator('[data-testid="bulk-actions-toolbar"]');
      await expect(toolbar).toBeVisible();

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

      await copyButton.click();
      await expect(page.getByText(/raw urls/i)).toBeVisible();

      await downloadButton.click({ force: true });
      await expect(page.getByText(/png/i)).toBeVisible();
    });
  });

  test("supports keyboard entry points and opens the help dialog", async ({
    page,
    mockSuccessfulApi,
  }, testInfo) => {
    void mockSuccessfulApi;

    await test.step("Load the mocked user editor", async () => {
      await gotoReady(page, "/user/TestUser");
      await expect(
        page.getByRole("heading", { name: /your cards/i }),
      ).toBeVisible();
      await waitForUserEditorReady(page);
    });

    await test.step("Ctrl+F focuses the card search box", async () => {
      const searchInput = page.locator("#card-search");
      const findShortcut =
        testInfo.project.name === "firefox" ? "Meta+F" : "Control+F";

      await page.keyboard.press(findShortcut);
      await expect(searchInput).toBeFocused();
    });

    await test.step("The help button opens the editor guidance dialog", async () => {
      const helpButton = page.getByRole("button", { name: /^help$/i });

      await expect(helpButton).toBeVisible({ timeout: 15000 });
      await helpButton.focus();
      await expect(helpButton).toBeFocused();
      await helpButton.press("Enter");

      const helpDialog = page.getByRole("dialog", {
        name: /imperial guide/i,
      });
      await expect(helpDialog).toBeVisible({ timeout: 15000 });
      await expect(
        helpDialog.locator('article[aria-label="Quick start"]'),
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test("opens the command palette and runs the bulk actions command", async ({
    page,
    mockSuccessfulApi,
  }) => {
    void mockSuccessfulApi;

    await test.step("Load the mocked user editor", async () => {
      await gotoReady(page, "/user/TestUser");
      await expect(
        page.getByRole("heading", { name: /your cards/i }),
      ).toBeVisible();
      await waitForUserEditorReady(page);
      await expect(
        page.locator('[data-testid="bulk-actions-toolbar"]'),
      ).toHaveCount(0);
    });

    await test.step("Ctrl+K opens the command palette with grouped actions", async () => {
      await page.keyboard.press("Control+K");

      const commandPaletteDialog = page.getByRole("dialog", {
        name: /command palette/i,
      });
      const commandInput = commandPaletteDialog.getByRole("combobox", {
        name: /command palette/i,
      });

      await expect(commandPaletteDialog).toBeVisible({ timeout: 15000 });
      await expect(commandInput).toBeFocused();
      await expect(commandPaletteDialog.getByText(/^Editor$/)).toBeVisible();
      await expect(
        commandPaletteDialog.getByText(/^Bulk Operations$/),
      ).toBeVisible();
      await expect(
        commandPaletteDialog.getByText(/^Help & Guides$/),
      ).toBeVisible();
    });

    await test.step("Running the bulk actions command opens the toolbar", async () => {
      const commandPaletteDialog = page.getByRole("dialog", {
        name: /command palette/i,
      });
      const commandInput = commandPaletteDialog.getByRole("combobox", {
        name: /command palette/i,
      });
      const bulkActionsOption = commandPaletteDialog.getByRole("option", {
        name: /bulk actions/i,
      });
      const toolbar = page.locator('[data-testid="bulk-actions-toolbar"]');

      await commandInput.fill("bulk actions");
      await expect(bulkActionsOption).toBeVisible();

      await commandInput.press("Enter");

      await expect(commandPaletteDialog).toBeHidden({ timeout: 15000 });
      await expect(toolbar).toBeVisible({ timeout: 15000 });
      await expect(toolbar.getByText(/selected/i)).toBeVisible();
      await expect(
        toolbar.getByRole("button", { name: /copy/i }),
      ).toBeVisible();
      await expect(
        toolbar.getByRole("button", { name: /download/i }),
      ).toBeVisible();
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
      await gotoReady(page, "/user/BrokenUser");
    });

    await test.step("Show error UI with recovery", async () => {
      await expect(
        page.getByRole("heading", { name: /something went wrong/i }),
      ).toBeVisible({
        timeout: 15000,
      });
      await expect(
        page.getByText(/server error|an unexpected error occurred/i),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("button", { name: /try again/i }),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("link", { name: /search for user/i }),
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test("recovers a transient user-route load failure in place", async ({
    page,
  }) => {
    let getUserRequestCount = 0;

    await test.step("Fail the first bootstrap request, then succeed on retry", async () => {
      await mockSuccessfulApiRoutes(page, {
        getUser: async (route) => {
          getUserRequestCount += 1;

          await route.fulfill({
            status: getUserRequestCount === 1 ? 503 : 200,
            contentType: "application/json",
            body: JSON.stringify(
              getUserRequestCount === 1
                ? mockServerError
                : mockBootstrapUserRecord,
            ),
          });
        },
      });
    });

    await test.step("Surface recovery UI or auto-recover after the transient failure", async () => {
      await gotoReady(page, "/user/TestUser");

      const retryButton = page.getByRole("button", { name: /try again/i });
      let recoveryMode: "manual" | "automatic" | null = null;

      await expect
        .poll(
          async () => {
            if (await retryButton.isVisible()) {
              recoveryMode = "manual";
              return "ready";
            }

            if (
              await page
                .getByRole("heading", { name: /your cards/i })
                .isVisible()
            ) {
              recoveryMode = "automatic";
              return "ready";
            }

            return "pending";
          },
          { timeout: 15000 },
        )
        .toBe("ready");

      if (recoveryMode === "manual") {
        await retryButton.click();
      }

      await expect
        .poll(() => getUserRequestCount, { timeout: 15000 })
        .toBeGreaterThanOrEqual(2);
    });

    await test.step("Retry and recover the editor without leaving the route", async () => {
      await expect(
        page.getByRole("heading", { name: /your cards/i }),
      ).toBeVisible({ timeout: 30000 });
      await waitForUserEditorReady(page);
      await expect(
        page.getByRole("img", { name: /anime stats preview/i }),
      ).toBeVisible({ timeout: 30000 });
    });
  });

  test("falls back to initial enabled snapshot when get-cards returns empty for new user", async ({
    page,
  }) => {
    await test.step("Mock 404 get-user and subsequent endpoints", async () => {
      await mockSuccessfulApiRoutes(page, {
        getUser: async (route) => {
          await route.fulfill({
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: "User not found" }),
          });
        },
        getCards: async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              userId: 999,
              cards: [],
              updatedAt: "2025-01-01T00:00:00.000Z",
            }),
          });
        },
        storeCards: async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              userId: 999,
              updatedAt: "2025-01-01T00:00:00.000Z",
            }),
          });
        },
        storeUsers: async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              userId: 999,
              updatedAt: "2025-01-01T00:00:00.000Z",
            }),
          });
        },
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

      await page.route("**s1.anilist.co/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "image/png",
          body: "",
        });
      });
    });

    await gotoReady(page, "/user?userId=999");

    await expect(page).toHaveURL(/\/user(?:\/NewUser|\?userId=999)/i, {
      timeout: 15000,
    });

    await expect(
      page.getByRole("heading", { level: 1, name: /newuser|your collection/i }),
    ).toBeVisible({ timeout: 15000 });

    await expect(
      page.getByRole("switch", { name: /toggle anime stats card/i }),
    ).toHaveAttribute("aria-checked", "true", { timeout: 15000 });
  });
});
