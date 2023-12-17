function generateSVGs(data, keys) {
    const svgKeys = keys;
    const svgs = [];
    let y = 0;
    console.log(data);

    for (const key of svgKeys) {
        const svg = generateSVG(key, data[key], y);
        svgs.push(svg);
        y += 100;  // Increase y by the height of each SVG
    }

    return `<svg xmlns="http://www.w3.org/2000/svg">${svgs.join('\n')}</svg>`;
}

function generateSVG(title, value, y) {
    if (value === null) {
        return generateButton(title, y);
    } else {
        return `
            <g transform="translate(0, ${y})">
                <text x="0" y="50" font-size="35">${title}: ${value}</text>
            </g>
        `;
    }
}

function generateButton(name, y) {
    return `
        <g transform="translate(0, ${y})" onclick="${fetchData(name, 'username')}" style="cursor: pointer;">
            <rect x="0" y="0" width="500" height="100" style="fill:blue;stroke:black;stroke-width:1;fill-opacity:0.1;stroke-opacity:0.9" />
            <text x="250" y="50" text-anchor="middle" font-size="35">Retry</text>
        </g>
    `;
}

function fetchData(name, username) {
    console.log('Fetching data for', name);
    fetch(`http://localhost:3000/Alpha49`)
        .then(response => {
            // Check if the response is JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                // Parse the response as JSON
                return response.json();
            } else {
                // Throw an error
                throw new Error('Server response is not JSON');
            }
        })
        .then(data => {
            if (data[name] !== null) {
                // Update the SVG with the new data
                document.getElementById(`${name}Button`).innerHTML = `
                    <text x="0" y="50" font-size="35">${name}: ${data[name]}</text>
                `;
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
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

module.exports = {
    generateSVGs
};