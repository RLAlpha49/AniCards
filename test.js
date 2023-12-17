const axios = require('axios');
const express = require('express');
const app = express();
const queries = require('./queries');

async function fetchAniListData(username) {
    const userIdResponse = await axios.post('https://graphql.anilist.co', {
        query: queries.USER_ID,
        variables: { userName: username },
    });

    const userId = userIdResponse.data.data.User.id;

    const [animeCountResponse, totalFollowersResponse, totalFollowingResponse, mangaCountResponse, chaptersReadResponse, episodesWatchedResponse, minutesWatchedResponse] = await Promise.all([
        axios.post('https://graphql.anilist.co', {
            query: queries.USER_ANIME_COUNT,
            variables: { userName: username },
        }),
        axios.post('https://graphql.anilist.co', {
            query: queries.USER_TOTAL_FOLLOWERS,
            variables: { userId },
        }),
        axios.post('https://graphql.anilist.co', {
            query: queries.USER_TOTAL_FOLLOWING,
            variables: { userId },
        }),
        axios.post('https://graphql.anilist.co', {
            query: queries.USER_MANGA_COUNT,
            variables: { userName: username },
        }),
        axios.post('https://graphql.anilist.co', {
            query: queries.USER_CHAPTERS_READ,
            variables: { userName: username },
        }),
        axios.post('https://graphql.anilist.co', {
            query: queries.USER_EPISODES_WATCHED,
            variables: { userName: username },
        }),
        axios.post('https://graphql.anilist.co', {
            query: queries.USER_HOURS_WATCHED,
            variables: { userName: username },
        }),
    ]);

    return {
        animeCount: animeCountResponse.data.data.User.statistics.anime.count,
        totalFollowers: totalFollowersResponse.data.data.Page.pageInfo.total,
        totalFollowing: totalFollowingResponse.data.data.Page.pageInfo.total,
        mangaCount: mangaCountResponse.data.data.User.statistics.manga.count,
        chaptersRead: chaptersReadResponse.data.data.User.statistics.manga.chaptersRead,
        episodesWatched: episodesWatchedResponse.data.data.User.statistics.anime.episodesWatched,
        hoursWatched: minutesWatchedResponse.data.data.User.statistics.anime.minutesWatched / 60,
    };
}

// Generate SVG
function generateSVG(label, value, y) {
    return `
        <text x="0" y="${y}" font-size="35">${label}: ${value}</text>
    `;
}

// Setup server
function generateAnimeCountSVG(data) {
    return generateSVG('Watched anime count', data.animeCount, 50);
}

function generateEpisodesWatchedSVG(data) {
    return generateSVG('Total episodes watched', data.episodesWatched, 550);
}

function generateHoursWatchedSVG(data) {
    return generateSVG('Total hours watched', data.hoursWatched, 650);
}

function generateMangaCountSVG(data) {
    return generateSVG('Total manga read', data.mangaCount, 350);
}

function generateChaptersReadSVG(data) {
    return generateSVG('Total chapters read', data.chaptersRead, 450);
}

function generateTotalFollowersSVG(data) {
    return generateSVG('Total followers', data.totalFollowers, 150);
}

function generateTotalFollowingSVG(data) {
    return generateSVG('Total following', data.totalFollowing, 250);
}

app.get('/:username', async (req, res) => {
    const data = await fetchAniListData(req.params.username);
    res.setHeader('Content-Type', 'image/svg+xml');
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="500" height="700">
            ${generateAnimeCountSVG(data)}
            ${generateEpisodesWatchedSVG(data)}
            ${generateHoursWatchedSVG(data)}
            ${generateMangaCountSVG(data)}
            ${generateChaptersReadSVG(data)}
            ${generateTotalFollowersSVG(data)}
            ${generateTotalFollowingSVG(data)}
        </svg>
    `;
    res.send(svg);
});

app.listen(3000, () => console.log('Server running on port 3000'));