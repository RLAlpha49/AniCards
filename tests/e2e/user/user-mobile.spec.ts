import { expect, test } from "../fixtures/test-utils";

test.describe("User page mobile ergonomics", () => {
  test("uses the touch-first mobile editor shell contract", async ({
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
      page.getByRole("heading", { level: 1, name: /your collection/i }),
    ).toBeVisible();

    const analyticsPromptDismiss = page.getByRole("button", {
      name: /keep it off/i,
    });
    if (await analyticsPromptDismiss.isVisible()) {
      await analyticsPromptDismiss.click();
    }

    const menuToggle = page.getByRole("button", { name: /open menu/i });
    await expect(menuToggle).toBeVisible();

    const menuToggleTouchAction = await menuToggle.evaluate(
      (node) => getComputedStyle(node as HTMLElement).touchAction,
    );

    expect(menuToggleTouchAction).toBe("manipulation");

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

    await expect(
      tile.getByRole("switch", { name: /toggle anime stats card/i }),
    ).toBeVisible();
    await expect(
      tile.getByRole("status", { name: /card disabled/i }),
    ).toBeVisible();
  });
});
