/**
 * Represents a single stop in a gradient definition.
 * @source
 */
export interface GradientStop {
  /** Hex color for this stop (e.g., "#ff0000") */
  color: string;
  /** Offset position as a percentage (0-100) */
  offset: number;
  /** Optional opacity for this stop (0-1, defaults to 1) */
  opacity?: number;
}

/**
 * Defines a gradient with type, stops, and positioning properties.
 * @source
 */
export interface GradientDefinition {
  /** Type of gradient: linear or radial */
  type: "linear" | "radial";
  /** Array of gradient stops (minimum 2 required) */
  stops: GradientStop[];
  /** Angle in degrees for linear gradients (0-360, default 0 = left to right) */
  angle?: number;
  /** Center X position for radial gradients (0-100%, default 50) */
  cx?: number;
  /** Center Y position for radial gradients (0-100%, default 50) */
  cy?: number;
  /** Radius for radial gradients (0-100%, default 50) */
  r?: number;
}

/**
 * A color value that can be either a solid hex color string or a gradient definition.
 * Solid colors are represented as hex strings (e.g., "#fe428e").
 * Gradients are represented as GradientDefinition objects.
 * @source
 */
export type ColorValue = string | GradientDefinition;

/** Card configuration passed to templates describing colours, variation and flags. @source */
export interface TemplateCardConfig {
  cardName: string;
  variation?: string;
  titleColor: ColorValue;
  backgroundColor: ColorValue;
  textColor: ColorValue;
  circleColor: ColorValue;
  borderColor?: ColorValue;
  useStatusColors?: boolean;
}

/**
 * Aggregated structure representing AniList user stats responses used by
 * the server and templates to render cards.
 * @source
 */
export interface UserStats {
  username: string;
  User: {
    statistics: {
      anime: AnimeStats;
      manga: MangaStats;
    };
    stats?: { activityHistory: { date: number; amount: number }[] };
  };
  social?: SocialStats;
}

/** Anime-specific aggregated statistics returned from AniList. @source */
export interface AnimeStats {
  count?: number;
  episodesWatched?: number;
  minutesWatched?: number;
  meanScore?: number;
  standardDeviation?: number;
  current_milestone?: string;
  genres?: { genre: string; count: number }[];
  tags?: { tag: { name: string }; count: number }[];
  voice_actors?: { voice_actor: { name: { full: string } }; count: number }[];
  studios?: { studio: { name: string }; count: number }[];
  staff?: { staff: { name: { full: string } }; count: number }[];
  statuses?: { status: string; amount: number }[];
  formats?: { format: string; count: number }[];
  scores?: { score: number; count: number }[];
}

/** Manga-specific aggregated statistics returned from AniList. @source */
export interface MangaStats {
  count?: number;
  chaptersRead?: number;
  volumesRead?: number;
  meanScore?: number;
  standardDeviation?: number;
  genres?: { genre: string; count: number }[];
  tags?: { tag: { name: string }; count: number }[];
  staff?: { staff: { name: { full: string } }; count: number }[];
  statuses?: { status: string; amount: number }[];
  formats?: { format: string; count: number }[];
  scores?: { score: number; count: number }[];
}

/** Social metrics structure used to capture follower/following and activity counts. @source */
export interface SocialStats {
  followersPage: { pageInfo: { total: number }; followers: { id: number }[] };
  followingPage: { pageInfo: { total: number }; following: { id: number }[] };
  threadsPage: { pageInfo: { total: number }; threads: { id: number }[] };
  threadCommentsPage: {
    pageInfo: { total: number };
    threadComments: { id: number }[];
  };
  reviewsPage: { pageInfo: { total: number }; reviews: { id: number }[] };
  activityHistory?: { date: number; amount: number }[];
}

/** Document representation for persisted user card configurations. @source */
export interface CardsDocument {
  userId: number;
  cards: TemplateCardConfig[];
  updatedAt: Date;
}

/** Database document shape for a stored user containing minimal profile and metadata. @source */
export interface UserDocument {
  userId: number;
  username: string;
  stats: unknown;
  createdAt: Date;
  updatedAt: Date;
  ip: string;
}
