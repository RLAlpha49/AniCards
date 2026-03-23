import { seoConfigs } from "@/lib/seo";
import {
  getSiteUrl,
  resolveSiteUrl,
  SITE_AUTHOR_NAME,
  SITE_NAME,
} from "@/lib/site-config";

/**
 * Schema.org WebPage type used for structured data (JSON-LD) metadata.
 * @source
 */
interface WebPage {
  "@type": "WebPage";
  "@context": string;
  name: string;
  description: string;
  url: string;
  keywords: string;
  inLanguage: string;
  isPartOf: {
    "@type": "WebSite";
    name: string;
    url: string;
  };
}

/**
 * Schema.org SoftwareApplication type used for app-specific structured data.
 * @source
 */
interface SoftwareApplication {
  "@type": "SoftwareApplication";
  "@context": string;
  name: string;
  description: string;
  url: string;
  applicationCategory: string;
  operatingSystem: string;
  offers: {
    "@type": "Offer";
    price: string;
    priceCurrency: string;
  };
  keywords: string;
  author: {
    "@type": "Person";
    name: string;
  };
}

interface StructuredDataOverrides {
  title?: string;
  description?: string;
  canonical?: string;
  keywords?: string[];
}

export type StructuredDataEntry = WebPage | SoftwareApplication;

/**
 * Generates structured JSON-LD schema for a specific page type. When
 * `home` is requested it includes both WebPage and SoftwareApplication
 * entries to surface the web app and the site.
 * @param pageType - Page type which controls the returned schema shapes.
 * @returns An array of structured data objects suitable for JSON-LD.
 * @source
 */
export const generateStructuredData = (
  pageType: keyof typeof seoConfigs = "home",
  overrides: StructuredDataOverrides = {},
): StructuredDataEntry[] => {
  const config = {
    ...seoConfigs[pageType],
    ...overrides,
  };
  const siteUrl = getSiteUrl();
  const canonicalUrl = resolveSiteUrl(
    overrides.canonical ?? config.canonical ?? "/",
  );
  const fullTitle = config.title.includes(SITE_NAME)
    ? config.title
    : `${config.title} | ${SITE_NAME}`;

  const baseSchema: WebPage = {
    "@type": "WebPage",
    "@context": "https://schema.org",
    name: fullTitle,
    description: config.description,
    url: canonicalUrl,
    keywords: (config.keywords ?? []).join(", "),
    inLanguage: "en-US",
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: siteUrl,
    },
  };

  if (pageType === "home") {
    const appSchema: SoftwareApplication = {
      "@type": "SoftwareApplication",
      "@context": "https://schema.org",
      name: SITE_NAME,
      description: config.description,
      url: siteUrl,
      applicationCategory: "Entertainment",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      keywords: (config.keywords ?? []).join(", "),
      author: {
        "@type": "Person",
        name: SITE_AUTHOR_NAME,
      },
    };

    return [baseSchema, appSchema];
  }

  return [baseSchema];
};

/**
 * Return a safe value for injecting JSON-LD into a script tag using the
 * `__html` key for frameworks that support dangerouslySetInnerHTML.
 * @param data - The structured data objects to serialize.
 * @returns An object with an `__html` key containing the JSON-LD string.
 * @source
 */
export const generateJsonLd = (data: StructuredDataEntry[]) => {
  return {
    __html: JSON.stringify(data.length === 1 ? data[0] : data).replaceAll(
      "<",
      String.raw`\u003c`,
    ),
  };
};
