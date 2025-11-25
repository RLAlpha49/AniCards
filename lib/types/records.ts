/** Genre bucket in anime statistics with a count of items. @source */
export interface AnimeStatGenre {
  genre: string;
  count: number;
}

/** Tag bucket in anime statistics with a referenced tag name and count. @source */
export interface AnimeStatTag {
  tag: { name: string };
  count: number;
}

/** Voice actor bucket in anime statistics containing a full name and count. @source */
export interface AnimeStatVoiceActor {
  voiceActor: { name: { full: string } };
  count: number;
}

/** Studio bucket in anime statistics containing a studio name and count. @source */
export interface AnimeStatStudio {
  studio: { name: string };
  count: number;
}

/** Staff bucket in anime statistics containing staff full name and count. @source */
export interface AnimeStatStaff {
  staff: { name: { full: string } };
  count: number;
}

/** Aggregated statistics for anime consumed by a user. @source */
export interface AnimeStats {
  count: number;
  episodesWatched: number;
  minutesWatched: number;
  meanScore: number;
  standardDeviation: number;
  genres: AnimeStatGenre[];
  tags: AnimeStatTag[];
  voiceActors: AnimeStatVoiceActor[];
  studios: AnimeStatStudio[];
  staff: AnimeStatStaff[];
  statuses?: { status: string; count: number }[];
  formats?: { format: string; count: number }[];
  scores?: { score: number; count: number }[];
  releaseYears?: { releaseYear: number; count: number }[];
  countries?: { country: string; count: number }[];
}

/** Genre bucket in manga statistics with a count of items. @source */
export interface MangaStatGenre {
  genre: string;
  count: number;
}

/** Tag bucket in manga statistics with a referenced tag name and count. @source */
export interface MangaStatTag {
  tag: { name: string };
  count: number;
}

/** Staff bucket in manga statistics containing staff full name and count. @source */
export interface MangaStatStaff {
  staff: { name: { full: string } };
  count: number;
}

/** Aggregated statistics for manga consumed by a user. @source */
export interface MangaStats {
  count: number;
  chaptersRead: number;
  volumesRead: number;
  meanScore: number;
  standardDeviation: number;
  genres: MangaStatGenre[];
  tags: MangaStatTag[];
  staff: MangaStatStaff[];
  statuses?: { status: string; count: number }[];
  formats?: { format: string; count: number }[];
  scores?: { score: number; count: number }[];
  releaseYears?: { releaseYear: number; count: number }[];
  countries?: { country: string; count: number }[];
}

/** Container that groups anime and manga statistics for a user. @source */
export interface UserStatistics {
  anime: AnimeStats;
  manga: MangaStats;
}

/** User section returned by AniList GraphQL for a User entry. @source */
export interface UserSection {
  stats: ActivityStats;
  favourites: {
    staff: {
      nodes: {
        id: number;
        name: {
          full: string;
        };
      }[];
    };
    studios: {
      nodes: {
        id: number;
        name: string;
      }[];
    };
    characters?: {
      nodes: {
        id: number;
        name: {
          full: string;
        };
      }[];
    };
  };
  statistics: UserStatistics;
}

/** A single activity history item with a date (epoch seconds) and numeric amount. @source */
export interface ActivityHistoryItem {
  date: number;
  amount: number;
}

/** Activity statistics container used for charting and summaries. @source */
export interface ActivityStats {
  activityHistory: ActivityHistoryItem[];
}

/** Pagination information used in AniList Page objects. @source */
export interface PageInfo {
  total: number;
}

/** Structure representing follower page counts and follower IDs. @source */
export interface FollowersPage {
  pageInfo: PageInfo;
  followers: { id: number }[];
}

/** Structure representing following page counts and following IDs. @source */
export interface FollowingPage {
  pageInfo: PageInfo;
  following: { id: number }[];
}

/** Structure representing threads page counts and thread IDs. @source */
export interface ThreadsPage {
  pageInfo: PageInfo;
  threads: { id: number }[];
}

/** Structure representing thread comment page counts and IDs. @source */
export interface ThreadCommentsPage {
  pageInfo: PageInfo;
  threadComments: { id: number }[];
}

/** Structure representing reviews page counts and IDs. @source */
export interface ReviewsPage {
  pageInfo: PageInfo;
  reviews: { id: number }[];
}

/** Combined user stats and page containers returned by AniList endpoints. @source */
export interface UserStatsData {
  User: UserSection;
  followersPage: FollowersPage;
  followingPage: FollowingPage;
  threadsPage: ThreadsPage;
  threadCommentsPage: ThreadCommentsPage;
  reviewsPage: ReviewsPage;
}

/** Redis user record shape used for persisting user data and stats. @source */
export interface UserRecord {
  // Unique identifier of the user (using string for IDs, which can also hold numeric values)
  userId: string;
  // The user's display name (optional if not always provided)
  username?: string;
  // Object containing user statistics.
  stats: UserStatsData;
  // The IP address from which the user data was recorded.
  ip: string;
  // The timestamp at which the record was created in ISO format.
  createdAt: string;
  // The timestamp at which the record was last updated in ISO format.
  updatedAt: string;
}

/** Stored card configuration shape persisted in user-card records. @source */
export interface StoredCardConfig {
  variation: string;
  // A unique name identifier for the card (used for picking the right template)
  cardName: string;
  // Color for the title in the card template.
  titleColor: string;
  // Background color for the card.
  backgroundColor: string;
  // Color for the text.
  textColor: string;
  // Circle color, for any circular elements in the card.
  circleColor: string;
  // Optional border color for the card background.
  borderColor?: string;
  // Whether to show favorites (pink heart) for this card
  showFavorites?: boolean;
  // Whether to use fixed status distribution colors (only meaningful for status distribution cards)
  useStatusColors?: boolean;
  // Whether to show percentages in pie chart legends (only meaningful for pie variants)
  showPiePercentages?: boolean;
}

/** Cards record in storage containing a userId, a list of stored card configs and update timestamp. @source */
export interface CardsRecord {
  // The user identifier that this record belongs to.
  userId: number;
  // An array of card configurations.
  cards: StoredCardConfig[];
  // The timestamp at which the record was last updated in ISO format.
  updatedAt: string;
}
