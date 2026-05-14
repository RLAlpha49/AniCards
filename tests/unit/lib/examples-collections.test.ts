import "@/tests/unit/__setup__";

import { describe, expect, it } from "bun:test";

import {
  buildExamplesCollectionPath,
  buildExamplesGalleryPath,
  buildExamplesIndexPath,
  getExampleCardTypeAnchorId,
  getExampleCollectionBySlug,
  getExampleCollectionFromLegacyValue,
} from "@/lib/examples-collections";

describe("examples collection helpers", () => {
  it("resolves collections from slugs case-insensitively and from legacy display names", () => {
    // Arrange
    const slugLookup = "  CORE-STATS  ";
    const legacyDisplayName = "Core Stats";

    // Act
    const slugCollection = getExampleCollectionBySlug(slugLookup);
    const legacyCollection =
      getExampleCollectionFromLegacyValue(legacyDisplayName);

    // Assert
    expect(slugCollection?.name).toBe("Core Stats");
    expect(slugCollection?.slug).toBe("core-stats");
    expect(legacyCollection?.slug).toBe("core-stats");
  });

  it("returns null for empty or unknown collection lookups", () => {
    // Arrange
    const blankLookup = "   ";
    const unknownLookup = "missing-collection";

    // Act
    const blankResult = getExampleCollectionBySlug(blankLookup);
    const unknownResult = getExampleCollectionFromLegacyValue(unknownLookup);

    // Assert
    expect(blankResult).toBeNull();
    expect(unknownResult).toBeNull();
  });

  it("builds gallery and index paths with only meaningful normalized query parameters", () => {
    // Arrange
    const search = "  top picks  ";

    // Act
    const galleryPath = buildExamplesGalleryPath({ search });
    const indexPath = buildExamplesIndexPath({
      search,
      category: "core-stats",
    });
    const invalidCategoryPath = buildExamplesIndexPath({
      search: "   ",
      category: "not-a-real-collection",
    });

    // Assert
    expect(galleryPath).toBe("/examples/gallery?search=top+picks");
    expect(indexPath).toBe("/examples?search=top+picks&category=Core+Stats");
    expect(invalidCategoryPath).toBe("/examples");
  });

  it("builds collection paths from known legacy values and slugifies messy freeform input", () => {
    // Arrange
    const knownCollection = "Activity & Engagement";
    const customCollection = "  Weird -- Custom//Group!!  ";

    // Act
    const knownPath = buildExamplesCollectionPath(knownCollection, {
      search: " recent favorites ",
    });
    const customPath = buildExamplesCollectionPath(customCollection);

    // Assert
    expect(knownPath).toBe(
      "/examples/activity-engagement?search=recent+favorites",
    );
    expect(customPath).toBe("/examples/weird-custom-group");
  });

  it("creates stable anchor ids from card type titles", () => {
    // Arrange
    const title = "  Anime Stats / Default  ";

    // Act
    const anchorId = getExampleCardTypeAnchorId(title);

    // Assert
    expect(anchorId).toBe("example-card-type-anime-stats-default");
  });
});
