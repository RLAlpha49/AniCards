import { expect, test } from "@playwright/test";

import { clickAnchorAndExpectUrl, gotoReady } from "../fixtures/browser-utils";

test.describe("Privacy disclosure", () => {
  test("renders the public privacy summary with current retention details", async ({
    page,
  }) => {
    await gotoReady(page, "/privacy");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /your data/i,
      }),
    ).toBeVisible();
    await expect(page.getByText(/public product disclosure/i)).toBeVisible();
    await expect(page.getByText(/not a legal privacy policy/i)).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: /retention & limits/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/monthly buckets with a ~400-day ttl/i).first(),
    ).toBeVisible();
    await expect(
      page
        .getByText(/strip userid and username fields before persistence/i)
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByText(/server lifecycle logs are capped at 250 entries/i)
        .first(),
    ).toBeVisible();
    await expect(page.getByText(/expire after 14 days/i).first()).toBeVisible();
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
