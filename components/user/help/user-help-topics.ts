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
        const _exhaustive: never = block;
        throw new Error(`Unhandled block type: ${_exhaustive}`);
      }
    }
  }

  return parts.join("\n");
}

const paragraph = (text: string): UserHelpBlock => ({ type: "p", text });
const note = (text: string): UserHelpBlock => ({ type: "note", text });
const unorderedList = (...items: string[]): UserHelpBlock => ({
  type: "ul",
  items,
});
const orderedList = (...items: string[]): UserHelpBlock => ({
  type: "ol",
  items,
});
const helpLink = (href: string, label: string): UserHelpBlock => ({
  type: "link",
  href,
  label,
});

function createTopic(
  id: string,
  title: string,
  summary: string,
  keywords: string[],
  blocks: UserHelpBlock[],
  tourTarget?: string,
): UserHelpTopic {
  return {
    id,
    title,
    summary,
    keywords,
    blocks,
    ...(tourTarget ? { tourTarget } : {}),
  };
}

export const USER_HELP_TOPICS: UserHelpTopic[] = [
  createTopic(
    "quick-start",
    "Quick start",
    "Start with the curated cards, pick a style, and grab the output.",
    ["getting started", "begin", "setup"],
    [
      orderedList(
        "Start with the curated card set that AniCards enables for new profiles, then toggle more on whenever you want.",
        "Use one of the starter styles or send a look over from the examples gallery, then fine-tune it in Global Settings.",
        "From there, each card gives you options to snag a URL, copy AniList-ready text, or download an image directly.",
      ),
      note(
        "Here's the nice part — your stats refresh on their own every day, so card URLs never go stale.",
      ),
    ],
    '[data-tour="card-groups"]',
  ),
  createTopic(
    "guided-tour",
    "Guided tour",
    "Walk through the main editor controls step by step.",
    ["tour", "walkthrough", "onboarding"],
    [
      paragraph(
        "Hit the Guided Tour button right here in this dialog. It'll walk you through every major control and shortcut — takes maybe a minute or two.",
      ),
    ],
    '[data-tour="help-button"]',
  ),
  createTopic(
    "keyboard-shortcuts",
    "Keyboard shortcuts",
    "Quick keys for search, selection, saving, and reorder mode.",
    ["keyboard", "shortcuts", "hotkeys", "keys"],
    [
      unorderedList(
        "Search cards: Ctrl/Cmd+F focuses the card search box.",
        "Category filter: Ctrl/Cmd+Shift+F focuses the category dropdown.",
        "Enabled-only: Ctrl/Cmd+E toggles between Enabled and All.",
        "Save now: Ctrl/Cmd+S triggers Save.",
        "Select all enabled: Ctrl/Cmd+A selects every enabled card.",
        "Clear selection / exit reorder: Esc clears selected cards and exits Reorder mode.",
        "Reorder mode: Ctrl/Cmd+D toggles Reorder mode (only available when filters are cleared).",
        "Help: Ctrl/Cmd+H opens this Help dialog.",
      ),
      note(
        "Shortcuts won’t trigger while you’re typing in an input, or when a dialog is open.",
      ),
    ],
  ),
  createTopic(
    "search-and-filters",
    "Searching & filters",
    "Track down cards quickly and whittle results by category or visibility.",
    ["search", "filters", "visibility", "categories"],
    [
      paragraph(
        "The search box matches cards by name — straightforward enough. One thing worth knowing: your active filters get baked into the URL, which means you can share a filtered view just by sending the link.",
      ),
      unorderedList(
        "Ctrl/Cmd+F — drops your cursor into the search box.",
        "Ctrl/Cmd+Shift+F — opens up the category dropdown.",
        "Visibility toggle — bounce between All, Enabled, and Disabled cards.",
        "Ctrl/Cmd+E — quick-swaps between Enabled and All.",
      ),
    ],
    '[data-tour="card-search"]',
  ),
  createTopic(
    "global-settings",
    "Global Settings",
    "Dial in the default style that carries across every card.",
    ["theme", "colors", "border", "defaults"],
    [
      paragraph(
        "This is where you set the baseline — default colors, border styling, and a handful of shared options. Any individual card can override these picks when you want something specific, so don't worry about locking yourself in.",
      ),
      note(
        "The Reset All option snaps every card back to your global defaults in one shot.",
      ),
    ],
    '[data-tour="global-settings"]',
  ),
  createTopic(
    "reorder-mode",
    "Reorder mode",
    "Shuffle cards around inside each category by dragging them.",
    ["reorder", "drag", "sort"],
    [
      paragraph(
        "Flip on Reorder mode and grab cards by the little handle (≡) to drag them wherever you want inside their category.",
      ),
      unorderedList(
        "Ctrl/Cmd+D — switches Reorder mode on or off (when it's available).",
        "Esc — drops you right out of Reorder mode.",
      ),
      note(
        "Fair warning — Reorder mode stays disabled while you've got filters running. Otherwise you'd be rearranging a partial list, which gets confusing fast.",
      ),
    ],
    '[data-tour="reorder-toggle"]',
  ),
  createTopic(
    "saving",
    "Saving, drafts & conflicts",
    "Your edits autosave quietly. Manual save is there if you need it.",
    ["save", "autosave", "draft", "conflict", "discard"],
    [
      unorderedList(
        "Autosave kicks in on its own after you make changes.",
        "Ctrl/Cmd+S — forces an immediate save if you're impatient.",
        "Ran into a save conflict? That usually means another tab beat you to it — just reload to get back in sync.",
        "Accidentally closed the tab before saving? Drafts stick around and can be restored.",
      ),
    ],
    '[data-tour="save-button"]',
  ),
  createTopic(
    "sharing",
    "Sharing & embedding",
    "Grab shareable URLs or AniList-ready text to drop into your profile.",
    ["share", "embed", "anilist", "bio"],
    [
      paragraph(
        "Every card you've enabled gets its own shareable URL. Paste those straight into your AniList bio, or use the card actions to copy pre-formatted text that's ready to go.",
      ),
      helpLink("/examples", "View examples"),
    ],
  ),
  createTopic(
    "card-variants",
    "Card variants & compare",
    "Swap between different chart styles and compare two variants at once.",
    [
      "variant",
      "compare",
      "chart",
      "pie",
      "donut",
      "bar",
      "radar",
      "visualization",
    ],
    [
      paragraph(
        "Most cards come with a few carefully supported visualization options — things like Default, Pie, Donut, Bar, Radar, Compact, or Badges depending on the card. The variant dropdown on each card is where you make the switch.",
      ),
      unorderedList(
        "Click the dropdown on any card tile to pick a different chart style.",
        "Toggle Compare mode to throw two variants side-by-side on the same card.",
        "Expand the preview for a full-screen look at any variant you're considering.",
        "Hover over a variant name and you'll get a tooltip breaking down what that visualization shows.",
      ),
    ],
  ),
  createTopic(
    "per-card-settings",
    "Per-card settings",
    "Tweak any single card's look without touching your globals.",
    ["custom", "override", "per-card", "card settings", "gear", "customize"],
    [
      paragraph(
        'See that gear icon on a card tile? Click it to open that card\'s settings. Flip on "Use custom settings" and suddenly you can override the global colors, border, and advanced bits for just that one card.',
      ),
      unorderedList(
        "Custom colors — set Title, Background, Text, and Accent independently for each card.",
        "Custom border — change the border color and radius on a single card.",
        "Advanced settings — things like status colors, pie percentages, favorites display, and grid size (where applicable).",
        "Reset to global — wipes your overrides and drops the card back to global defaults.",
        'Any card running custom settings will sport a "Custom" badge on its tile so you can tell at a glance.',
      ),
    ],
  ),
  createTopic(
    "bulk-actions",
    "Bulk actions",
    "Grab a bunch of cards and copy, download, or tweak them all at once.",
    ["bulk", "multi-select", "batch", "select all", "zip", "download all"],
    [
      paragraph(
        "Check boxes on individual cards, or just hit Ctrl/Cmd+A to scoop up every enabled card. A floating toolbar pops up with your bulk operations.",
      ),
      unorderedList(
        "Bulk Copy — grabs raw URLs or AniList-formatted text for everything you've selected.",
        "Bulk Download — bundles your selected cards into a ZIP file (PNG or WebP, your call).",
        "Bulk Edit — slap a common variant, color preset, or global reset across the whole selection.",
        "Select by category — snags every card in a particular group with one click.",
        "Esc — wipes the selection clean.",
      ),
      note(
        "Changed your mind? Bulk operations support undo. Just hit Ctrl/Cmd+Z in the command palette.",
      ),
    ],
  ),
  createTopic(
    "command-palette",
    "Command palette",
    "One shortcut to reach every editor action — Ctrl/Cmd+K.",
    ["command", "palette", "action", "quick", "ctrl+k"],
    [
      paragraph(
        "Ctrl/Cmd+K cracks open the command palette. Start typing and it fuzzy-searches across every editor command you've got — search, filter, save, bulk stuff, help, the works.",
      ),
      unorderedList(
        "Commands are organized into groups: editor, bulk, and help.",
        "Your recent actions float to the top so you can rerun them quickly.",
        "Enter runs whatever's highlighted. Esc backs out.",
      ),
    ],
  ),
  createTopic(
    "color-customization",
    "Colors & presets",
    "Choose a preset palette or go custom — with live preview as you tinker.",
    [
      "color",
      "preset",
      "gradient",
      "hex",
      "theme",
      "title",
      "background",
      "text",
      "accent",
    ],
    [
      paragraph(
        "Every card draws from four colors — Title, Background, Text, and Accent. You can pick a preset palette from the dropdown if you want something quick, or punch in custom hex and CSS color values for full control.",
      ),
      unorderedList(
        "Color presets — pick one and all four colors change together.",
        "Custom colors — type in a hex code (#RGB, #RRGGBB, #RRGGBBAA) or a named CSS color.",
        "Gradient support — you can use gradients instead of flat colors for something richer.",
        "Live preview — a sample card updates in real time while you mess with the colors.",
      ),
    ],
  ),
  createTopic(
    "settings-templates",
    "Settings templates",
    "Bottle up a style you like and reapply it whenever.",
    ["template", "save template", "apply template", "reuse"],
    [
      paragraph(
        "Once you've landed on a look you love — colors, borders, advanced settings — save it as a named template. Then you can reapply that exact configuration to other cards or your global defaults down the road. The examples gallery also saves looks into this same template library, so imported styles show up right alongside your own.",
      ),
      unorderedList(
        "Save as template — give your current settings a name and stash them.",
        "Apply template — pick a saved one and it drops in immediately.",
        "Copy from card — clone one card's settings onto another.",
        "Delete template — removes a saved template (you'll get a confirmation first, don't worry).",
      ),
      note(
        "Templates live in your browser's local storage. That same local library is what powers example-to-editor style handoff.",
      ),
    ],
  ),
  createTopic(
    "import-export",
    "Import & export",
    "Back up your setup as JSON, then pull it in on another device.",
    ["import", "export", "json", "backup", "transfer"],
    [
      paragraph(
        "The import/export tools — you'll find them in Global Settings and in per-card settings — let you back up your whole configuration or move it between devices without starting over.",
      ),
      unorderedList(
        "Export scopes — just the current card, global settings, templates alone, or the whole enchilada.",
        "Export format — copy the JSON to your clipboard or download it as a .json file.",
        "Import — paste in some JSON or upload a .json file to restore your settings.",
      ),
      note(
        "Nothing sensitive ends up in the exported files — share them freely.",
      ),
    ],
  ),
  createTopic(
    "advanced-search",
    "Advanced search syntax",
    "Structured filters that let you slice results by group, status, or customization.",
    [
      "advanced search",
      "filter syntax",
      "group:",
      "enabled:",
      "custom:",
      "token",
    ],
    [
      paragraph(
        "Plain text search works fine, but the search box also understands structured token filters when you need something more precise.",
      ),
      unorderedList(
        'group:"Core Stats" — narrows things down to a single category.',
        "enabled:true or enabled:false — filters by whether a card is switched on.",
        "custom:yes or custom:no — shows only cards with (or without) custom settings.",
        'Mix tokens with plain text: group:"Anime Deep Dive" genre.',
        "Wrap multi-word values in quotes.",
      ),
    ],
  ),
  createTopic(
    "advanced-card-settings",
    "Advanced card options",
    "Extra toggles that show up when relevant — status colors, percentages, and more.",
    ["status colors", "pie percentages", "favorites", "grid size", "advanced"],
    [
      paragraph(
        "A handful of cards have settings that go beyond colors and borders. They surface automatically when they're actually relevant to whatever card or variant you're looking at.",
      ),
      unorderedList(
        "Use status colors — maps each AniList status (Watching, Completed, and so on) to its own color on distribution cards.",
        "Show pie percentages — puts percentage labels right on Pie and Donut chart variants.",
        "Show favorites — tacks favorite counts onto Voice Actors, Studios, and Staff cards.",
        "Grid size (cols × rows) — sets the layout dimensions for the Favourites Grid card, anywhere from 1 to 5 in either direction.",
      ),
    ],
  ),
  createTopic(
    "copy-download",
    "Copy & download cards",
    "Snag card URLs, AniList-formatted text, or just download them as images.",
    [
      "copy",
      "download",
      "url",
      "anilist format",
      "svg",
      "webp",
      "png",
      "image",
    ],
    [
      paragraph(
        "Every card tile comes with copy and download buttons — they're right there for sharing individual cards.",
      ),
      unorderedList(
        "Copy URL — puts the raw SVG card URL on your clipboard.",
        "Copy AniList format — gives you the img200(url) text, ready to paste straight into your AniList bio.",
        "Download as PNG — lossless raster, great for uploads and sharing.",
        "Download as WebP — lighter raster image, solid choice for sharing.",
      ),
      note("These options grey out when a card preview isn't available yet."),
    ],
  ),
];
