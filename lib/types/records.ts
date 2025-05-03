/**
 * Detailed types for user statistics.
 */
export interface AnimeStatGenre {
  genre: string;
  count: number;
}

export interface AnimeStatTag {
  tag: { name: string };
  count: number;
}

export interface AnimeStatVoiceActor {
  voiceActor: { name: { full: string } };
  count: number;
}

export interface AnimeStatStudio {
  studio: { name: string };
  count: number;
}

export interface AnimeStatStaff {
  staff: { name: { full: string } };
  count: number;
}

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
}

export interface MangaStatGenre {
  genre: string;
  count: number;
}

export interface MangaStatTag {
  tag: { name: string };
  count: number;
}

export interface MangaStatStaff {
  staff: { name: { full: string } };
  count: number;
}

export interface MangaStats {
  count: number;
  chaptersRead: number;
  volumesRead: number;
  meanScore: number;
  standardDeviation: number;
  genres: MangaStatGenre[];
  tags: MangaStatTag[];
  staff: MangaStatStaff[];
}

export interface UserStatistics {
  anime: AnimeStats;
  manga: MangaStats;
}

export interface UserSection {
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
  };
  statistics: UserStatistics;
}

export interface ActivityHistoryItem {
  date: number;
  amount: number;
}

export interface ActivityStats {
  activityHistory: ActivityHistoryItem[];
}

export interface PageInfo {
  total: number;
}

export interface FollowersPage {
  pageInfo: PageInfo;
  followers: { id: number }[];
}

export interface FollowingPage {
  pageInfo: PageInfo;
  following: { id: number }[];
}

export interface ThreadsPage {
  pageInfo: PageInfo;
  threads: { id: number }[];
}

export interface ThreadCommentsPage {
  pageInfo: PageInfo;
  threadComments: { id: number }[];
}

export interface ReviewsPage {
  pageInfo: PageInfo;
  reviews: unknown[];
}

export interface UserStatsData {
  User: UserSection;
  stats: ActivityStats;
  followersPage: FollowersPage;
  followingPage: FollowingPage;
  threadsPage: ThreadsPage;
  threadCommentsPage: ThreadCommentsPage;
  reviewsPage: ReviewsPage;
}

/**
 * Types used for storing user and card records in Redis.
 */

/**
 * Represents a user record stored in Redis.
 */
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

/**
 * Represents a card configuration.
 * Adjust properties based on your actual card config schema.
 */
export interface CardConfig {
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
  // Whether to show favorites (pink heart) for this card
  showFavorites?: boolean;
}

/**
 * Represents the cards record stored in Redis.
 */
export interface CardsRecord {
  // The user identifier that this record belongs to.
  userId: number;
  // An array of card configurations.
  cards: CardConfig[];
  // The timestamp at which the record was last updated in ISO format.
  updatedAt: string;
}
