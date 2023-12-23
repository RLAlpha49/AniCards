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
        Page {
            pageInfo {
                total
            }
            followers(userId: $userId) {
                id
            }
            following(userId: $userId) {
                id
            }
        }
    }
"""