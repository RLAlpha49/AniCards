import { expect, test } from "../fixtures/test-utils";

test.describe("User page mobile ergonomics", () => {
  test("uses the touch-first mobile editor and dialog contract", async ({
    page,
    mockSuccessfulApi,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chrome",
      "This spec validates mobile-only behavior.",
    );
    void mockSuccessfulApi;

    await page.goto("/user/TestUser");

    await expect(
      page.getByRole("heading", { level: 1, name: /testuser/i }),
    ).toBeVisible();

    const analyticsPromptDismiss = page.getByRole("button", {
      name: /keep it off/i,
    });
    if (await analyticsPromptDismiss.isVisible()) {
      await analyticsPromptDismiss.click();
    }

    const viewport = page.viewportSize();
    const editorMain = page.getByTestId("user-page-editor-main");
    const editorBox = await editorMain.boundingBox();

    expect(viewport).not.toBeNull();
    expect(editorBox).not.toBeNull();

    if (!viewport || !editorBox) {
      throw new Error("Expected a mobile viewport and visible editor surface");
    }

    expect(editorBox.width).toBeGreaterThan(viewport.width - 64);

    const tile = page.getByTestId("card-tile-animeStats");
    await expect(tile).toBeVisible();
    await expect(
      tile.getByRole("button", { name: /toggle actions for/i }),
    ).toHaveCount(0);

    await expect(tile.getByRole("link", { name: /^open/i })).toBeVisible();
    await expect(tile.getByRole("button", { name: /copy url/i })).toBeVisible();
    await expect(
      tile.getByRole("button", { name: /^download$/i }),
    ).toBeVisible();

    await page.locator('[data-tour="global-settings"]').click({ force: true });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10000 });

    const dialogStyles = await dialog.evaluate((node) => {
      const styles = getComputedStyle(node as HTMLElement);
      return {
        overflowY: styles.overflowY,
        overscrollBehavior: styles.overscrollBehavior,
      };
    });

    expect(dialogStyles.overflowY).toMatch(/auto|scroll/i);
    expect(dialogStyles.overscrollBehavior).toBe("contain");

    const closeButton = dialog.getByRole("button", { name: /^close$/i });
    const closeButtonBox = await closeButton.boundingBox();

    expect(closeButtonBox).not.toBeNull();
    if (!closeButtonBox) {
      throw new Error("Expected the dialog close button to be visible");
    }

    expect(closeButtonBox.width).toBeGreaterThanOrEqual(44);
    expect(closeButtonBox.height).toBeGreaterThanOrEqual(44);
  });
});
