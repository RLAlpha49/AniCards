import { describe, expect, it } from "bun:test";
import type { Metadata } from "next";

import {
  buildUserSocialPreviewImage,
  generateMetadata,
  getDefaultSocialPreviewImage,
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
  it("emits absolute Open Graph and Twitter preview images for static pages", () => {
    const metadata = generateMetadata(seoConfigs.home);
    const openGraph = getOpenGraphMetadata(metadata);
    const twitter = getTwitterMetadata(metadata);

    expect(openGraph?.images).toEqual([getDefaultSocialPreviewImage()]);
    expect(twitter?.card).toBe("summary_large_image");
    expect(twitter?.images).toEqual([getDefaultSocialPreviewImage()]);
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

    expect(metadata.alternates?.canonical).toBe("/user/Alpha49");
    expect(openGraph?.url).toBe(resolveSiteUrl("/user/Alpha49"));
    expect(openGraph?.type).toBe("profile");
    expect(twitter?.images).toEqual([previewImage]);
  });

  it("does not invent a canonical URL for noindex lookup pages without a canonical profile path", () => {
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
    expect(openGraph?.url).toBeUndefined();
    expect(twitter?.images).toEqual([previewImage]);
  });
});
