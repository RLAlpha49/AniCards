"""
This module contains GraphQL queries for fetching user data from an API.

The queries fetch various user statistics including anime, manga, and social stats.
"""

USER_ID = """
    query ($userName: String) {
        User(name: $userName) {
            id
        }
    }
"""

USER_ANIME_MANGA_SOCIAL_STATS = """
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
        threadsPage: Page(perPage: 1) {
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
"""
