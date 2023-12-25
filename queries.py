# queries.py

USER_ID = """
    query ($userName: String) { 
        User(name: $userName) { 
            id
        } 
    }
"""

USER_ANIME_STATS = """
    query ($userName: String) { 
        User(name: $userName) { 
            statistics { 
                anime { 
                    count
                    episodesWatched
                    minutesWatched
                    meanScore
                    standardDeviation
                } 
            } 
        } 
    }
"""

USER_MANGA_STATS = """
    query ($userName: String) { 
        User(name: $userName) { 
            statistics { 
                manga { 
                    count
                    chaptersRead
                    volumesRead
                    meanScore
                    standardDeviation
                } 
            } 
        } 
    }
"""

USER_SOCIAL_STATS = """
    query ($userName: String, $userId: Int!) {
        User(name: $userName) { 
            stats {
                activityHistory {
                    amount
                }
            }
        }
        followersPage: Page {
            pageInfo {
                total
            }
            followers(userId: $userId) {
                id
            }
        }
        followingPage: Page {
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
        threadCommentsPage: Page {
            pageInfo {
                total
            }
            threadComments(userId: $userId) {
                id
            }
        }
        reviewsPage: Page {
            pageInfo {
                total
            }
            reviews(userId: $userId) {
                id
            }
        }
    }
"""