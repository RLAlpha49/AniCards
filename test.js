const axios = require('axios');
const express = require('express');
const app = express();
const { USER_ID, USER_ANIME_COUNT, USER_TOTAL_FOLLOWERS, USER_TOTAL_FOLLOWING } = require('./queries');

// Fetch data from AniList's API
async function fetchAniListData(username) {
    const userIdResponse = await axios.post('https://graphql.anilist.co', {
        query: USER_ID,
        variables: { userName: username },
    });
    const userId = userIdResponse.data.data.User.id;

    const animeCountResponse = await axios.post('https://graphql.anilist.co', {
        query: USER_ANIME_COUNT,
        variables: { userName: username },
    });
    const animeCount = animeCountResponse.data.data.User.statistics.anime.count;

    const totalFollowersResponse = await axios.post('https://graphql.anilist.co', {
        query: USER_TOTAL_FOLLOWERS,
        variables: { userId: userId },
    });
    const totalFollowers = totalFollowersResponse.data.data.Page.followers.length;

    const totalFollowingResponse = await axios.post('https://graphql.anilist.co', {
        query: USER_TOTAL_FOLLOWING,
        variables: { userId: userId },
    });
    const totalFollowing = totalFollowingResponse.data.data.Page.following.length;

    return { animeCount, totalFollowers, totalFollowing };
}

// Generate SVG
function generateSVG(count) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="100">
        <text x="0" y="50" font-size="35">Watched anime count: ${count}</text>
    </svg>`;
}

// Setup server
app.get('/:username', async (req, res) => {
    const count = await fetchAniListData(req.params.username);
    const svg = generateSVG(count);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
});

app.listen(3000, () => console.log('Server running on port 3000'));