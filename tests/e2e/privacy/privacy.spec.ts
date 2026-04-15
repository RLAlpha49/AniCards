import { expect, test } from "@playwright/test";

import { clickAnchorAndExpectUrl, gotoReady } from "../fixtures/browser-utils";

test.describe("Privacy disclosure", () => {
  test("renders the public privacy summary with current retention details", async ({
    page,
  }) => {
    await gotoReady(page, "/privacy");
    const usesMobileRetentionLayout =
      (page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) < 768;
    const desktopRetentionTable = page.getByTestId("privacy-retention-table");
    const mobileRetentionCards = page.getByTestId("privacy-retention-cards");
    const retentionSurface = usesMobileRetentionLayout
      ? mobileRetentionCards
      : desktopRetentionTable;

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /your data/i,
      }),
    ).toBeVisible();
    await expect(page.getByText(/^privacy disclosure$/i).first()).toBeVisible();
    await expect(page.getByText(/not a legal privacy policy/i)).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: /retention & limits/i,
      }),
    ).toBeVisible();
    await expect(retentionSurface).toBeVisible();
    if (usesMobileRetentionLayout) {
      await expect(desktopRetentionTable).toBeHidden();
    }
    await expect(
      retentionSurface.getByText(/monthly buckets with a ~400-day ttl/i),
    ).toBeVisible();
    await expect(
      retentionSurface.getByText(/browser storage only/i).first(),
    ).toBeVisible();
    await expect(
      retentionSurface.getByText(
        /lifecycle audit entries age out after 14 days/i,
      ),
    ).toBeVisible();
    await expect(
      retentionSurface.getByText(
        /client error retry queue.*expire after 7 days/i,
      ),
    ).toBeVisible();
    await expect(
      retentionSurface.getByText(
        /structured error reports age out after 14 days/i,
      ),
    ).toBeVisible();
  });

  test("keeps the contents navigation and retention details usable on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoReady(page, "/privacy");

    const mobileToc = page.getByTestId("privacy-mobile-toc");
    await expect(mobileToc).toBeVisible();

    const tocToggle = mobileToc.locator("summary");
    await tocToggle.click();

    const retentionLink = mobileToc.getByRole("link", {
      name: /retention & limits/i,
    });
    await expect(retentionLink).toBeVisible();
    await retentionLink.click();

    await expect(page).toHaveURL(/\/privacy#retention$/);
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: /retention & limits/i,
      }),
    ).toBeVisible();
    await expect(page.getByTestId("privacy-retention-cards")).toBeVisible();
    await expect(page.getByTestId("privacy-retention-table")).toBeHidden();
  });

  test("is discoverable from the footer on the home page", async ({ page }) => {
    await gotoReady(page, "/");

    const privacyLink = page
      .getByRole("contentinfo")
      .getByRole("link", { name: /privacy disclosure/i });

    await privacyLink.scrollIntoViewIfNeeded();
    await expect(privacyLink).toHaveAttribute("href", "/privacy");

    await clickAnchorAndExpectUrl(page, privacyLink, /\/privacy(?:\?|$)/);

    await expect(page).toHaveURL(/\/privacy(?:\?|$)/);
  });
});
