import type { Metadata } from "next";

interface SEOConfig {
  title: string;
  description: string;
  keywords?: string[];
  openGraph?: {
    title?: string;
    description?: string;
    images?: string[];
    type?: string;
  };
  twitter?: {
    title?: string;
    description?: string;
    images?: string[];
  };
  canonical?: string;
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://anicards.alpha49.com";
const SITE_NAME = "AniCards";

export function generateMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description,
    keywords = [],
    openGraph = {},
    canonical,
  } = config;

  const fullTitle = title.includes(SITE_NAME)
    ? title
    : `${title} | ${SITE_NAME}`;

  return {
    title: fullTitle,
    description,
    keywords: keywords.join(", "),

    // Open Graph (Facebook, LinkedIn, etc.)
    openGraph: {
      title: openGraph.title || fullTitle,
      description: openGraph.description || description,
      url: canonical || SITE_URL,
      siteName: SITE_NAME,
      type: (openGraph.type as "website" | "article") || "website",
      locale: "en_US",
    },

    // Additional SEO
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },

    // Canonical URL
    alternates: {
      canonical: canonical || SITE_URL,
    },

    // Additional metadata
    category: "Technology",
  };
}

// SEO configurations for different pages
export const seoConfigs = {
  home: {
    title: "AniCards - Transform Your AniList Data into Beautiful Stat Cards",
    description:
      "Create stunning, shareable anime and manga stat cards from your AniList profile. Visualize your consumption habits, preferences, and social activity with beautiful, customizable designs.",
    keywords: [
      "anilist",
      "anime stats",
      "manga stats",
      "anime cards",
      "anilist profile",
      "anime statistics",
      "manga statistics",
      "anilist visualization",
      "anime tracker",
      "manga tracker",
      "otaku stats",
      "anime dashboard",
      "weeb stats",
    ],
    canonical: SITE_URL,
  },

  search: {
    title: "Search AniList Users - AniCards",
    description:
      "Search for any AniList user to generate their personalized anime and manga stat cards. Enter a username to view detailed statistics and create shareable cards.",
    keywords: [
      "anilist user search",
      "find anilist profile",
      "anime user stats",
      "manga user stats",
      "anilist lookup",
      "user statistics",
    ],
    canonical: `${SITE_URL}/search`,
  },

  contact: {
    title: "Contact Us - AniCards",
    description:
      "Get in touch with the AniCards team. Find our social media links, GitHub repository, and contact information for support or feedback.",
    keywords: ["contact", "support", "feedback", "github", "social media"],
    canonical: `${SITE_URL}/contact`,
  },

  projects: {
    title: "Other Projects - AniCards",
    description:
      "Explore other anime and manga related projects including AniList Custom List Manager, Kenmai to AniList converter, AniSearch ML tool, and more.",
    keywords: [
      "anime projects",
      "anilist tools",
      "anime software",
      "manga tools",
      "anilist utilities",
      "anime applications",
    ],
    canonical: `${SITE_URL}/projects`,
  },

  settings: {
    title: "Settings - AniCards",
    description:
      "Customize your AniCards experience. Adjust theme preferences, sidebar behavior, and default card settings to personalize your stat card generation.",
    keywords: [
      "settings",
      "preferences",
      "customization",
      "theme",
      "configuration",
    ],
    canonical: `${SITE_URL}/settings`,
  },

  license: {
    title: "License - AniCards",
    description:
      "View the MIT license for AniCards. Learn about the terms and conditions for using and contributing to this open-source project.",
    keywords: ["license", "MIT", "open source", "terms", "legal"],
    canonical: `${SITE_URL}/license`,
  },

  user: {
    title: "User Stats - AniCards",
    description:
      "View and download personalized anime and manga stat cards. Generate beautiful visualizations of AniList data with customizable colors and designs.",
    keywords: [
      "user stats",
      "anime statistics",
      "manga statistics",
      "stat cards",
      "anilist data",
      "download cards",
      "custom colors",
    ],
    canonical: `${SITE_URL}/user`,
  },
};

// Function to dynamically update page metadata (for client components)
export function updatePageTitle(pageKey: keyof typeof seoConfigs) {
  const config = seoConfigs[pageKey];
  if (typeof document !== "undefined") {
    document.title = config.title.includes(SITE_NAME)
      ? config.title
      : `${config.title} | ${SITE_NAME}`;

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", config.description);
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = config.description;
      document.head.appendChild(meta);
    }

    // Update meta keywords
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      metaKeywords.setAttribute("content", config.keywords?.join(", ") || "");
    } else if (config.keywords) {
      const meta = document.createElement("meta");
      meta.name = "keywords";
      meta.content = config.keywords.join(", ");
      document.head.appendChild(meta);
    }

    // Update canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute("href", config.canonical || SITE_URL);
    } else {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      canonical.setAttribute("href", config.canonical || SITE_URL);
      document.head.appendChild(canonical);
    }
  }
}
