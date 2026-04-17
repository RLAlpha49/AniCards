import { expect, test } from "@playwright/test";

import {
  clickAnchorAndExpectUrl,
  gotoReady,
  waitForAppReady,
} from "../fixtures/browser-utils";

test.describe("Home page", () => {
  test("navigates to search from hero CTA", async ({ page }) => {
    await test.step("Open homepage", async () => {
      await gotoReady(page, "/");
    });

    await test.step("Navigate to search via hero CTA", async () => {
      const getStartedLink = page.getByRole("link", { name: /get started/i });

      await expect(getStartedLink).toHaveAttribute("href", "/search");

      await clickAnchorAndExpectUrl(page, getStartedLink, /\/search(?:\?|$)/);

      await expect(page).toHaveURL(/\/search(?:\?|$)/);
      await expect(
        page.getByRole("heading", { name: /unlock any profile/i }),
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test("navigates to examples from View Gallery CTA", async ({ page }) => {
    await gotoReady(page, "/");

    await test.step("Open the examples gallery", async () => {
      const viewGalleryLink = page.getByRole("link", { name: /view gallery/i });

      await expect(viewGalleryLink).toHaveAttribute("href", "/examples");

      await clickAnchorAndExpectUrl(
        page,
        viewGalleryLink,
        /\/examples(?:\?|$)/,
      );
    });

    await expect(page).toHaveURL(/\/examples(?:\?|$)/);
    await waitForAppReady(page);
    await expect(
      page.getByRole("heading", { name: /every card, every variant/i }),
    ).toBeVisible({ timeout: 15000 });
  });
});
