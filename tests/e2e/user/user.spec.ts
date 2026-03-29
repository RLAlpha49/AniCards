import { mockCardsRecord, mockServerError } from "../fixtures/mock-data";
import { expect, mockSuccessfulApiRoutes, test } from "../fixtures/test-utils";

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

  test("renders stat cards for a canonical username route and exposes export controls", async ({
    page,
    mockSuccessfulApi,
  }) => {
    void mockSuccessfulApi;

    await test.step("Load the user page", async () => {
      await page.goto("/user/TestUser");
    });

    await test.step("Verify hero heading and rendered cards", async () => {
      await expect(
        page.getByRole("heading", { level: 1, name: /testuser/i }),
      ).toBeVisible();

      await expect(
        page.getByRole("heading", { name: /your cards/i }),
      ).toBeVisible();
      const cards = page.getByRole("img", { name: /stats/i });
      await expect(cards).toHaveCount(mockCardsRecord.cards.length);
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
      await page.goto("/user/BrokenUser");
    });

    await test.step("Show error UI with recovery", async () => {
      await expect(page.getByText(/something went wrong/i)).toBeVisible();
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

    await page.goto("/user?userId=999");

    await expect(page).toHaveURL(/\/user\/NewUser/i, { timeout: 15000 });

    await expect(
      page.getByRole("heading", { level: 1, name: /newuser/i }),
    ).toBeVisible({
      timeout: 15000,
    });

    const images = page.locator("main").getByRole("img");
    await expect(images.first()).toBeVisible();
  });
});
