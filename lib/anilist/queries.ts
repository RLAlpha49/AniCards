/** GraphQL query to resolve a username to an AniList user id. @source */
export const USER_ID_QUERY = `
  query GetUserId($userName: String) {
    User(name: $userName) {
      id
    }
  }
`;

/**
 * GraphQL query used to fetch a user's anime and manga statistics, social
 * metrics and related aggregation data required by the card generator.
 * @source
 */
export const USER_STATS_QUERY = `
  query GetUserStats($userId: Int!) {
    User(id: $userId) {
      statistics {
        anime {
          count
          episodesWatched
          minutesWatched
          meanScore
          standardDeviation
          statuses(limit: 10, sort: COUNT_DESC) {
            status
            count
          }
          formats(limit: 10, sort: COUNT_DESC) {
            format
            count
          }
          scores(limit: 10, sort: COUNT_DESC) {
            score
            count
          }
          releaseYears(limit: 25, sort: COUNT_DESC) {
            releaseYear
            count
          }
          countries(limit: 25, sort: COUNT_DESC) {
            country
            count
          }
          genres(limit: 25, sort: COUNT_DESC) {
            genre
            count
          }
          tags(limit: 25, sort: COUNT_DESC) {
            tag {
              name
              category
            }
            count
          }
          startYears(limit: 50, sort: ID_DESC) {
            startYear
            count
          }
          lengths(limit: 25, sort: ID_DESC) {
            length
            count
          }
          voiceActors(limit: 5, sort: COUNT_DESC) {
            voiceActor {
              name {
                full
              }
            }
            count
          }
          studios(limit: 5, sort: COUNT_DESC) {
            studio {
              name
            }
            count
          }
          staff(limit: 5, sort: COUNT_DESC) {
            staff {
              name {
                full
              }
            }
            count
          }
        }
        manga {
          count
          chaptersRead
          volumesRead
          meanScore
          standardDeviation
          statuses(limit: 10, sort: COUNT_DESC) {
            status
            count
          }
          formats(limit: 10, sort: COUNT_DESC) {
            format
            count
          }
          scores(limit: 10, sort: COUNT_DESC) {
            score
            count
          }
          releaseYears(limit: 25, sort: COUNT_DESC) {
            releaseYear
            count
          }
          countries(limit: 25, sort: COUNT_DESC) {
            country
            count
          }
          genres(limit: 25, sort: COUNT_DESC) {
            genre
            count
          }
          tags(limit: 25, sort: COUNT_DESC) {
            tag {
              name
              category
            }
            count
          }
          startYears(limit: 50, sort: ID_DESC) {
            startYear
            count
          }
          lengths(limit: 25, sort: ID_DESC) {
            length
            count
          }
          staff(limit: 5, sort: COUNT_DESC) {
            staff {
              name {
                full
              }
            }
            count
          }
        }
      }
      stats {
        activityHistory {
          date
          amount
        }
      }
      name
      avatar {
        large
        medium
      }
      createdAt
      favourites {
        anime (page: 1, perPage: 25) {
          nodes {
            id
            title {
              english
              romaji
              native
            }
            coverImage {
              large
              medium
              color
            }
          }
        }
        manga (page: 1, perPage: 25) {
          nodes {
            id
            title {
              english
              romaji
              native
            }
            coverImage {
              large
              medium
              color
            }
          }
        }
        characters (page: 1, perPage: 25) {
          nodes {
            id
            name {
              full
              native
            }
            image {
              large
              medium
            }
          }
        }
        staff (page: 1, perPage: 25) {
          nodes {
            id
            name {
              full
              native
            }
            image {
              large
              medium
            }
          }
        }
        studios (page: 1, perPage: 25) {
          nodes {
            id
            name
          }
        }
      }
    }
    followersPage: Page(perPage: 1) {
      pageInfo {
        total
      }
      followers(userId: $userId) {
        id
      }
    }
    followingPage: Page(perPage: 1) {
      pageInfo {
        total
      }
      following(userId: $userId) {
        id
      }
    }
    threadsPage: Page {
      pageInfo {
        total
      }
      threads(userId: $userId) {
        id
      }
    }
    threadCommentsPage: Page(perPage: 1) {
      pageInfo {
        total
      }
      threadComments(userId: $userId) {
        id
      }
    }
    reviewsPage: Page(perPage: 1) {
      pageInfo {
        total
      }
      reviews(userId: $userId) {
        id
      }
    }
    animePlanning: MediaListCollection(userId: $userId, type: ANIME, status: PLANNING, sort: SCORE_DESC) {
      lists {
        entries {
          id
          score
          media {
            id
            title {
              english
              romaji
              native
            }
            episodes
            averageScore
            format
          }
        }
      }
    }
    mangaPlanning: MediaListCollection(userId: $userId, type: MANGA, status: PLANNING, sort: SCORE_DESC) {
      lists {
        entries {
          id
          score
          media {
            id
            title {
              english
              romaji
              native
            }
            chapters
            volumes
            averageScore
            format
          }
        }
      }
    }
    animeRewatched: MediaListCollection(userId: $userId, type: ANIME, sort: REPEAT_DESC) {
      lists {
        entries {
          id
          repeat
          progress
          score
          media {
            id
            title {
              english
              romaji
              native
            }
            episodes
            format
          }
        }
      }
    }
    mangaReread: MediaListCollection(userId: $userId, type: MANGA, sort: REPEAT_DESC) {
      lists {
        entries {
          id
          repeat
          progress
          score
          media {
            id
            title {
              english
              romaji
              native
            }
            chapters
            volumes
            format
          }
        }
      }
    }
    animeCompleted: MediaListCollection(userId: $userId, type: ANIME, status: COMPLETED, sort: SCORE_DESC) {
      lists {
        entries {
          id
          score
          progress
          media {
            id
            title {
              english
              romaji
              native
            }
            episodes
            format
          }
        }
      }
    }
    mangaCompleted: MediaListCollection(userId: $userId, type: MANGA, status: COMPLETED, sort: SCORE_DESC) {
      lists {
        entries {
          id
          score
          progress
          media {
            id
            title {
              english
              romaji
              native
            }
            chapters
            volumes
            format
          }
        }
      }
    }
  }
`;
