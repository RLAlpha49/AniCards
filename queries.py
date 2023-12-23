# queries.py

USER_ID = """
    query ($userName: String) { 
        User(name: $userName) { 
            id
        } 
    }
"""

USER_ANIME_COUNT = """
    query ($userName: String) { 
        User(name: $userName) { 
            statistics { 
                anime { 
                    count 
                } 
            } 
        }
    }
"""

USER_EPISODES_WATCHED = """
    query ($userName: String) { 
        User(name: $userName) { 
            statistics { 
                anime { 
                    episodesWatched 
                } 
            } 
        } 
    }
"""

USER_HOURS_WATCHED = """
    query ($userName: String) { 
        User(name: $userName) { 
            statistics { 
                anime { 
                    minutesWatched 
                } 
            } 
        }
    }
"""

USER_MANGA_COUNT = """
    query ($userName: String) { 
        User(name: $userName) { 
            statistics { 
                manga { 
                    count 
                } 
            } 
        } 
    }
"""

USER_CHAPTERS_READ = """
    query ($userName: String) { 
        User(name: $userName) { 
            statistics { 
                manga { 
                    chaptersRead 
                } 
            } 
        }
    }
"""

USER_TOTAL_ACTIVITIES = """
    query ($userName: String) {
        User(name: $userName) { 
            stats {
                activityHistory {
                    amount
                }
            }
        }
    }
"""

USER_TOTAL_FOLLOWERS = """
    query ($userId: Int!) { 
        Page {
            pageInfo {
                total
            }
            followers(userId: $userId) {
                id
            }
        }
    }
"""

USER_TOTAL_FOLLOWING = """
    query ($userId: Int!) { 
        Page {
            pageInfo {
                total
            }
            following(userId: $userId) {
                id
            }
        }
    }
"""