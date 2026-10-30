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
        page.getByRole("heading", { name: /user not found/i }),
      ).toBeVisible();

      const returnHome = page.getByRole("link", { name: /return home/i });
      await expect(returnHome).toHaveAttribute("href", "/");
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
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /testuser.*stat cards/i,
        }),
      ).toBeVisible();

      const cards = page.getByRole("img", { name: /stats/i });
      await expect(cards).toHaveCount(mockCardsRecord.cards.length);
    });

    await test.step("Inspect export controls", async () => {
      await expect(
        page.getByRole("heading", { name: /take the whole set/i }),
      ).toBeVisible();

      const copyButton = page.getByRole("button", {
        name: /copy all links/i,
      });
      const downloadButton = page.getByRole("button", {
        name: /download all/i,
      });

      await expect(copyButton).toBeVisible();
      await expect(downloadButton).toBeVisible();

      await copyButton.click();
      await expect(
        page.getByRole("button", { name: /copy svg addresses/i }),
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
      await page.goto("/user?username=BrokenUser");
    });

    await test.step("Show error UI with recovery", async () => {
      await expect(page.getByText(/something went wrong/i)).toBeVisible();
      await expect(page.getByText(/failed to load user/i)).toBeVisible();
      await expect(
        page.getByRole("link", { name: /return home/i }),
      ).toBeVisible();
    });
  });

  test("offers the AniList About line for a single card", async ({ page }) => {
    await test.step("Mock user, cards, and artwork", async () => {
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

    await page.goto("/user?username=TestUser");

    await test.step("Open the copy menu on the opening card", async () => {
      await page
        .getByRole("button", { name: /copy a link to the anime stats card/i })
        .first()
        .click();

      await expect(page.getByText(/anilist about line/i).first()).toBeVisible();
      await expect(
        page.getByRole("button", { name: /copy about line/i }).first(),
      ).toBeVisible();
    });

    await test.step("The line wraps the card address for AniList", async () => {
      const line = await page
        .locator("p")
        .filter({ hasText: /^img150\(/ })
        .first()
        .innerText();

      expect(line).toMatch(/^img150\(https?:\/\/.+\/card\.svg\?/);
      // The cache-buster is stripped so a copied link stays stable.
      expect(line).not.toContain("_t=");
    });
  });

  test("explains that generating replaces the saved set", async ({ page }) => {
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

    await page.goto("/user?username=TestUser");

    await expect(
      page.getByText(/generating again replaces this set/i),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /put a card on your profile/i }),
    ).toBeVisible();
  });
});
