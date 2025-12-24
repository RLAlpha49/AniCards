import type { ColorValue } from "@/lib/types/card";

export interface ColorPreset {
  colors: ColorValue[];
  mode: "dark" | "light" | "custom";
}

const pieBarVariations = [
  { id: "default", label: "Default" },
  { id: "pie", label: "Pie Chart" },
  { id: "donut", label: "Donut Chart" },
  { id: "bar", label: "Bar Chart" },
];

const genreTagDistributionVariations = [
  ...pieBarVariations,
  { id: "radar", label: "Radar Chart" },
];

const statusDistributionVariations = pieBarVariations;

const defaultOnlyVariations = [{ id: "default", label: "Default" }];

const scoreDistributionVariations = [
  { id: "default", label: "Default" },
  { id: "horizontal", label: "Horizontal" },
  { id: "cumulative", label: "Cumulative" },
];

const yearDistributionVariations = [
  { id: "default", label: "Default" },
  { id: "horizontal", label: "Horizontal" },
];

const mainStatsVariations = [
  { id: "default", label: "Default" },
  { id: "vertical", label: "Vertical" },
  { id: "compact", label: "Compact" },
  { id: "minimal", label: "Minimal" },
];

const socialStatsVariations = [
  { id: "default", label: "Default" },
  { id: "compact", label: "Compact" },
  { id: "minimal", label: "Minimal" },
  { id: "badges", label: "Badges" },
];

const socialCommunityVariations = [{ id: "default", label: "Default" }];

const profileMainVariations = [
  { id: "default", label: "Default" },
  { id: "compact", label: "Compact" },
  { id: "minimal", label: "Minimal" },
];

const favoritesGridVariations = [
  { id: "anime", label: "Anime Grid" },
  { id: "manga", label: "Manga Grid" },
  { id: "characters", label: "Character Grid" },
  { id: "staff", label: "Staff Grid" },
  { id: "studios", label: "Studios Grid" },
  { id: "mixed", label: "Mixed Favourites" },
];

const activityHeatmapVariations = [
  { id: "default", label: "Default (Theme)" },
  { id: "github", label: "GitHub Green" },
  { id: "fire", label: "Fire Red" },
];

const activityCompactVariations = [{ id: "default", label: "Default" }];

const activityFullVariations = [{ id: "default", label: "Default" }];

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

const getAnimeBreakdownVariations = (cardId: string) => {
  if (cardId.endsWith("StatusDistribution"))
    return statusDistributionVariations;
  if (cardId === "animeGenreSynergy") return defaultOnlyVariations;
  if (
    cardId === "animeGenres" ||
    cardId === "animeTags" ||
    cardId === "animeSeasonalPreference"
  ) {
    return genreTagDistributionVariations;
  }
  return pieBarVariations;
};

const getMangaBreakdownVariations = (cardId: string) => {
  if (cardId.endsWith("StatusDistribution"))
    return statusDistributionVariations;
  if (cardId === "mangaGenres" || cardId === "mangaTags") {
    return genreTagDistributionVariations;
  }
  return pieBarVariations;
};

const animeBreakdownCards = [
  { id: "animeGenres", label: "Anime Genres" },
  { id: "animeTags", label: "Anime Tags" },
  { id: "animeVoiceActors", label: "Anime Voice Actors" },
  { id: "animeStudios", label: "Anime Studios" },
  { id: "animeStaff", label: "Anime Staff" },
  {
    id: "animeStatusDistribution",
    label: "Anime Status Distribution",
  },
  { id: "animeFormatDistribution", label: "Anime Format Distribution" },
  {
    id: "animeSourceMaterialDistribution",
    label: "Anime Source Material Distribution",
  },
  {
    id: "animeSeasonalPreference",
    label: "Anime Seasonal Preference",
  },
  {
    id: "animeEpisodeLengthPreferences",
    label: "Episode Length Preferences",
  },
  {
    id: "animeGenreSynergy",
    label: "Genre Synergy",
  },
  { id: "animeCountry", label: "Anime Country" },
];

const mangaBreakdownCards = [
  { id: "mangaGenres", label: "Manga Genres" },
  { id: "mangaTags", label: "Manga Tags" },
  { id: "mangaStaff", label: "Manga Staff" },
  {
    id: "mangaStatusDistribution",
    label: "Manga Status Distribution",
  },
  { id: "mangaFormatDistribution", label: "Manga Format Distribution" },
  { id: "mangaCountry", label: "Manga Country" },
];

const activityCards = [
  {
    id: "activityHeatmap",
    label: "Activity Heatmap",
    variations: activityHeatmapVariations,
  },
  {
    id: "recentActivitySummary",
    label: "Recent Activity Summary",
    variations: activityFullVariations,
  },
  {
    id: "recentActivityFeed",
    label: "Recent Activity Feed",
    variations: activityCompactVariations,
  },
  {
    id: "activityStreaks",
    label: "Activity Streaks & Peaks",
    variations: activityFullVariations,
  },
  {
    id: "topActivityDays",
    label: "Top Activity Days",
    variations: activityCompactVariations,
  },
];

const statusCompletionVariations = [
  { id: "combined", label: "Combined" },
  { id: "split", label: "Split (Anime/Manga)" },
];

const milestonesVariations = [{ id: "default", label: "Default" }];

const personalRecordsVariations = [{ id: "default", label: "Default" }];

const planningBacklogVariations = [{ id: "default", label: "Default" }];

const mostRewatchedVariations = [
  { id: "default", label: "Default (All)" },
  { id: "anime", label: "Anime Only" },
  { id: "manga", label: "Manga Only" },
];

const currentlyWatchingReadingVariations = [
  { id: "default", label: "Default (Anime + Manga)" },
  { id: "anime", label: "Anime Only" },
  { id: "manga", label: "Manga Only" },
];

const completionProgressCards = [
  {
    id: "statusCompletionOverview",
    label: "Status Completion Overview",
    variations: statusCompletionVariations,
  },
  {
    id: "milestones",
    label: "Consumption Milestones",
    variations: milestonesVariations,
  },
  {
    id: "personalRecords",
    label: "Personal Records",
    variations: personalRecordsVariations,
  },
  {
    id: "planningBacklog",
    label: "Planning Backlog",
    variations: planningBacklogVariations,
  },
  {
    id: "mostRewatched",
    label: "Most Rewatched/Reread Titles",
    variations: mostRewatchedVariations,
  },
  {
    id: "currentlyWatchingReading",
    label: "Currently Watching / Reading",
    variations: currentlyWatchingReadingVariations,
  },
];

const comparativeDefaultVariations = [{ id: "default", label: "Default" }];

const userAnalyticsDefaultVariations = [{ id: "default", label: "Default" }];

const studioDefaultVariations = [{ id: "default", label: "Default" }];

export const statCardTypes = [
  // Group: Core Stats
  createCardType(
    "animeStats",
    "Core Stats",
    "Anime Stats",
    mainStatsVariations,
  ),
  createCardType(
    "mangaStats",
    "Core Stats",
    "Manga Stats",
    mainStatsVariations,
  ),
  createCardType(
    "socialStats",
    "Core Stats",
    "Social Stats",
    socialStatsVariations,
  ),
  createCardType(
    "profileOverview",
    "Core Stats",
    "Profile Overview",
    profileMainVariations,
  ),
  createCardType(
    "animeMangaOverview",
    "Core Stats",
    "Anime vs Manga Overview",
    comparativeDefaultVariations,
  ),

  // Group: Anime Deep Dive
  ...animeBreakdownCards.map((card) =>
    createCardType(
      card.id,
      "Anime Deep Dive",
      card.label,
      getAnimeBreakdownVariations(card.id),
    ),
  ),
  createCardType(
    "animeScoreDistribution",
    "Anime Deep Dive",
    "Anime Score Distribution",
    scoreDistributionVariations,
  ),
  createCardType(
    "animeYearDistribution",
    "Anime Deep Dive",
    "Anime Year Distribution",
    yearDistributionVariations,
  ),

  // Group: Manga Deep Dive
  ...mangaBreakdownCards.map((card) =>
    createCardType(
      card.id,
      "Manga Deep Dive",
      card.label,
      getMangaBreakdownVariations(card.id),
    ),
  ),
  createCardType(
    "mangaScoreDistribution",
    "Manga Deep Dive",
    "Manga Score Distribution",
    scoreDistributionVariations,
  ),
  createCardType(
    "mangaYearDistribution",
    "Manga Deep Dive",
    "Manga Year Distribution",
    yearDistributionVariations,
  ),

  // Group: Activity & Engagement
  ...activityCards.map((card) =>
    createCardType(
      card.id,
      "Activity & Engagement",
      card.label,
      card.variations,
    ),
  ),
  createCardType(
    "socialMilestones",
    "Activity & Engagement",
    "Social Milestones",
    socialCommunityVariations,
  ),
  createCardType(
    "reviewStats",
    "Activity & Engagement",
    "Review Statistics",
    userAnalyticsDefaultVariations,
  ),
  createCardType(
    "seasonalViewingPatterns",
    "Activity & Engagement",
    "Seasonal Viewing Patterns",
    userAnalyticsDefaultVariations,
  ),

  // Group: Library & Progress
  createCardType(
    "favoritesSummary",
    "Library & Progress",
    "Favourites Summary",
    profileMainVariations,
  ),
  createCardType(
    "favoritesGrid",
    "Library & Progress",
    "Favourites Grid",
    favoritesGridVariations,
  ),
  ...completionProgressCards.map((card) =>
    createCardType(card.id, "Library & Progress", card.label, card.variations),
  ),
  createCardType(
    "droppedMedia",
    "Library & Progress",
    "Dropped Media",
    userAnalyticsDefaultVariations,
  ),

  // Group: Advanced Analytics
  createCardType(
    "scoreCompareAnimeManga",
    "Advanced Analytics",
    "Anime vs Manga Score Comparison",
    comparativeDefaultVariations,
  ),
  createCardType(
    "countryDiversity",
    "Advanced Analytics",
    "Country Diversity",
    comparativeDefaultVariations,
  ),
  createCardType(
    "genreDiversity",
    "Advanced Analytics",
    "Genre Diversity",
    comparativeDefaultVariations,
  ),
  createCardType(
    "formatPreferenceOverview",
    "Advanced Analytics",
    "Format Preference Overview",
    comparativeDefaultVariations,
  ),
  createCardType(
    "releaseEraPreference",
    "Advanced Analytics",
    "Release Era Preference",
    comparativeDefaultVariations,
  ),
  createCardType(
    "startYearMomentum",
    "Advanced Analytics",
    "Start-Year Momentum",
    comparativeDefaultVariations,
  ),
  createCardType(
    "lengthPreference",
    "Advanced Analytics",
    "Length Preference",
    comparativeDefaultVariations,
  ),
  createCardType(
    "tagCategoryDistribution",
    "Advanced Analytics",
    "Tag Category Distribution",
    userAnalyticsDefaultVariations,
  ),
  createCardType(
    "tagDiversity",
    "Advanced Analytics",
    "Tag Diversity",
    userAnalyticsDefaultVariations,
  ),
  createCardType(
    "studioCollaboration",
    "Advanced Analytics",
    "Studio Collaboration",
    studioDefaultVariations,
  ),
];

const _unsortedColorPresets: Record<string, ColorPreset> = {
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
  sunsetGradient: {
    colors: [
      {
        type: "linear",
        angle: 45,
        stops: [
          { color: "#ff7e5f", offset: 0 },
          { color: "#feb47b", offset: 50 },
          { color: "#ff6b6b", offset: 100 },
        ],
      },
      "#141321",
      "#fff7ed",

      {
        type: "linear",
        angle: 45,
        stops: [
          { color: "#ff7e5f", offset: 0 },
          { color: "#ff6b6b", offset: 100 },
        ],
      },
    ],
    mode: "dark",
  },
  oceanWaves: {
    colors: [
      "#00b4d8",

      {
        type: "linear",
        angle: 180,
        stops: [
          { color: "#0a1628", offset: 0 },
          { color: "#0d2137", offset: 50 },
          { color: "#0f2846", offset: 100 },
        ],
      },
      "#e0f7ff",

      {
        type: "linear",
        angle: 90,
        stops: [
          { color: "#00b4d8", offset: 0 },
          { color: "#0077b6", offset: 100 },
        ],
      },
    ],
    mode: "dark",
  },
  purpleHaze: {
    colors: [
      {
        type: "linear",
        angle: 90,
        stops: [
          { color: "#7c3aed", offset: 0 },
          { color: "#a78bfa", offset: 100 },
        ],
      },
      "#1e1b4b",
      "#e9d5ff",

      {
        type: "linear",
        angle: 135,
        stops: [
          { color: "#8b5cf6", offset: 0 },
          { color: "#c084fc", offset: 100 },
        ],
      },
    ],
    mode: "dark",
  },
  fireEmber: {
    colors: [
      "#ff4500",
      "#1a0a0a",
      "#fef3c7",

      {
        type: "linear",
        angle: 45,
        stops: [
          { color: "#dc2626", offset: 0 },
          { color: "#ea580c", offset: 50 },
          { color: "#fbbf24", offset: 100 },
        ],
      },
    ],
    mode: "dark",
  },
  forestDepth: {
    colors: [
      "#22c55e",

      {
        type: "linear",
        angle: 180,
        stops: [
          { color: "#052e16", offset: 0 },
          { color: "#064e3b", offset: 100 },
        ],
      },
      "#dcfce7",

      {
        type: "linear",
        angle: 90,
        stops: [
          { color: "#16a34a", offset: 0 },
          { color: "#4ade80", offset: 100 },
        ],
      },
    ],
    mode: "dark",
  },
  twilightSky: {
    colors: [
      {
        type: "linear",
        angle: 135,
        stops: [
          { color: "#1e3a8a", offset: 0 },
          { color: "#7c3aed", offset: 50 },
          { color: "#ec4899", offset: 100 },
        ],
      },
      "#0f0f23",
      "#f0f0ff",

      {
        type: "linear",
        angle: 135,
        stops: [
          { color: "#6366f1", offset: 0 },
          { color: "#a855f7", offset: 100 },
        ],
      },
    ],
    mode: "dark",
  },
  neonGlow: {
    colors: [
      "#00ffff",
      "#0a0a0a",
      "#ffffff",

      {
        type: "radial",
        cx: 50,
        cy: 50,
        r: 50,
        stops: [
          { color: "#00ffff", offset: 0 },
          { color: "#0ea5e9", offset: 50 },
          { color: "#1e40af", offset: 100 },
        ],
      },
    ],
    mode: "dark",
  },
  goldenHour: {
    colors: [
      {
        type: "linear",
        angle: 0,
        stops: [
          { color: "#fbbf24", offset: 0 },
          { color: "#f59e0b", offset: 50 },
          { color: "#d97706", offset: 100 },
        ],
      },
      "#1c1917",
      "#fef3c7",

      {
        type: "linear",
        angle: 45,
        stops: [
          { color: "#fcd34d", offset: 0 },
          { color: "#f59e0b", offset: 100 },
        ],
      },
    ],
    mode: "dark",
  },
  mintFresh: {
    colors: [
      "#10b981",

      {
        type: "linear",
        angle: 180,
        stops: [
          { color: "#ecfdf5", offset: 0 },
          { color: "#d1fae5", offset: 50 },
          { color: "#f0fdf4", offset: 100 },
        ],
      },
      "#065f46",

      {
        type: "linear",
        angle: 90,
        stops: [
          { color: "#34d399", offset: 0 },
          { color: "#10b981", offset: 100 },
        ],
      },
    ],
    mode: "light",
  },
  cosmicNebula: {
    colors: [
      "#e879f9",

      {
        type: "radial",
        cx: 30,
        cy: 30,
        r: 70,
        stops: [
          { color: "#3b0764", offset: 0 },
          { color: "#1e1b4b", offset: 50 },
          { color: "#0c0a1d", offset: 100 },
        ],
      },
      "#f5d0fe",

      {
        type: "linear",
        angle: 45,
        stops: [
          { color: "#d946ef", offset: 0 },
          { color: "#a855f7", offset: 50 },
          { color: "#6366f1", offset: 100 },
        ],
      },
    ],
    mode: "dark",
  },
  cherryBlossom: {
    colors: [
      {
        type: "linear",
        angle: 90,
        stops: [
          { color: "#f472b6", offset: 0 },
          { color: "#fbcfe8", offset: 100 },
        ],
      },
      "#fdf2f8",
      "#831843",

      {
        type: "linear",
        angle: 45,
        stops: [
          { color: "#ec4899", offset: 0 },
          { color: "#f9a8d4", offset: 100 },
        ],
      },
    ],
    mode: "light",
  },
  arcticAurora: {
    colors: [
      "#22d3ee",
      "#0f172a",
      "#e0f2fe",

      {
        type: "linear",
        angle: 135,
        stops: [
          { color: "#22c55e", offset: 0 },
          { color: "#06b6d4", offset: 33 },
          { color: "#3b82f6", offset: 66 },
          { color: "#8b5cf6", offset: 100 },
        ],
      },
    ],
    mode: "dark",
  },
  anilistLightGradient: {
    colors: [
      {
        type: "linear",
        angle: 90,
        stops: [
          { color: "#3cc8ff", offset: 0 },
          { color: "#02a9ff", offset: 100 },
        ],
      },

      {
        type: "linear",
        angle: 180,
        stops: [
          { color: "#FFFFFF", offset: 0 },
          { color: "#f0f9ff", offset: 100 },
        ],
      },
      "#333333",

      {
        type: "linear",
        angle: 135,
        stops: [
          { color: "#3cc8ff", offset: 0 },
          { color: "#02a9ff", offset: 100 },
        ],
      },
    ],
    mode: "light",
  },
  anilistDarkGradient: {
    colors: [
      {
        type: "linear",
        angle: 90,
        stops: [
          { color: "#3cc8ff", offset: 0 },
          { color: "#02a9ff", offset: 100 },
        ],
      },

      {
        type: "linear",
        angle: 180,
        stops: [
          { color: "#0b1622", offset: 0 },
          { color: "#11202f", offset: 50 },
          { color: "#152238", offset: 100 },
        ],
      },
      "#E8E8E8",

      {
        type: "linear",
        angle: 135,
        stops: [
          { color: "#3cc8ff", offset: 0 },
          { color: "#0295e5", offset: 100 },
        ],
      },
    ],
    mode: "dark",
  },
  sunriseMeadow: {
    colors: [
      {
        type: "linear",
        angle: 90,
        stops: [
          { color: "#f97316", offset: 0 },
          { color: "#fbbf24", offset: 100 },
        ],
      },

      {
        type: "linear",
        angle: 180,
        stops: [
          { color: "#fffbeb", offset: 0 },
          { color: "#fef3c7", offset: 50 },
          { color: "#fff7ed", offset: 100 },
        ],
      },
      "#78350f",

      {
        type: "linear",
        angle: 45,
        stops: [
          { color: "#fb923c", offset: 0 },
          { color: "#fbbf24", offset: 100 },
        ],
      },
    ],
    mode: "light",
  },
  lavenderBloom: {
    colors: [
      {
        type: "linear",
        angle: 90,
        stops: [
          { color: "#8b5cf6", offset: 0 },
          { color: "#a78bfa", offset: 100 },
        ],
      },

      {
        type: "linear",
        angle: 180,
        stops: [
          { color: "#faf5ff", offset: 0 },
          { color: "#f3e8ff", offset: 50 },
          { color: "#ede9fe", offset: 100 },
        ],
      },
      "#4c1d95",

      {
        type: "linear",
        angle: 135,
        stops: [
          { color: "#a78bfa", offset: 0 },
          { color: "#c4b5fd", offset: 100 },
        ],
      },
    ],
    mode: "light",
  },
  skylineAzure: {
    colors: [
      {
        type: "linear",
        angle: 90,
        stops: [
          { color: "#0ea5e9", offset: 0 },
          { color: "#38bdf8", offset: 100 },
        ],
      },

      {
        type: "linear",
        angle: 180,
        stops: [
          { color: "#f0f9ff", offset: 0 },
          { color: "#e0f2fe", offset: 50 },
          { color: "#f0f9ff", offset: 100 },
        ],
      },
      "#0c4a6e",

      {
        type: "linear",
        angle: 45,
        stops: [
          { color: "#38bdf8", offset: 0 },
          { color: "#7dd3fc", offset: 100 },
        ],
      },
    ],
    mode: "light",
  },
  coralReef: {
    colors: [
      {
        type: "linear",
        angle: 90,
        stops: [
          { color: "#f43f5e", offset: 0 },
          { color: "#fb7185", offset: 100 },
        ],
      },

      {
        type: "linear",
        angle: 180,
        stops: [
          { color: "#fff1f2", offset: 0 },
          { color: "#ffe4e6", offset: 50 },
          { color: "#fecdd3", offset: 100 },
        ],
      },
      "#881337",

      {
        type: "linear",
        angle: 135,
        stops: [
          { color: "#fb7185", offset: 0 },
          { color: "#fda4af", offset: 100 },
        ],
      },
    ],
    mode: "light",
  },
  springGarden: {
    colors: [
      {
        type: "linear",
        angle: 90,
        stops: [
          { color: "#10b981", offset: 0 },
          { color: "#34d399", offset: 100 },
        ],
      },

      {
        type: "linear",
        angle: 180,
        stops: [
          { color: "#ecfdf5", offset: 0 },
          { color: "#d1fae5", offset: 50 },
          { color: "#f0fdf4", offset: 100 },
        ],
      },
      "#064e3b",

      {
        type: "linear",
        angle: 45,
        stops: [
          { color: "#34d399", offset: 0 },
          { color: "#6ee7b7", offset: 100 },
        ],
      },
    ],
    mode: "light",
  },
  custom: { colors: ["", "", "", ""], mode: "custom" },
};

export const colorPresets: Record<string, ColorPreset> = Object.keys(
  _unsortedColorPresets,
)
  .sort((a, b) => a.localeCompare(b))
  .reduce(
    (acc, key) => {
      acc[key] = _unsortedColorPresets[key];
      return acc;
    },
    {} as Record<string, ColorPreset>,
  );
