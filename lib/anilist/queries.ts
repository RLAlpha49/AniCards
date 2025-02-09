export const USER_ID_QUERY = `
  query GetUserId($userName: String) {
    User(name: $userName) {
      id
    }
  }
`;

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
          genres(limit: 5, sort: COUNT_DESC) {
            genre
            count
          }
          tags(limit: 5, sort: COUNT_DESC) {
            tag {
              name
            }
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
          genres(limit: 5, sort: COUNT_DESC) {
            genre
            count
          }
          tags(limit: 5, sort: COUNT_DESC) {
            tag {
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
      }
      stats {
        activityHistory {
          date
          amount
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
  }
`;
