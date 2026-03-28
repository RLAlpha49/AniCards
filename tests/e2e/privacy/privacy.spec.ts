import { expect, test } from "@playwright/test";

test.describe("Privacy disclosure", () => {
  test("renders the public privacy summary with current retention details", async ({
    page,
  }) => {
    await page.goto("/privacy");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Privacy summary/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/not a legal privacy policy or a contractual promise/i),
    ).toBeVisible();
    await expect(
      page.getByText(/monthly buckets with a roughly 400-day ttl/i).first(),
    ).toBeVisible();
    await expect(
      page
        .getByText(/client error reports ignore userid and username fields/i)
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByText(/server lifecycle audit logs are capped at 250 entries/i)
        .first(),
    ).toBeVisible();
    await expect(
      page.getByText(/failed update counters expire after 14 days/i).first(),
    ).toBeVisible();
  });

  test("is discoverable from the footer on the home page", async ({ page }) => {
    await page.goto("/");

    const privacyLink = page
      .getByRole("contentinfo")
      .getByRole("link", { name: /privacy disclosure/i });

    await privacyLink.scrollIntoViewIfNeeded();
    await expect(privacyLink).toHaveAttribute("href", "/privacy");

    await Promise.all([
      page.waitForURL(/\/privacy(?:\?|$)/),
      privacyLink.click(),
    ]);

    await expect(page).toHaveURL(/\/privacy(?:\?|$)/);
  });
});
