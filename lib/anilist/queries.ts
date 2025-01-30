export const USER_ID_QUERY = `
  query ($userName: String) {
    User(name: $userName) {
      id
    }
  }
`;

export const USER_STATS_QUERY = `
  query ($userName: String, $userId: Int!) {
    User(name: $userName) {
      statistics {
        anime {
          count
          episodesWatched
          minutesWatched
          meanScore
          standardDeviation
          genres(limit: 6, sort: COUNT_DESC) {
            genre
            count
          }
          tags(limit: 6, sort: COUNT_DESC) {
            tag {
              name
            }
            count
          }
          voiceActors(limit: 6, sort: COUNT_DESC) {
            voiceActor {
              name {
                full
              }
            }
            count
          }
          studios(limit: 6, sort: COUNT_DESC) {
            studio {
              name
            }
            count
          }
          staff(limit: 6, sort: COUNT_DESC) {
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
          genres(limit: 6, sort: COUNT_DESC) {
            genre
            count
          }
          tags(limit: 6, sort: COUNT_DESC) {
            tag {
              name
            }
            count
          }
          staff(limit: 6, sort: COUNT_DESC) {
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
          amount
        }
      }
    }
    followersPage: Page(perPage: 1) {
      pageInfo {
        total
      }
    }
    followingPage: Page(perPage: 1) {
      pageInfo {
        total
      }
    }
    threadsPage: Page {
      pageInfo {
        total
      }
    }
    threadCommentsPage: Page(perPage: 1) {
      pageInfo {
        total
      }
    }
    reviewsPage: Page(perPage: 1) {
      pageInfo {
        total
      }
    }
  }
`;
