import { GitBranch, Globe, Heart } from "lucide-react";

import type { EthosItem, Project } from "./types";

export const FEATURED_PROJECT: Project = {
  name: "AniCards",
  description:
    "Elegant stat cards generated from your AniList data. Beautiful designs, rich color themes, multiple layouts, and SVG perfection that displays flawlessly everywhere.",
  url: "https://github.com/RLAlpha49/AniCards",
  tags: ["Next.js", "AniList API", "SVG", "TypeScript"],
  numeral: "Ⅰ",
  highlight:
    "The flagship project — the very site you're browsing. A complete platform for generating, customizing, and sharing beautiful anime stat cards.",
};

export const PROJECTS: Project[] = [
  {
    name: "Anilist Custom List Manager",
    description:
      "Manage your custom lists on Anilist and automatically set your entries to them based on conditions you set. A powerful tool for organizing your anime and manga collections.",
    url: "https://github.com/RLAlpha49/Anilist-Custom-List-Manager",
    tags: ["Anilist", "List Management", "Automation"],
    numeral: "Ⅱ",
    highlight:
      "Automate your collection organization with rule-based list assignments.",
  },
  {
    name: "Kenmai to Anilist",
    description:
      "An application to update your Anilist entries from a Kenmai export file. Perfect for migrating your tracking data between platforms.",
    url: "https://github.com/RLAlpha49/KenmeiToAnilist",
    tags: ["Anilist", "Kenmai", "Data Migration"],
    numeral: "Ⅲ",
    highlight: "Seamless data migration between tracking platforms.",
  },
];

export const ETHOS_ITEMS: EthosItem[] = [
  {
    icon: Globe,
    numeral: "Ⅰ",
    title: "OPEN BY DEFAULT",
    description:
      "Every project is open source. Fork, extend, and make it your own.",
  },
  {
    icon: Heart,
    numeral: "Ⅱ",
    title: "BUILT FOR YOU",
    description:
      "Tools designed around real workflows for anime and media tracking.",
  },
  {
    icon: GitBranch,
    numeral: "Ⅲ",
    title: "ALWAYS EVOLVING",
    description:
      "Actively maintained and improved. Contributions welcome from all.",
  },
];
