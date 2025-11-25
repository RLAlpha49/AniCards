/**
 * Shared constants for the stat card generator.
 * These include the card type definitions and color presets used by both the
 * main generator component and the generator context.
 */

/** Allowed visual variations for pie/bar style breakdown cards. */
const pieBarVariations = [
  { id: "default", label: "Default" },
  { id: "pie", label: "Pie Chart" },
  { id: "bar", label: "Bar Chart" },
];

/** Allowed visual variations for distribution cards using vertical/horizontal layouts. */
const verticalHorizontalVariations = [
  { id: "default", label: "Default" },
  { id: "vertical", label: "Vertical" },
  { id: "horizontal", label: "Horizontal" },
];

/** Variation options for the main-stats cards. */
const mainStatsVariations = [
  { id: "default", label: "Default" },
  { id: "vertical", label: "Vertical" },
  { id: "compact", label: "Compact" },
  { id: "minimal", label: "Minimal" },
];

/** Variation options for the social-stats card. */
const socialStatsVariations = [
  { id: "default", label: "Default" },
  { id: "compact", label: "Compact" },
  { id: "minimal", label: "Minimal" },
];

// Helper function to create card type objects with consistent structure
const createCardType = (
  id: string,
  group: string,
  label: string,
  variations: typeof pieBarVariations,
) => ({
  id,
  group,
  label,
  variations,
});

const animeBreakdownCards = [
  { id: "animeGenres", label: "Anime Genres (Top 5 Count)" },
  { id: "animeTags", label: "Anime Tags (Top 5 Count)" },
  { id: "animeVoiceActors", label: "Anime Voice Actors (Top 5 Count)" },
  { id: "animeStudios", label: "Anime Studios (Top 5 Count)" },
  { id: "animeStaff", label: "Anime Staff (Top 5 Count)" },
  {
    id: "animeStatusDistribution",
    label: "Anime Status Distribution (Current, Completed, etc.)",
  },
  { id: "animeFormatDistribution", label: "Anime Format Distribution" },
  { id: "animeCountry", label: "Anime Country" },
];

const mangaBreakdownCards = [
  { id: "mangaGenres", label: "Manga Genres (Top 5 Count)" },
  { id: "mangaTags", label: "Manga Tags (Top 5 Count)" },
  { id: "mangaStaff", label: "Manga Staff (Top 5 Count)" },
  {
    id: "mangaStatusDistribution",
    label: "Manga Status Distribution (Current, Completed, etc.)",
  },
  { id: "mangaFormatDistribution", label: "Manga Format Distribution" },
  { id: "mangaCountry", label: "Manga Country" },
];

const distributionCards = [
  {
    id: "animeScoreDistribution",
    label: "Anime Score Distribution",
    group: "Anime Breakdowns",
  },
  {
    id: "mangaScoreDistribution",
    label: "Manga Score Distribution",
    group: "Manga Breakdowns",
  },
  {
    id: "animeYearDistribution",
    label: "Anime Year Distribution",
    group: "Anime Breakdowns",
  },
  {
    id: "mangaYearDistribution",
    label: "Manga Year Distribution",
    group: "Manga Breakdowns",
  },
];

/** All available stat card types with their groupings and variation metadata. */
export const statCardTypes = [
  createCardType(
    "animeStats",
    "Main Stats",
    "Anime Stats (Count, Episodes Watched, Minutes Watched, Mean Score, Standard Deviation)",
    mainStatsVariations,
  ),
  createCardType(
    "mangaStats",
    "Main Stats",
    "Manga Stats (Count, Chapters Read, Volumes Read, Mean Score, Standard Deviation)",
    mainStatsVariations,
  ),
  createCardType(
    "socialStats",
    "Main Stats",
    "Social Stats (Total Activities, Followers, Following, Thread Posts/Comments, Reviews)",
    socialStatsVariations,
  ),
  ...animeBreakdownCards.map((card) =>
    createCardType(card.id, "Anime Breakdowns", card.label, pieBarVariations),
  ),
  ...mangaBreakdownCards.map((card) =>
    createCardType(card.id, "Manga Breakdowns", card.label, pieBarVariations),
  ),
  ...distributionCards.map((card) =>
    createCardType(
      card.id,
      card.group,
      card.label,
      verticalHorizontalVariations,
    ),
  ),
];

/** Named color presets exposed to the UI. */
export const colorPresets = {
  default: {
    colors: ["#fe428e", "#141321", "#a9fef7", "#fe428e"],
    mode: "dark",
  },
  anilistLight: {
    colors: ["#3cc8ff", "#FFFFFF", "#333333", "#3cc8ff"],
    mode: "light",
  },
  anilistDark: {
    colors: ["#3cc8ff", "#0b1622", "#E8E8E8", "#3cc8ff"],
    mode: "dark",
  },
  sunset: {
    colors: ["#ff7e5f", "#fff7ed", "#431407", "#ff7e5f"],
    mode: "light",
  },
  ocean: {
    colors: ["#00b4d8", "#f0f9ff", "#03045e", "#00b4d8"],
    mode: "light",
  },
  forest: {
    colors: ["#2d6a4f", "#f0fdf4", "#052e16", "#2d6a4f"],
    mode: "light",
  },
  lavender: {
    colors: ["#7c3aed", "#f5f3ff", "#1e1b4b", "#7c3aed"],
    mode: "light",
  },
  midnight: {
    colors: ["#8b5cf6", "#0f172a", "#e2e8f0", "#8b5cf6"],
    mode: "dark",
  },
  coral: {
    colors: ["#ff6b6b", "#ffe8e8", "#2d3436", "#ff6b6b"],
    mode: "light",
  },
  aurora: {
    colors: ["#10b981", "#042f2e", "#a7f3d0", "#10b981"],
    mode: "dark",
  },
  rosegold: {
    colors: ["#fb7185", "#fff1f2", "#4c0519", "#fb7185"],
    mode: "light",
  },
  galaxy: {
    colors: ["#818cf8", "#1e1b4b", "#c7d2fe", "#818cf8"],
    mode: "dark",
  },
  citrus: {
    colors: ["#f59e0b", "#431407", "#fde68a", "#f59e0b"],
    mode: "dark",
  },
  twilight: {
    colors: ["#c084fc", "#1e1b4b", "#e9d5ff", "#c084fc"],
    mode: "dark",
  },
  seafoam: {
    colors: ["#2dd4bf", "#042f2e", "#ccfbf1", "#2dd4bf"],
    mode: "dark",
  },
  monochromeGray: {
    colors: ["#6b7280", "#f9fafb", "#1f2937", "#9ca3af"],
    mode: "light",
  },
  darkModeBlue: {
    colors: ["#93c5fd", "#0f172a", "#e2e8f0", "#60a5fa"],
    mode: "dark",
  },
  earthyGreen: {
    colors: ["#84cc16", "#fefce8", "#374151", "#a3e635"],
    mode: "light",
  },
  purpleDusk: {
    colors: ["#c084fc", "#4a044a", "#f3e8ff", "#a855f7"],
    mode: "dark",
  },
  redAlert: {
    colors: ["#ef4444", "#000000", "#f8fafc", "#dc2626"],
    mode: "dark",
  },
  goldStandard: {
    colors: ["#facc15", "#111827", "#f0f0f0", "#eab308"],
    mode: "dark",
  },
  cyberpunk: {
    colors: ["#ff4081", "#121212", "#00ffff", "#ff80ab"],
    mode: "dark",
  },
  pastelDreams: {
    colors: ["#a78bfa", "#f0fdfa", "#4b5563", "#c4b5fd"],
    mode: "light",
  },
  vintageSepia: {
    colors: ["#a97142", "#f5e1da", "#5c4033", "#a97142"],
    mode: "light",
  },
  synthwave: {
    colors: ["#ff4ea1", "#2a2a72", "#f1f1f1", "#ff4ea1"],
    mode: "dark",
  },
  solarizedLight: {
    colors: ["#b58900", "#fdf6e3", "#657b83", "#268bd2"],
    mode: "light",
  },
  mint: {
    colors: ["#00b894", "#dfe6e9", "#2d3436", "#00b894"],
    mode: "light",
  },
  bubblegum: {
    colors: ["#ff6f91", "#ffe2e2", "#3f3f3f", "#ff6f91"],
    mode: "light",
  },
  stardust: {
    colors: ["#e0aaff", "#0d0d3f", "#ffffff", "#e0aaff"],
    mode: "dark",
  },
  oceanBreeze: {
    colors: ["#00bcd4", "#e0f7fa", "#00796b", "#00bcd4"],
    mode: "light",
  },
  fire: {
    colors: ["#ff4500", "#fff5f5", "#8b0000", "#ff4500"],
    mode: "light",
  },
  emberGlow: {
    colors: ["#ff6b35", "#1f1a17", "#fde68a", "#ff8b3d"],
    mode: "dark",
  },
  rainforestMist: {
    colors: ["#0f766e", "#f4f9fa", "#0f3c3c", "#34d399"],
    mode: "light",
  },
  polarNight: {
    colors: ["#0ea5e9", "#020617", "#a5f3fc", "#38bdf8"],
    mode: "dark",
  },
  canyonSunrise: {
    colors: ["#ea580c", "#1d1b1e", "#fef3c7", "#fb923c"],
    mode: "light",
  },
  verdantTwilight: {
    colors: ["#22c55e", "#021102", "#dcfce7", "#4ade80"],
    mode: "dark",
  },
  custom: { colors: ["", "", "", ""], mode: "custom" },
};
