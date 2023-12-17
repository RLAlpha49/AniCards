const axios = require('axios');
const queries = require('./queries');
const _ = require('lodash');

async function fetchAniListData(username) {
    try {
        const userIdResponse = await axios.post('https://graphql.anilist.co', {
            query: queries.USER_ID,
            variables: { userName: username },
        });

        const userId = userIdResponse.data.data.User.id;

        const data = {
            animeCount: null,
            totalFollowers: null,
            totalFollowing: null,
            mangaCount: null,
            chaptersRead: null,
            episodesWatched: null,
            hoursWatched: null,
        };

        const requests = [
            { query: queries.USER_ANIME_COUNT, variables: { userName: username }, key: 'animeCount', path: 'User.statistics.anime.count' },
            { query: queries.USER_TOTAL_FOLLOWERS, variables: { userId }, key: 'totalFollowers', path: 'Page.pageInfo.total' },
            { query: queries.USER_TOTAL_FOLLOWING, variables: { userId }, key: 'totalFollowing', path: 'Page.pageInfo.total' },
            { query: queries.USER_MANGA_COUNT, variables: { userName: username }, key: 'mangaCount', path: 'User.statistics.manga.count' },
            { query: queries.USER_CHAPTERS_READ, variables: { userName: username }, key: 'chaptersRead', path: 'User.statistics.manga.chaptersRead' },
            { query: queries.USER_EPISODES_WATCHED, variables: { userName: username }, key: 'episodesWatched', path: 'User.statistics.anime.episodesWatched' },
            { query: queries.USER_HOURS_WATCHED, variables: { userName: username }, key: 'hoursWatched', path: 'User.statistics.anime.minutesWatched' },
        ];

        for (const request of requests) {
            try {
                const response = await axios.post('https://graphql.anilist.co', {
                    query: request.query,
                    variables: request.variables,
                });

                const value = request.key === 'hoursWatched'
                    ? Math.round(_.get(response, 'data.data.' + request.path) / 60)
                    : _.get(response, 'data.data.' + request.path);

                data[request.key] = value;
            } catch (error) {
                if (error.response && error.response.status === 429) {
                    console.error('Rate limit exceeded for', request.key);
                    data[request.key] = null;
                } else {
                    throw error;
                }
            }
        }

        return data;
    } catch (error) {
        console.error(`Failed to fetch data for user ${username}:`, error);
        return null;
    }
}

module.exports = fetchAniListData;