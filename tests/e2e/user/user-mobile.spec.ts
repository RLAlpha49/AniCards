import type { Locator, Page } from "@playwright/test";

import { gotoReady, waitForUiReady } from "../fixtures/browser-utils";
import { expect, test } from "../fixtures/test-utils";

const MOBILE_VIEWPORT = {
  width: 393,
  height: 851,
};

function useMockFixture<T>(fixture: T): T {
  return fixture;
}

async function expectMinTouchTarget(locator: Locator, label: string) {
  await expect(locator).toBeVisible();

  const box = await locator.evaluate((node) => {
    const rect = (node as HTMLElement).getBoundingClientRect();
    return {
      height: rect.height,
      width: rect.width,
    };
  });

  expect(box.width, `${label} width`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${label} height`).toBeGreaterThanOrEqual(44);
}

async function expectWithinViewport(
  page: Page,
  locator: Locator,
  label: string,
) {
  await expect(locator).toBeVisible();

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  if (!viewport) {
    throw new Error("Expected a mobile viewport for overlay assertions");
  }

  const box = await locator.evaluate((node) => {
    const element = node as HTMLElement;
    const rect = element.getBoundingClientRect();
    const styles = getComputedStyle(element);

    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      overflowX: styles.overflowX,
      overflowY: styles.overflowY,
      right: rect.right,
      top: rect.top,
      width: rect.width,
    };
  });

  expect(box.left, `${label} left edge`).toBeGreaterThanOrEqual(-1);
  expect(box.top, `${label} top edge`).toBeGreaterThanOrEqual(-1);
  expect(box.right, `${label} right edge`).toBeLessThanOrEqual(
    viewport.width + 1,
  );
  expect(box.bottom, `${label} bottom edge`).toBeLessThanOrEqual(
    viewport.height + 1,
  );

  return box;
}

async function waitForSettledTransform(locator: Locator, label: string) {
  await expect
    .poll(
      async () =>
        locator.evaluate((node) => {
          const styles = getComputedStyle(node as HTMLElement);
          return {
            opacity: styles.opacity,
            transform: styles.transform,
          };
        }),
      {
        message: `${label} should finish its open animation before measurement`,
      },
    )
    .toEqual({
      opacity: "1",
      transform: "none",
    });
}

test.describe("User page mobile ergonomics", () => {
  test("uses the touch-first mobile editor shell contract", async ({
    page,
    mockSuccessfulApi,
  }) => {
    useMockFixture(mockSuccessfulApi);

    await page.setViewportSize(MOBILE_VIEWPORT);
    await gotoReady(page, "/user/TestUser");

    await expect(
      page.getByRole("heading", { level: 1, name: /your collection/i }),
    ).toBeVisible();

    const menuToggle = page.getByRole("button", { name: /open menu/i });
    await expect(menuToggle).toBeVisible();

    const menuToggleTouchAction = await menuToggle.evaluate(
      (node) => getComputedStyle(node as HTMLElement).touchAction,
    );

    expect(menuToggleTouchAction).toBe("manipulation");

    const viewport = page.viewportSize();
    const editorMain = page.getByTestId("user-page-editor-main");
    await waitForUiReady(editorMain);
    await editorMain.scrollIntoViewIfNeeded();

    const editorBox = await editorMain.evaluate((node) => {
      const rect = (node as HTMLElement).getBoundingClientRect();
      return {
        height: rect.height,
        width: rect.width,
      };
    });

    expect(viewport).not.toBeNull();
    expect(editorBox.height).toBeGreaterThan(0);

    if (!viewport) {
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

    const disabledTile = page.getByTestId("card-tile-mangaStats");
    await expect(
      disabledTile.getByRole("status", { name: /card disabled/i }),
    ).toBeVisible();
  });

  test("keeps editor controls and overlays touch-safe on mobile", async ({
    page,
    mockSuccessfulApi,
  }) => {
    useMockFixture(mockSuccessfulApi);

    await page.setViewportSize(MOBILE_VIEWPORT);
    await gotoReady(page, "/user/TestUser");

    const tile = page.getByTestId("card-tile-animeStats");
    await expect(tile).toBeVisible();

    const infoButtons = page.locator('[data-tour="card-info"]');
    const settingsButton = tile.locator('[data-tour="card-settings"]');
    const expandButton = tile.locator('[data-tour="card-expand"]');
    const copyButton = tile.getByRole("button", { name: /^copy copy url$/i });

    if ((await infoButtons.count()) > 0) {
      await expectMinTouchTarget(infoButtons.first(), "Card info button");
    }
    await expectMinTouchTarget(settingsButton, "Card settings button");
    await expectMinTouchTarget(expandButton, "Expanded preview trigger");
    await expectMinTouchTarget(copyButton, "Copy popover trigger");

    await settingsButton.click();

    const settingsDialog = page.getByRole("dialog", {
      name: /anime stats settings/i,
    });
    const settingsDialogBox = await expectWithinViewport(
      page,
      settingsDialog,
      "Card settings dialog",
    );

    expect(settingsDialogBox.overflowY).toBe("auto");

    const tabList = settingsDialog.getByRole("tablist");
    const tabListStyles = await tabList.evaluate((node) => {
      const styles = getComputedStyle(node as HTMLElement);
      return {
        overflowX: styles.overflowX,
      };
    });

    expect(tabListStyles.overflowX).toBe("auto");
    await expectMinTouchTarget(
      settingsDialog.getByRole("tab", { name: /^colors$/i }),
      "Colors tab",
    );
    await expectMinTouchTarget(
      settingsDialog.getByRole("tab", { name: /^border$/i }),
      "Border tab",
    );
    await expectMinTouchTarget(
      settingsDialog.getByRole("button", { name: /^close$/i }),
      "Settings dialog close button",
    );

    await settingsDialog.getByRole("button", { name: /^close$/i }).click();
    await expect(settingsDialog).toHaveCount(0);

    const variantSelectTrigger = tile.getByRole("combobox", {
      name: /^variant$/i,
    });
    await expectMinTouchTarget(variantSelectTrigger, "Variant select trigger");
    await variantSelectTrigger.click();

    const variantListbox = page.getByRole("listbox");
    await waitForSettledTransform(variantListbox, "Variant listbox");
    await expectWithinViewport(page, variantListbox, "Variant listbox");
    await expectMinTouchTarget(
      variantListbox.getByRole("option").first(),
      "Variant option",
    );

    await page.keyboard.press("Escape");

    const moreActionsButton = page.getByRole("button", {
      name: /more actions/i,
    });
    await moreActionsButton.scrollIntoViewIfNeeded();
    await moreActionsButton.click();

    const resetAllButton = page.getByRole("button", { name: /^reset all$/i });
    const moreActionsPopover = page
      .locator("[data-radix-popper-content-wrapper] > div")
      .filter({ has: resetAllButton });
    await waitForSettledTransform(moreActionsPopover, "More actions popover");
    const moreActionsPopoverBox = await expectWithinViewport(
      page,
      moreActionsPopover,
      "More actions popover",
    );

    expect(moreActionsPopoverBox.overflowY).toBe("auto");
    await expectMinTouchTarget(resetAllButton, "Reset all menu item");
    await resetAllButton.click();

    const resetAlertDialog = page.getByRole("alertdialog", {
      name: /reset all cards to global settings\?/i,
    });
    await waitForSettledTransform(resetAlertDialog, "Reset alert dialog");
    const resetAlertDialogBox = await expectWithinViewport(
      page,
      resetAlertDialog,
      "Reset all alert dialog",
    );

    expect(resetAlertDialogBox.overflowY).toBe("auto");
    await expectMinTouchTarget(
      resetAlertDialog.getByRole("button", { name: /^cancel$/i }),
      "Reset alert cancel button",
    );
    await expectMinTouchTarget(
      resetAlertDialog.getByRole("button", { name: /^reset all$/i }),
      "Reset alert confirm button",
    );

    await resetAlertDialog.getByRole("button", { name: /^cancel$/i }).click();
    await expect(resetAlertDialog).toHaveCount(0);

    const reorderButton = page.getByRole("button", { name: /^reorder$/i });
    await reorderButton.scrollIntoViewIfNeeded();
    await reorderButton.click();

    const dragHandle = tile.locator('[data-tour="card-drag-handle"]');
    await expectMinTouchTarget(dragHandle, "Card drag handle");
  });
});
