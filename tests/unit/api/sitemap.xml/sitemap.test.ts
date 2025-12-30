import { describe, expect, it } from "bun:test";

const SITEMAP_PATHS = [
  "/",
  "/search",
  "/user",
  "/projects",
  "/contact",
];
const DEFAULT_BASE_URL = "https://anicards.alpha49.com";

async function getSitemap(siteUrl?: string) {
  const envKey = "NEXT_PUBLIC_SITE_URL";
  const env = process.env as Record<string, string | undefined>;
  const previous = env[envKey];

  if (siteUrl === undefined) {
    delete env[envKey];
  } else {
    env[envKey] = siteUrl;
  }

  try {
    // Cache bust to ensure fresh module for each test
    const modulePath = `../../../../app/sitemap.xml/route?cacheBust=${Date.now()}`;
    const { GET } = await import(modulePath);
    const response = await GET();
    const xml = await response.text();
    return { response, xml };
  } finally {
    if (previous === undefined) {
      delete env[envKey];
    } else {
      env[envKey] = previous;
    }
  }
}

describe("sitemap.xml route", () => {
  it("returns XML sitemap with default base URL and valid lastmod values", async () => {
    const { response, xml } = await getSitemap();

    expect(response.headers.get("Content-Type")).toBe("application/xml");

    SITEMAP_PATHS.forEach((path) => {
      expect(xml).toContain(`${DEFAULT_BASE_URL}${path}`);
    });

    const lastmodMatches = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)];
    expect(lastmodMatches.length).toBe(SITEMAP_PATHS.length);

    lastmodMatches.forEach(([, value]) => {
      const parsed = Date.parse(value);
      expect(Number.isNaN(parsed)).toBe(false);
      expect(new Date(parsed).toISOString()).toBe(value);
    });
  });

  it("uses NEXT_PUBLIC_SITE_URL when provided", async () => {
    const customBaseUrl = "https://custom.example";
    const { xml } = await getSitemap(customBaseUrl);

    SITEMAP_PATHS.forEach((path) => {
      expect(xml).toContain(`${customBaseUrl}${path}`);
    });
  });
});
