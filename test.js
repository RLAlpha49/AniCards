const express = require('express');
const app = express();
const fetchAniListData = require('./AniListData');
const SVGs = require('./generateSVGs');

app.get('/:username', async (req, res) => {
    const data = await fetchAniListData(req.params.username);
    if (data) {
        const svg = SVGs.generateSVGs(data, ['animeCount', 'totalFollowers', 'totalFollowing', 'mangaCount', 'chaptersRead', 'episodesWatched', 'hoursWatched']);
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svg);
    } else {
        res.status(404).send('Too many requests');
    }
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));