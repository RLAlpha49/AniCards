import { describe, expect, it } from "bun:test";
import type { Metadata } from "next";

import {
  buildUserSocialPreviewImage,
  generateMetadata,
  getDefaultSocialPreviewImage,
  getSearchLookupMode,
  getSearchPagePath,
  getUserPageSEOConfig,
  seoConfigs,
} from "@/lib/seo";
import { resolveSiteUrl } from "@/lib/site-config";

function getTwitterMetadata(metadata: Metadata) {
  return metadata.twitter as { card?: string; images?: string[] } | undefined;
}

function getOpenGraphMetadata(metadata: Metadata) {
  return metadata.openGraph as
    | { images?: string[]; type?: string; url?: string }
    | undefined;
}

function getRobotsMetadata(metadata: Metadata) {
  return metadata.robots as { index?: boolean } | undefined;
}

describe("SEO metadata helpers", () => {
  it("emits raster-compatible Open Graph and Twitter preview images for static pages", () => {
    const metadata = generateMetadata(seoConfigs.home);
    const openGraph = getOpenGraphMetadata(metadata);
    const twitter = getTwitterMetadata(metadata);
    const previewImage = getDefaultSocialPreviewImage();

    expect(previewImage).toContain("/card.png?");
    expect(previewImage).not.toContain("/card.svg");
    expect(openGraph?.images).toEqual([previewImage]);
    expect(twitter?.card).toBe("summary_large_image");
    expect(twitter?.images).toEqual([previewImage]);
    expect(openGraph?.url).toBe(resolveSiteUrl("/"));
    expect(metadata.alternates?.canonical).toBe("/");
  });

  it("uses the canonical public profile path and preview image for username routes", () => {
    const metadata = generateMetadata(
      getUserPageSEOConfig({
        username: "Alpha49",
        routeType: "profile",
      }),
    );
    const openGraph = getOpenGraphMetadata(metadata);
    const twitter = getTwitterMetadata(metadata);
    const previewImage = buildUserSocialPreviewImage({ username: "Alpha49" });

    if (!previewImage) {
      throw new Error("Expected a username preview image");
    }

    expect(previewImage).toContain("/card.png?");
    expect(metadata.alternates?.canonical).toBe("/user/Alpha49");
    expect(openGraph?.url).toBe(resolveSiteUrl("/user/Alpha49"));
    expect(openGraph?.type).toBe("profile");
    expect(twitter?.images).toEqual([previewImage]);
  });

  it("emits a lookup Open Graph URL without inventing a canonical URL for noindex userId pages", () => {
    const metadata = generateMetadata(
      getUserPageSEOConfig({
        routeType: "lookup",
        userId: "123456",
      }),
    );
    const openGraph = getOpenGraphMetadata(metadata);
    const twitter = getTwitterMetadata(metadata);
    const robots = getRobotsMetadata(metadata);
    const previewImage = buildUserSocialPreviewImage({ userId: "123456" });

    if (!previewImage) {
      throw new Error("Expected a user ID preview image");
    }

    expect(metadata.alternates).toBeUndefined();
    expect(robots?.index).toBe(false);
    expect(previewImage).toContain("/card.png?");
    expect(openGraph?.url).toBe(resolveSiteUrl("/user?userId=123456"));
    expect(twitter?.images).toEqual([previewImage]);
  });

  it("marks custom-filtered user views as noindex and preserves the filter in lookup URLs", () => {
    const metadata = generateMetadata(
      getUserPageSEOConfig({
        routeType: "lookup",
        username: "Alpha49",
        customFilter: "customized",
      }),
    );
    const openGraph = getOpenGraphMetadata(metadata);
    const robots = getRobotsMetadata(metadata);

    expect(robots?.index).toBe(false);
    expect(openGraph?.url).toBe(
      resolveSiteUrl("/user?username=Alpha49&customFilter=customized"),
    );
  });

  it("falls back openGraph.url to the site root when no canonical or explicit OG URL is provided", () => {
    const metadata = generateMetadata({
      title: "Custom SEO Test",
      description: "Ensures openGraph.url is always emitted.",
    });
    const openGraph = getOpenGraphMetadata(metadata);

    expect(metadata.alternates).toBeUndefined();
    expect(openGraph?.url).toBe(resolveSiteUrl("/"));
  });

  it("keeps /search canonical while describing both username and user ID discovery", () => {
    const metadata = generateMetadata(seoConfigs.search);
    const openGraph = getOpenGraphMetadata(metadata);

    expect(metadata.alternates?.canonical).toBe("/search");
    expect(metadata.description).toContain("username or numeric user ID");
    expect(openGraph?.url).toBe(resolveSiteUrl("/search"));
  });

  it("normalizes the public /search mode contract and omits the default mode when possible", () => {
    expect(getSearchLookupMode(" user-id ")).toBe("userId");
    expect(getSearchLookupMode("userid")).toBe("userId");
    expect(getSearchLookupMode("username")).toBe("username");

    expect(getSearchPagePath()).toBe("/search");
    expect(getSearchPagePath({ mode: "userId" })).toBe("/search?mode=userId");
    expect(
      getSearchPagePath({
        mode: "username",
        query: "Alpha49",
        includeDefaultMode: true,
      }),
    ).toBe("/search?mode=username&query=Alpha49");
  });

  it("keeps the privacy disclosure publicly canonical and indexable", () => {
    const metadata = generateMetadata(seoConfigs.privacy);
    const openGraph = getOpenGraphMetadata(metadata);
    const robots = getRobotsMetadata(metadata);

    expect(metadata.alternates?.canonical).toBe("/privacy");
    expect(openGraph?.url).toBe(resolveSiteUrl("/privacy"));
    expect(robots?.index).toBe(true);
  });
});
