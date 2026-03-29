import { seoConfigs } from "@/lib/seo";
import {
  buildCanonicalUrl,
  getSiteUrl,
  resolveSiteUrl,
  SITE_AUTHOR_NAME,
  SITE_NAME,
} from "@/lib/site-config";

const JSON_LD_CONTEXT = "https://schema.org";
const DEFAULT_LANGUAGE = "en-US";
const CONTACT_EMAIL = "contact@alpha49.com";
const AUTHOR_GITHUB_URL = "https://github.com/RLAlpha49";
const REPOSITORY_URL = "https://github.com/RLAlpha49/AniCards";

const PROJECT_COLLECTION_ITEMS = [
  {
    name: "AniCards",
    description:
      "Stat cards pulled straight from your AniList profile with flexible layouts, themes, and crisp SVG rendering.",
    url: REPOSITORY_URL,
  },
  {
    name: "Anilist Custom List Manager",
    description:
      "Rule-based sorting for AniList custom lists so anime and manga collections stay organized automatically.",
    url: "https://github.com/RLAlpha49/Anilist-Custom-List-Manager",
  },
  {
    name: "Kenmai to Anilist",
    description:
      "A migration tool that imports Kenmai exports and syncs them into AniList.",
    url: "https://github.com/RLAlpha49/KenmeiToAnilist",
  },
] as const;

type ThingReference = {
  "@id": string;
};

interface EntryPoint {
  "@type": "EntryPoint";
  urlTemplate: string;
}

interface SearchAction {
  "@type": "SearchAction";
  target: EntryPoint;
  "query-input": "required name=search_term_string";
}

type WebPageType = "CollectionPage" | "ContactPage" | "WebPage";

interface Person {
  "@type": "Person";
  "@context": string;
  "@id"?: string;
  name: string;
  url?: string;
}

interface Organization {
  "@type": "Organization";
  "@context": string;
  "@id": string;
  name: string;
  url: string;
  email: string;
  founder: ThingReference;
}

interface WebSite {
  "@type": "WebSite";
  "@context": string;
  "@id": string;
  name: string;
  url: string;
  inLanguage: string;
  publisher: ThingReference;
  potentialAction: SearchAction;
}

/**
 * Schema.org WebPage type used for structured data (JSON-LD) metadata.
 * @source
 */
interface WebPage {
  "@type": WebPageType;
  "@context": string;
  "@id": string;
  name: string;
  description: string;
  url: string;
  keywords: string;
  inLanguage: string;
  isPartOf: ThingReference;
  about?: ThingReference | ThingReference[];
  breadcrumb?: ThingReference;
  mainEntity?: ThingReference;
}

/**
 * Schema.org SoftwareApplication type used for app-specific structured data.
 * @source
 */
interface SoftwareApplication {
  "@type": "SoftwareApplication";
  "@context": string;
  "@id": string;
  name: string;
  description: string;
  url: string;
  applicationCategory: string;
  operatingSystem: string;
  isAccessibleForFree: boolean;
  offers: {
    "@type": "Offer";
    price: string;
    priceCurrency: string;
  };
  keywords: string;
  author: ThingReference;
}

interface ItemList {
  "@type": "ItemList";
  "@context": string;
  "@id": string;
  name: string;
  description: string;
  url: string;
  numberOfItems: number;
  itemListOrder: "https://schema.org/ItemListOrderAscending";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    item: {
      "@type": "SoftwareApplication";
      name: string;
      description: string;
      url: string;
    };
  }>;
}

interface BreadcrumbList {
  "@type": "BreadcrumbList";
  "@context": string;
  "@id": string;
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }>;
}

interface StructuredDataOverrides {
  title?: string;
  description?: string;
  canonical?: string;
  keywords?: string[];
}

export type StructuredDataEntry =
  | BreadcrumbList
  | ItemList
  | Organization
  | Person
  | SoftwareApplication
  | WebPage
  | WebSite;

const SEARCH_ACTION_QUERY_INPUT = "required name=search_term_string";
const SEARCH_ACTION_TARGET_PARAMETER = "search_term_string";
const BREADCRUMB_SEGMENT_LABELS = {
  contact: "Contact",
  examples: "Examples",
  privacy: "Privacy",
  projects: "Projects",
  search: "Search",
  user: "User",
} as const satisfies Record<string, string>;

function buildReference(id: string): ThingReference {
  return { "@id": id };
}

function getEntityIds(siteUrl: string) {
  return {
    founder: `${siteUrl}/#founder`,
    organization: `${siteUrl}/#organization`,
    softwareApplication: `${siteUrl}/#software-application`,
    webSite: `${siteUrl}/#website`,
  };
}

function getPageSchemaType(pageType: keyof typeof seoConfigs): WebPageType {
  switch (pageType) {
    case "contact":
      return "ContactPage";
    case "examples":
    case "projects":
      return "CollectionPage";
    default:
      return "WebPage";
  }
}

function buildFounderEntry(siteUrl: string): Person {
  const entityIds = getEntityIds(siteUrl);

  return {
    "@type": "Person",
    "@context": JSON_LD_CONTEXT,
    "@id": entityIds.founder,
    name: SITE_AUTHOR_NAME,
    url: AUTHOR_GITHUB_URL,
  };
}

function buildOrganizationEntry(siteUrl: string): Organization {
  const entityIds = getEntityIds(siteUrl);

  return {
    "@type": "Organization",
    "@context": JSON_LD_CONTEXT,
    "@id": entityIds.organization,
    name: SITE_NAME,
    url: siteUrl,
    email: CONTACT_EMAIL,
    founder: buildReference(entityIds.founder),
  };
}

function buildWebSiteSearchAction(siteUrl: string): SearchAction {
  return {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/user?username={${SEARCH_ACTION_TARGET_PARAMETER}}`,
    },
    "query-input": SEARCH_ACTION_QUERY_INPUT,
  };
}

function buildWebSiteEntry(siteUrl: string): WebSite {
  const entityIds = getEntityIds(siteUrl);

  return {
    "@type": "WebSite",
    "@context": JSON_LD_CONTEXT,
    "@id": entityIds.webSite,
    name: SITE_NAME,
    url: siteUrl,
    inLanguage: DEFAULT_LANGUAGE,
    publisher: buildReference(entityIds.organization),
    potentialAction: buildWebSiteSearchAction(siteUrl),
  };
}

function buildSoftwareApplicationEntry(
  description: string,
  keywords: string[],
  siteUrl: string,
): SoftwareApplication {
  const entityIds = getEntityIds(siteUrl);

  return {
    "@type": "SoftwareApplication",
    "@context": JSON_LD_CONTEXT,
    "@id": entityIds.softwareApplication,
    name: SITE_NAME,
    description,
    url: siteUrl,
    applicationCategory: "EntertainmentApplication",
    operatingSystem: "Web",
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    keywords: keywords.join(", "),
    author: buildReference(entityIds.founder),
  };
}

function buildProjectsItemListEntry(canonicalUrl: string): ItemList {
  return {
    "@type": "ItemList",
    "@context": JSON_LD_CONTEXT,
    "@id": `${canonicalUrl}#projects-list`,
    name: "AniCards Project Collection",
    description:
      "Open-source anime and manga tools maintained alongside AniCards.",
    url: canonicalUrl,
    numberOfItems: PROJECT_COLLECTION_ITEMS.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: PROJECT_COLLECTION_ITEMS.map((project, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "SoftwareApplication",
        name: project.name,
        description: project.description,
        url: project.url,
      },
    })),
  };
}

function getBreadcrumbLabel(segment: string): string {
  return (
    BREADCRUMB_SEGMENT_LABELS[
      segment as keyof typeof BREADCRUMB_SEGMENT_LABELS
    ] ?? decodeURIComponent(segment)
  );
}

function buildBreadcrumbListEntry(
  canonicalUrl: string,
): BreadcrumbList | undefined {
  const { origin, pathname } = new URL(canonicalUrl);
  const pathSegments = pathname.split("/").filter(Boolean);

  if (pathSegments.length === 0) {
    return undefined;
  }

  return {
    "@type": "BreadcrumbList",
    "@context": JSON_LD_CONTEXT,
    "@id": `${canonicalUrl}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: SITE_NAME,
        item: origin,
      },
      ...pathSegments.map((segment, index) => {
        const breadcrumbPath = `/${pathSegments.slice(0, index + 1).join("/")}`;

        return {
          "@type": "ListItem" as const,
          position: index + 2,
          name: getBreadcrumbLabel(segment),
          item: buildCanonicalUrl(breadcrumbPath),
        };
      }),
    ],
  };
}

function buildPageEntry(
  pageType: keyof typeof seoConfigs,
  config: {
    canonical?: string;
    description: string;
    keywords?: string[];
    title: string;
  },
  canonicalUrl: string,
  siteUrl: string,
): WebPage {
  const entityIds = getEntityIds(siteUrl);
  const fullTitle = config.title.includes(SITE_NAME)
    ? config.title
    : `${config.title} | ${SITE_NAME}`;
  const pageEntry: WebPage = {
    "@type": getPageSchemaType(pageType),
    "@context": JSON_LD_CONTEXT,
    "@id": `${canonicalUrl}#webpage`,
    name: fullTitle,
    description: config.description,
    url: canonicalUrl,
    keywords: (config.keywords ?? []).join(", "),
    inLanguage: DEFAULT_LANGUAGE,
    isPartOf: buildReference(entityIds.webSite),
  };

  switch (pageType) {
    case "contact":
      pageEntry.about = buildReference(entityIds.organization);
      pageEntry.mainEntity = buildReference(entityIds.organization);
      break;
    case "examples":
      pageEntry.about = buildReference(entityIds.softwareApplication);
      break;
    case "home":
      pageEntry.about = buildReference(entityIds.organization);
      pageEntry.mainEntity = buildReference(entityIds.softwareApplication);
      break;
    case "projects":
      pageEntry.about = buildReference(entityIds.organization);
      pageEntry.mainEntity = buildReference(`${canonicalUrl}#projects-list`);
      break;
    case "search":
    case "user":
      pageEntry.about = buildReference(entityIds.softwareApplication);
      break;
  }

  return pageEntry;
}

export function generateSiteStructuredData(): StructuredDataEntry[] {
  const siteUrl = getSiteUrl();

  return [
    buildFounderEntry(siteUrl),
    buildOrganizationEntry(siteUrl),
    buildWebSiteEntry(siteUrl),
  ];
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
  const pageEntry = buildPageEntry(pageType, config, canonicalUrl, siteUrl);
  const entries: StructuredDataEntry[] = [pageEntry];

  if (pageType === "home") {
    entries.push(
      buildSoftwareApplicationEntry(
        config.description,
        config.keywords ?? [],
        siteUrl,
      ),
    );
  }

  if (pageType === "projects") {
    entries.push(buildProjectsItemListEntry(canonicalUrl));
  }

  const breadcrumbEntry = buildBreadcrumbListEntry(canonicalUrl);

  if (breadcrumbEntry) {
    pageEntry.breadcrumb = buildReference(breadcrumbEntry["@id"]);
    entries.push(breadcrumbEntry);
  }

  return entries;
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
