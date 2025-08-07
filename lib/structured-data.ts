// Structured data types
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

// Structured data for better SEO
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

// Generate JSON-LD script tag
export const generateJsonLd = (data: (WebPage | SoftwareApplication)[]) => {
  return {
    __html: JSON.stringify(data.length === 1 ? data[0] : data),
  };
};
