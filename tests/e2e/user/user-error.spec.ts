import {
  dismissAnalyticsPromptIfVisible,
  waitForAppReady,
} from "../fixtures/browser-utils";
import { expect, test } from "../fixtures/test-utils";

async function gotoMockedUserErrorPage(
  page: Parameters<typeof waitForAppReady>[0],
  url: string,
): Promise<void> {
  await page.goto(url, { waitUntil: "commit" });
  await waitForAppReady(page);
  await dismissAnalyticsPromptIfVisible(page);
}

test.describe("User page error states (mocked API)", () => {
  test("shows rate limit error with recovery link", async ({
    page,
    mockRateLimitedApi,
  }) => {
    void mockRateLimitedApi;

    await gotoMockedUserErrorPage(page, "/user/RateLimitedUser");

    await expect(
      page.getByRole("heading", { name: /something went wrong/i }),
    ).toBeVisible({ timeout: 15000 });

    await expect(
      page.getByText(/rate limit exceeded|too many requests/i),
    ).toBeVisible({ timeout: 15000 });

    await expect(
      page.getByRole("button", { name: /try again/i }),
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

    await gotoMockedUserErrorPage(page, "/user/NetworkErrorUser");

    await expect(
      page.getByText(
        /failed to fetch user data|network connection error|check your connection/i,
      ),
    ).toBeVisible({ timeout: 15000 });

    await expect(
      page.getByRole("button", { name: /try again/i }),
    ).toBeVisible();

    const recoveryLink = page.getByRole("link", { name: /search for user/i });
    await expect(recoveryLink).toBeVisible();
    await expect(recoveryLink).toHaveAttribute("href", "/search");
  });
});
