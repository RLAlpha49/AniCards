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

/**
 * Generates structured JSON-LD schema for a specific page type. When
 * `home` is requested it includes both WebPage and SoftwareApplication
 * entries to surface the web app and the site.
 * @param pageType - Page type which controls the returned schema shapes.
 * @returns An array of structured data objects suitable for JSON-LD.
 * @source
 */
export const generateStructuredData = (
  pageType: "home" | "user" | "search" = "home",
) => {
  const baseSchema: WebPage = {
    "@type": "WebPage",
    "@context": "https://schema.org",
    name: "AniCards - AniList Stat Cards Generator",
    description:
      "Generate beautiful AniList stat cards from your anime and manga data. Create stunning visualizations of your AniList statistics.",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://anicards.alpha49.com",
    keywords:
      "anilist stat cards, anime statistics, manga statistics, anilist data visualization",
    inLanguage: "en-US",
    isPartOf: {
      "@type": "WebSite",
      name: "AniCards",
      url: process.env.NEXT_PUBLIC_SITE_URL || "https://anicards.alpha49.com",
    },
  };

  if (pageType === "home") {
    const appSchema: SoftwareApplication = {
      "@type": "SoftwareApplication",
      "@context": "https://schema.org",
      name: "AniCards",
      description:
        "AniList stat cards generator - Create beautiful, shareable AniList statistics cards from your anime and manga data",
      url: process.env.NEXT_PUBLIC_SITE_URL || "https://anicards.alpha49.com",
      applicationCategory: "Entertainment",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      keywords:
        "anilist stat cards, anime statistics, manga statistics, anilist visualization, anime cards",
      author: {
        "@type": "Person",
        name: "RLAlpha49",
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
export const generateJsonLd = (data: (WebPage | SoftwareApplication)[]) => {
  return {
    __html: JSON.stringify(data.length === 1 ? data[0] : data),
  };
};
