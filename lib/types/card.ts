/** Card configuration passed to templates describing colours, variation and flags. @source */
export interface TemplateCardConfig {
  cardName: string;
  variation?: string;
  titleColor: string;
  backgroundColor: string;
  textColor: string;
  circleColor: string;
  borderColor?: string;
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
