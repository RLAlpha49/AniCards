import { expect, test } from "../fixtures/test-utils";

test.describe("User page error states", () => {
  test("shows rate limit error with recovery link", async ({
    page,
    mockRateLimitedApi,
  }) => {
    void mockRateLimitedApi;

    await page.goto("/user?username=RateLimitedUser");

    await expect(
      page.getByRole("heading", { name: /something went wrong/i }),
    ).toBeVisible();

    await expect(
      page.getByText(/rate limit exceeded|too many requests/i),
    ).toBeVisible();

    const recoveryLink = page.getByRole("link", { name: /search for user/i });
    await expect(recoveryLink).toBeVisible();
    await expect(recoveryLink).toHaveAttribute("href", "/search");
  });

  test("shows network failure guidance when requests fail", async ({
    page,
    mockNetworkError,
  }) => {
    void mockNetworkError;

    await page.goto("/user?username=OfflineUser");

    await expect(
      page.getByRole("heading", { name: /something went wrong/i }),
    ).toBeVisible();

    await expect(
      page.getByText(/failed to fetch user data|check your connection/i),
    ).toBeVisible();

    const recoveryLink = page.getByRole("link", { name: /search for user/i });
    await expect(recoveryLink).toBeVisible();
    await expect(recoveryLink).toHaveAttribute("href", "/search");
  });
});
