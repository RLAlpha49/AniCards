// queries.js

module.exports = {
    USER_ID: `
        query ($userName: String) { 
            User(name: $userName) { 
                id
            } 
        }
    `,
    USER_ANIME_COUNT: `
        query ($userName: String) { 
            User(name: $userName) { 
                statistics { 
                    anime { 
                        count 
                    } 
                } 
            } 
        }
    `,
    USER_TOTAL_ACTIVITIES: `
        query ($userName: String) {
            User(name: $userName) { 
                stats {
                    activityHistory {
                        amount
                    }
                }
            }
        }
    `,
    USER_TOTAL_FOLLOWERS: `
        query ($userId: Int!) { 
            Page {
                followers(userId: $userId) {
                    id
                }
            }
        }
    `,
    USER_TOTAL_FOLLOWING: `
        query ($userId: Int!) { 
            Page {
                following(userId: $userId) {
                    id
                }
            }
        }
    `,
};