/**
 * Content for the projects page.
 *
 * Each entry answers the three questions a visitor arrives with: what the tool
 * is, when they would need it, and what it changes once it runs. The list order
 * drives the page index, the entry order, and the numerals, so the three never
 * drift apart.
 * @source
 */

/** One link offered by a project entry. @source */
export type ProjectAction = Readonly<{
  /** Link text. */
  label: string;
  href: string;
  /** True when the link leaves the site. */
  external: boolean;
}>;

/** A project on the page. @source */
export type Project = Readonly<{
  /** Anchor id the start routes jump to. */
  id: string;
  /** Kanji numeral shown in the entry margin. */
  numeral: string;
  name: string;
  /** Where the tool runs, for example "Web app". */
  platform: string;
  /** One line describing the tool. */
  standfirst: string;
  /** The situation that makes the tool worth opening. */
  useWhen: string;
  /** What the tool does, in the order the visitor meets it. */
  steps: readonly string[];
  /** The boundary of what the tool writes or touches. */
  scope: Readonly<{ label: string; body: string }>;
  /** Facts held in the entry margin. */
  meta: readonly Readonly<{ label: string; value: string }>[];
  /** The main action for this tool. */
  primary: ProjectAction;
  /** Repository URL. */
  source: string;
}>;

/**
 * One row of the "start from what you need" list in the hero.
 *
 * A route either jumps to an entry on this page or opens another page. The
 * numeral matches the entry it points at.
 * @source
 */
export type StartRoute = Readonly<{
  numeral: string;
  /** The visitor's situation, in their words. */
  need: string;
  /** The tool that handles it. */
  tool: string;
  href: string;
  kind: "entry" | "page";
}>;

/** Figures quoted in the hero. They match the entries below. @source */
export const HERO_FACTS = [
  { label: "Projects", value: "2" },
  { label: "Cost", value: "Free" },
  { label: "License", value: "MIT" },
] as const;

/**
 * The three situations the page can route.
 *
 * The two entries come first because that is what a visitor came here for.
 * AniCards closes the list as the tool they arrived on.
 * @source
 */
export const START_ROUTES: readonly StartRoute[] = [
  {
    numeral: "壱",
    need: "My custom lists need sorting",
    tool: "AniList Custom List Manager",
    href: "#custom-list-manager",
    kind: "entry",
  },
  {
    numeral: "弐",
    need: "My manga list is still on Kenmei",
    tool: "Kenmei to AniList",
    href: "#kenmei-to-anilist",
    kind: "entry",
  },
  {
    numeral: "参",
    need: "I want my stats as an image",
    tool: "AniCards generator",
    href: "/generator",
    kind: "page",
  },
];

/**
 * Every project on the page.
 *
 * Both tools write to AniList from the visitor's own account, which is why the
 * shared notes below sit between the last entry and the closing action.
 * @source
 */
export const PROJECTS: readonly Project[] = [
  {
    id: "custom-list-manager",
    numeral: "壱",
    name: "AniList Custom List Manager",
    platform: "Web app",
    standfirst:
      "Sorts your AniList entries into custom lists with rules you write once, instead of dragging each entry by hand.",
    useWhen:
      "You keep AniList custom lists, and sorting them has turned into an evening of clicking. Or the lists you want do not exist yet because filling them by hand would take too long.",
    steps: [
      "Sign in through AniList's own OAuth screen. The site keeps the token in your browser and sends it to AniList, not to a server of mine.",
      "Load your existing custom lists, then give each one conditions: status, score, format, genres, tags, tag categories, or flags such as rewatched.",
      "Choose Match All or Match Any for each list, and add exclude rules for the entries that should stay out.",
      "Preview the queue, then run the update. It saves in batches, retries a failed batch as single entries, and lets you pause or stop partway.",
    ],
    scope: {
      label: "What it changes",
      body: "Custom list membership and the hide-from-default-status-lists flag. Scores, notes, and watch progress are left alone.",
    },
    meta: [
      { label: "Runs in", value: "Browser" },
      { label: "Built with", value: "Next.js, TypeScript" },
      { label: "Sign-in", value: "AniList OAuth" },
      { label: "License", value: "MIT" },
    ],
    primary: {
      label: "Open the app",
      href: "https://anilist-custom-list-manager.alpha49.com/",
      external: true,
    },
    source: "https://github.com/RLAlpha49/Anilist-Custom-List-Manager",
  },
  {
    id: "kenmei-to-anilist",
    numeral: "弐",
    name: "Kenmei to AniList",
    platform: "Desktop app",
    standfirst:
      "Moves a manga library from Kenmei into AniList, and matches each title to its AniList entry before anything is written.",
    useWhen:
      "Your reading list lives in Kenmei and you want the same list on AniList. The alternative is re-adding every title by hand and losing the progress you already recorded.",
    steps: [
      "Export your library from Kenmei as a CSV, then import the file into the app.",
      "Review the matches it found. Titles it could not place are listed, so you can fix them before the sync.",
      "Check the summary of what will be written, then sync status, progress, scores, and privacy in one run.",
      "Turn on auto-pause for manga that have gone quiet, and keep scheduled backups with rotation and restore.",
    ],
    scope: {
      label: "What it changes",
      body: "Writes list entries to AniList once you approve the matches. Kenmei is only read from the export, so the original library stays as it is.",
    },
    meta: [
      { label: "Runs in", value: "Desktop (Electron)" },
      { label: "Built with", value: "TypeScript, React" },
      { label: "Sign-in", value: "AniList OAuth" },
      { label: "License", value: "MIT" },
    ],
    primary: {
      label: "Download the app",
      href: "https://github.com/RLAlpha49/KenmeiToAnilist/releases",
      external: true,
    },
    source: "https://github.com/RLAlpha49/KenmeiToAnilist",
  },
];

/**
 * What each tool reads and what it produces.
 *
 * The page states this before the entries so a visitor can tell the tools
 * apart by their data, not by their feature lists. The numerals match the
 * entries below and the routes in the hero.
 * @source
 */
export const FLOW_ROWS = [
  {
    numeral: "壱",
    tool: "Custom List Manager",
    reads: "Your AniList lists",
    readsNote: "Status, score, format, tags",
    writes: "Custom list membership",
    writesNote: "Plus the hide-from-default flag",
  },
  {
    numeral: "弐",
    tool: "Kenmei to AniList",
    reads: "A Kenmei CSV export",
    readsNote: "Your manga library",
    writes: "AniList list entries",
    writesNote: "Status, progress, scores, privacy",
  },
  {
    numeral: "参",
    tool: "AniCards",
    reads: "A public AniList profile",
    readsNote: "Stats, genres, activity",
    writes: "SVG, PNG, and WebP files",
    writesNote: "Nothing on your account",
  },
] as const;

/**
 * Notes that apply to both tools, shown before the closing action.
 *
 * Each note states something to know before a bulk write, not something about
 * the tool's feature list.
 * @source
 */
export const SHARED_NOTES = [
  {
    title: "Export your AniList data first.",
    body: "Both tools write through AniList's API. An export from AniList's settings takes two minutes and covers you if a bulk run does something you did not expect.",
  },
  {
    title: "Neither tool takes your password.",
    body: "AniList signs you in and returns a token. The list manager keeps it in browser storage, the importer keeps it on your machine. Neither sends it to a server of mine.",
  },
  {
    title: "Both stop when something goes wrong.",
    body: "The list manager retries a failed batch as single entries and can be paused mid-run. The importer lists the titles it could not match before it writes anything.",
  },
] as const;
