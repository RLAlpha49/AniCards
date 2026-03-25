import { describe, expect, it } from "bun:test";

import {
  generateSiteStructuredData,
  generateStructuredData,
} from "@/lib/structured-data";

describe("structured data helpers", () => {
  it("emits site-level founder, organization, and website entities", () => {
    const entries = generateSiteStructuredData();

    expect(entries.map((entry) => entry["@type"])).toEqual([
      "Person",
      "Organization",
      "WebSite",
    ]);
  });

  it("models the projects route as a collection page with a concrete item list", () => {
    const entries = generateStructuredData("projects");
    const types = entries.map((entry) => entry["@type"]);
    const itemList = entries.find((entry) => entry["@type"] === "ItemList") as {
      numberOfItems: number;
      itemListElement: Array<{
        item: {
          name: string;
        };
      }>;
    };

    expect(types).toContain("CollectionPage");
    expect(types).toContain("ItemList");
    expect(itemList.numberOfItems).toBe(3);
    expect(itemList.itemListElement[0]?.item.name).toBe("AniCards");
  });

  it("uses route-aware contact schema instead of a generic webpage", () => {
    const entries = generateStructuredData("contact");

    expect(entries[0]?.["@type"]).toBe("ContactPage");
  });
});
