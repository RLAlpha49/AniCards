import { expect, test } from "@playwright/test";

import { clickAnchorAndExpectUrl, gotoReady } from "../fixtures/browser-utils";

const PROJECTS = [
  {
    name: "Anilist Custom List Manager",
    url: "https://github.com/RLAlpha49/Anilist-Custom-List-Manager",
  },
  {
    name: "Kenmai to Anilist",
    url: "https://github.com/RLAlpha49/KenmeiToAnilist",
  },
];

test.describe("Projects page", () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page, "/projects");
    await expect(
      page.getByRole("heading", { level: 1, name: /projects/i }),
    ).toBeVisible();
  });

  test("keeps GitHub links while exposing first-party continuation routes", async ({
    page,
  }) => {
    await test.step("Render project cards", async () => {
      for (const project of PROJECTS) {
        await expect(
          page.getByRole("heading", { name: new RegExp(project.name, "i") }),
        ).toBeVisible();
      }
    });

    await test.step("Validate GitHub links", async () => {
      for (const project of PROJECTS) {
        const projectLink = page.getByRole("link", {
          name: new RegExp(project.name, "i"),
        });
        await expect(projectLink).toHaveAttribute("href", project.url);
        await expect(projectLink).toHaveAttribute("target", "_blank");
        await expect(projectLink).toHaveAttribute("rel", /noopener/i);
      }
    });

    await test.step("Featured project offers in-app continuation", async () => {
      const featuredSearchLink = page.getByRole("link", {
        name: /open profile search/i,
      });
      await expect(featuredSearchLink).toHaveAttribute("href", "/search");

      const featuredGalleryLink = page.getByRole("link", {
        name: /browse the gallery/i,
      });
      await expect(featuredGalleryLink).toHaveAttribute("href", "/examples");
    });

    await test.step("Closing CTA keeps GitHub and internal routes discoverable", async () => {
      const searchLink = page.getByRole("link", { name: /search a profile/i });
      await expect(searchLink).toHaveAttribute("href", "/search");

      const examplesLink = page.getByRole("link", { name: /browse examples/i });
      await expect(examplesLink).toHaveAttribute("href", "/examples");

      const profileLink = page.getByRole("link", { name: /visit my github/i });
      await expect(profileLink).toHaveAttribute(
        "href",
        "https://github.com/RLAlpha49",
      );
      await expect(profileLink).toHaveAttribute("target", "_blank");
      await expect(profileLink).toHaveAttribute("rel", /noopener/i);

      await clickAnchorAndExpectUrl(page, searchLink, /\/search$/);
      await expect(page).toHaveURL(/\/search$/);
    });
  });
});
