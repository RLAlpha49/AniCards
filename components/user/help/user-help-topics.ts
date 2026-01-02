export type UserHelpBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "note"; text: string }
  | { type: "link"; href: string; label: string };

export type UserHelpTopic = {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
  blocks: UserHelpBlock[];
  /** Optional selector used by the guided tour to focus this area. */
  tourTarget?: string;
};

export function topicToSearchText(topic: UserHelpTopic): string {
  const parts: string[] = [topic.title, topic.summary, ...topic.keywords];

  for (const block of topic.blocks) {
    switch (block.type) {
      case "p":
      case "note":
        parts.push(block.text);
        break;
      case "ul":
      case "ol":
        parts.push(...block.items);
        break;
      case "link":
        parts.push(block.label, block.href);
        break;
      default: {
        const _exhaustiveCheck: never = block;
        console.warn(
          `Unknown block type in topicToSearchText:`,
          _exhaustiveCheck,
        );
      }
    }
  }

  return parts.join("\n");
}

export const USER_HELP_TOPICS: UserHelpTopic[] = [
  {
    id: "quick-start",
    title: "Quick start",
    summary: "Enable cards, set global styling, then copy or download outputs.",
    keywords: ["getting started", "begin", "setup"],
    tourTarget: '[data-tour="card-groups"]',
    blocks: [
      {
        type: "ol",
        items: [
          "Enable the cards you want in the Your Cards section.",
          "Open Global Settings to choose a default color preset and border style.",
          "Use each card’s actions to copy a URL, copy AniList-formatted text, or download an image.",
        ],
      },
      {
        type: "note",
        text: "Tip: your stats update automatically every day — card URLs always stay current.",
      },
    ],
  },
  {
    id: "guided-tour",
    title: "Guided tour",
    summary: "Take a quick tour of the editor controls.",
    keywords: ["tour", "walkthrough", "onboarding"],
    tourTarget: '[data-tour="help-button"]',
    blocks: [
      {
        type: "p",
        text: "Use the Guided Tour button in this dialog to walk through the main controls and shortcuts.",
      },
    ],
  },
  {
    id: "search-and-filters",
    title: "Searching & filters",
    summary: "Find cards fast, then narrow by category and visibility.",
    keywords: ["search", "filters", "visibility", "categories"],
    tourTarget: '[data-tour="card-search"]',
    blocks: [
      {
        type: "p",
        text: "Use the search box to find cards by name. Filters are saved in the URL, so you can share a filtered view.",
      },
      {
        type: "ul",
        items: [
          "Search: Ctrl/Cmd+F focuses the search box.",
          "Visibility: switch between All, Enabled, and Disabled cards.",
          "Category: limit results to a card group.",
        ],
      },
    ],
  },
  {
    id: "global-settings",
    title: "Global Settings",
    summary: "Set the default look applied across cards.",
    keywords: ["theme", "colors", "border", "defaults"],
    tourTarget: '[data-tour="global-settings"]',
    blocks: [
      {
        type: "p",
        text: "Global Settings let you pick default colors, border styling, and other shared options. Individual cards can still override these when needed.",
      },
      {
        type: "note",
        text: "Reset All returns every card to using your global defaults.",
      },
    ],
  },
  {
    id: "reorder-mode",
    title: "Reorder mode",
    summary: "Drag cards within a category to change their order.",
    keywords: ["reorder", "drag", "sort"],
    tourTarget: '[data-tour="reorder-toggle"]',
    blocks: [
      {
        type: "p",
        text: "Turn on Reorder mode, then drag cards by the handle (≡) to reorder within each category.",
      },
      {
        type: "note",
        text: "Reorder mode is disabled while filters are active, to avoid confusing partial lists.",
      },
    ],
  },
  {
    id: "saving",
    title: "Saving, drafts & conflicts",
    summary: "Autosave runs in the background, with manual Save as a fallback.",
    keywords: ["save", "autosave", "draft", "conflict", "discard"],
    tourTarget: '[data-tour="save-button"]',
    blocks: [
      {
        type: "ul",
        items: [
          "Autosave runs automatically after edits.",
          "Ctrl/Cmd+S triggers Save now.",
          "If a save conflict happens (another tab saved), reload to sync.",
          "Drafts can be restored if you close the tab before saving.",
        ],
      },
    ],
  },
  {
    id: "sharing",
    title: "Sharing & embedding",
    summary: "Use shareable URLs or AniList-formatted text in your profile.",
    keywords: ["share", "embed", "anilist", "bio"],
    blocks: [
      {
        type: "p",
        text: "Each enabled card has a shareable URL. Paste URLs into your AniList bio, or use the card actions to copy formatted text.",
      },
      { type: "link", href: "/examples", label: "View examples" },
    ],
  },
];
