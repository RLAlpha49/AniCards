import { GitBranch, Globe, Heart } from "lucide-react";

import { DEFAULT_EXAMPLE_USER_ID } from "@/lib/card-groups";
import { SITE_REPOSITORY_URL } from "@/lib/site-config";

import type { EthosItem, Project } from "./types";

export const PROJECT_CATALOG: readonly Project[] = [
  {
    name: "AniCards",
    description:
      "Stat cards pulled straight from your AniList profile — sharp designs, a deep bench of color themes, flexible layouts, and SVG rendering that looks crisp no matter where you drop it.",
    url: SITE_REPOSITORY_URL,
    tags: ["Next.js", "AniList API", "SVG", "TypeScript"],
    numeral: "Ⅰ",
    highlight:
      "This is the main act — the site you're on right now. A full-blown platform for generating, tweaking, and sharing anime stat cards that actually look good.",
    isOpenSource: true,
    socialPreview: {
      cardType: "animeMangaOverview",
      colorPreset: "anicardsDarkGradient",
      userId: DEFAULT_EXAMPLE_USER_ID,
      variation: "default",
    },
  },
  {
    name: "Anilist Custom List Manager",
    description:
      "Take charge of your Anilist custom lists and let the tool sort entries on your terms. Set the rules once, and it handles the busywork of keeping your anime and manga organized.",
    url: "https://github.com/RLAlpha49/Anilist-Custom-List-Manager",
    tags: ["Anilist", "List Management", "Automation"],
    numeral: "Ⅱ",
    highlight:
      "Rule-based sorting that keeps your collections tidy without lifting a finger.",
    isOpenSource: true,
    socialPreview: {
      cardType: "planningBacklog",
      colorPreset: "anicardsDarkGradient",
      userId: DEFAULT_EXAMPLE_USER_ID,
      variation: "default",
    },
  },
  {
    name: "Kenmai to Anilist",
    description:
      "Pulls in a Kenmai export and syncs everything with your Anilist account. If you're jumping between tracking platforms, this makes the switch painless.",
    url: "https://github.com/RLAlpha49/KenmeiToAnilist",
    tags: ["Anilist", "Kenmai", "Data Migration"],
    numeral: "Ⅲ",
    highlight:
      "Move your tracking data across platforms without the headaches.",
    isOpenSource: true,
    socialPreview: {
      cardType: "recentActivitySummary",
      colorPreset: "anilistDark",
      userId: DEFAULT_EXAMPLE_USER_ID,
      variation: "default",
    },
  },
];

export const FEATURED_PROJECT = PROJECT_CATALOG[0]!;

export const PROJECTS = PROJECT_CATALOG.slice(1);

function getOpenSourceShare(projects: readonly Project[]) {
  if (projects.length === 0) {
    return 0;
  }

  return Math.round(
    (projects.filter((project) => project.isOpenSource).length /
      projects.length) *
      100,
  );
}

export const PROJECT_HERO_STATS = [
  { value: String(PROJECT_CATALOG.length), label: "Projects" },
  {
    value: `${getOpenSourceShare(PROJECT_CATALOG)}%`,
    label: "Open Source",
  },
] as const;

export const PROJECTS_PAGE_SOCIAL_PREVIEW = FEATURED_PROJECT.socialPreview;

export const ETHOS_ITEMS: EthosItem[] = [
  {
    icon: Globe,
    numeral: "Ⅰ",
    title: "OPEN BY NATURE",
    description:
      "Everything here ships open source. Fork it, extend it, bend it to your will.",
  },
  {
    icon: Heart,
    numeral: "Ⅱ",
    title: "MADE FOR REAL USE",
    description:
      "These tools grew out of actual workflows — built for people who track anime and media seriously.",
  },
  {
    icon: GitBranch,
    numeral: "Ⅲ",
    title: "NEVER STANDING STILL",
    description:
      "Actively maintained, regularly improved. Pull requests from anyone are genuinely welcome.",
  },
];
