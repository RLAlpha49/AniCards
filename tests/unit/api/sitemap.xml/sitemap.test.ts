import { describe, expect, it } from "bun:test";

const SITEMAP_PATHS = [
  "/",
  "/search",
  "/examples",
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
  it("returns XML sitemap with the curated public routes", async () => {
    const { response, xml } = await getSitemap();

    expect(response.headers.get("Content-Type")).toBe("application/xml");

    SITEMAP_PATHS.forEach((path) => {
      expect(xml).toContain(`${DEFAULT_BASE_URL}${path}`);
    });

    expect(xml).not.toContain("<lastmod>");
  });

  it("uses NEXT_PUBLIC_SITE_URL when provided", async () => {
    const customBaseUrl = "https://custom.example";
    const { xml } = await getSitemap(customBaseUrl);

    SITEMAP_PATHS.forEach((path) => {
      expect(xml).toContain(`${customBaseUrl}${path}`);
    });
  });
});
