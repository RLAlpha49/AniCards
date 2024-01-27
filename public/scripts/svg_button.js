// When the page is loaded, fetch the SVGs for all keys
window.onload = function() {
    // The keys and username variables will be defined in the HTML file
    for (let key of keys) {
        fetchSvg(key, username)();
    }
};

function fetchSvg(key, username) {
    return function() {
        const url = `/AniCards/StatCards/get_svg/${username}/${key}`;
        fetch(url)
            .then(response => {
                if (response.status === 404) {
                    throw new Error('SVG not found');
                } else if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(svg => {
                const container = document.getElementById(key);
                // If the SVG is not None, display the SVG
                container.innerHTML = `<img src="data:image/svg+xml;base64,${btoa(svg)}" />`;
            })
            .catch(error => {
                const container = document.getElementById(key);
                if (error.message === 'SVG not found') {
                    // If the SVG is not found, display a button that can be clicked to fetch the SVG
                    container.innerHTML = `<button class="svg-button" onclick="(fetchSvg('${key}', '${username}'))()">Retry creating SVG</button>`;
                } else {
                    // Display an error message
                    container.innerHTML = `Error: ${error.message}`;
                }
            });
    }
}