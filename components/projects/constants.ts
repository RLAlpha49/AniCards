import { GitBranch, Globe, Heart } from "lucide-react";

import type { EthosItem, Project } from "./types";

export const FEATURED_PROJECT: Project = {
  name: "AniCards",
  description:
    "Stat cards pulled straight from your AniList profile — sharp designs, a deep bench of color themes, flexible layouts, and SVG rendering that looks crisp no matter where you drop it.",
  url: "https://github.com/RLAlpha49/AniCards",
  tags: ["Next.js", "AniList API", "SVG", "TypeScript"],
  numeral: "Ⅰ",
  highlight:
    "This is the main act — the site you're on right now. A full-blown platform for generating, tweaking, and sharing anime stat cards that actually look good.",
};

export const PROJECTS: Project[] = [
  {
    name: "Anilist Custom List Manager",
    description:
      "Take charge of your Anilist custom lists and let the tool sort entries on your terms. Set the rules once, and it handles the busywork of keeping your anime and manga organized.",
    url: "https://github.com/RLAlpha49/Anilist-Custom-List-Manager",
    tags: ["Anilist", "List Management", "Automation"],
    numeral: "Ⅱ",
    highlight:
      "Rule-based sorting that keeps your collections tidy without lifting a finger.",
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
  },
];

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
