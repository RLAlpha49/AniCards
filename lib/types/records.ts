/** Genre bucket in anime statistics with a count of items. @source */
export interface AnimeStatGenre {
  genre: string;
  count: number;
}

/** Tag bucket in anime statistics with a referenced tag name and count. @source */
export interface AnimeStatTag {
  tag: { name: string; category?: string };
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
  startYears?: { startYear: number; count: number }[];
  lengths?: { length: string; count: number }[];
}

/** Genre bucket in manga statistics with a count of items. @source */
export interface MangaStatGenre {
  genre: string;
  count: number;
}

/** Tag bucket in manga statistics with a referenced tag name and count. @source */
export interface MangaStatTag {
  tag: { name: string; category?: string };
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
  startYears?: { startYear: number; count: number }[];
  lengths?: { length: string; count: number }[];
}

/** Container that groups anime and manga statistics for a user. @source */
export interface UserStatistics {
  anime: AnimeStats;
  manga: MangaStats;
}

/** Title structure for anime/manga with multiple language options. @source */
export interface MediaTitle {
  english?: string;
  romaji?: string;
  native?: string;
}

/** Cover image structure for anime/manga with size variants and color. @source */
export interface MediaCoverImage {
  large?: string;
  medium?: string;
  color?: string;
}

/** A favorite anime node with title and cover. @source */
export interface FavoriteAnimeNode {
  id: number;
  title: MediaTitle;
  coverImage: MediaCoverImage;
}

/** A favorite manga node with title and cover. @source */
export interface FavoriteMangaNode {
  id: number;
  title: MediaTitle;
  coverImage: MediaCoverImage;
}

/** Character image structure with size variants. @source */
export interface CharacterImage {
  large?: string;
  medium?: string;
}

/** A favorite character node with name and image. @source */
export interface FavoriteCharacterNode {
  id: number;
  name: {
    full: string;
    native?: string;
  };
  image: CharacterImage;
}

/** Staff image structure with size variants. @source */
export interface StaffImage {
  large?: string;
  medium?: string;
}

/** A favorite staff node with name and image. @source */
export interface FavoriteStaffNode {
  id: number;
  name: {
    full: string;
    native?: string;
  };
  image: StaffImage;
}

/** A favorite studio node with name. @source */
export interface FavoriteStudioNode {
  id: number;
  name: string;
}

/** Favourites container with anime, manga, characters, staff, and studios. @source */
export interface UserFavourites {
  anime?: {
    nodes: FavoriteAnimeNode[];
    pageInfo?: PageInfo;
  };
  manga?: {
    nodes: FavoriteMangaNode[];
    pageInfo?: PageInfo;
  };
  characters?: {
    nodes: FavoriteCharacterNode[];
    pageInfo?: PageInfo;
  };
  staff: {
    nodes: FavoriteStaffNode[];
    pageInfo?: PageInfo;
  };
  studios: {
    nodes: FavoriteStudioNode[];
    pageInfo?: PageInfo;
  };
}

/** User avatar structure with size variants. @source */
export interface UserAvatar {
  large?: string;
  medium?: string;
}

/** User section returned by AniList GraphQL for a User entry. @source */
export interface UserSection {
  stats: ActivityStats | Record<string, unknown>;
  favourites: UserFavourites;
  statistics: UserStatistics;
  name?: string;
  avatar?: UserAvatar;
  createdAt?: number;
}

/** A single activity history item with a date (epoch seconds) and numeric amount. @source */
export interface ActivityHistoryItem {
  date: number;
  amount: number;
}

/** Activity statistics container used for charting and summaries. @source */
export interface ActivityStats {
  activityHistory: ActivityHistoryItem[];
  [key: string]: unknown;
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

/** A media list entry for anime or manga with progress, score, and repeat data. @source */
export interface MediaListEntry {
  id: number;
  score?: number;
  progress?: number;
  repeat?: number;
  media: {
    id: number;
    title: MediaTitle;
    coverImage?: MediaCoverImage;
    episodes?: number;
    chapters?: number;
    volumes?: number;
    averageScore?: number;
    format?: string;
  };
}

/** A list within MediaListCollection containing entries grouped by status. @source */
export interface MediaListGroup {
  name?: string;
  entries: MediaListEntry[];
}

/** MediaListCollection response containing grouped lists of media entries. @source */
export interface MediaListCollection {
  lists: MediaListGroup[];
  count?: number;
  totalRepeat?: number;
}

/** Combined user stats and page containers returned by AniList endpoints. @source */
export interface UserStatsData {
  User: UserSection;
  followersPage: FollowersPage;
  followingPage: FollowingPage;
  threadsPage: ThreadsPage;
  threadCommentsPage: ThreadCommentsPage;
  reviewsPage: ReviewsPage;
  animePlanning?: MediaListCollection;
  mangaPlanning?: MediaListCollection;
  animeCurrent?: MediaListCollection;
  mangaCurrent?: MediaListCollection;
  animeRewatched?: MediaListCollection;
  mangaReread?: MediaListCollection;
  animeCompleted?: MediaListCollection;
  mangaCompleted?: MediaListCollection;
}

/** Redis user record shape used for persisting user data and stats. @source */
export interface UserRecord {
  userId: string;
  username?: string;
  stats: UserStatsData;
  statistics?: UserSection["statistics"];
  favourites?: UserSection["favourites"];
  pages?: {
    followersPage?: FollowersPage;
    followingPage?: FollowingPage;
    threadsPage?: ThreadsPage;
    threadCommentsPage?: ThreadCommentsPage;
    reviewsPage?: ReviewsPage;
  };
  ip: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A more specific shape returned by `reconstructUserRecord` which guarantees
 * that convenience fields like `statistics`, `favourites` and page containers
 * are present.
 */
export type ReconstructedUserRecord = UserRecord & {
  statistics: UserSection["statistics"];
  favourites: UserSection["favourites"];
  pages: {
    followersPage: FollowersPage;
    followingPage: FollowingPage;
    threadsPage: ThreadsPage;
    threadCommentsPage: ThreadCommentsPage;
    reviewsPage: ReviewsPage;
  };
};

/** Stored card configuration shape persisted in user-card records. @source */
export interface StoredCardConfig {
  cardName: string;
  variation: string;
  colorPreset?: string;
  titleColor?: string;
  backgroundColor?: string;
  textColor?: string;
  circleColor?: string;
  borderColor?: string;
  borderRadius?: number;
  showFavorites?: boolean;
  useStatusColors?: boolean;
  showPiePercentages?: boolean;
  gridCols?: number;
  gridRows?: number;
}

/** Cards record in storage containing a userId, a list of stored card configs and update timestamp. @source */
export interface CardsRecord {
  userId: number;
  cards: StoredCardConfig[];
  updatedAt: string;
}
