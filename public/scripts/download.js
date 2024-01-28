// Filename: public/scripts/download.js

// Function to modify SVG document
function modifySvgDoc(svgDoc, dashoffset) {
    const staggerElements = Array.from(svgDoc.querySelectorAll('.stagger'));
    staggerElements.forEach(element => {
        element.style.opacity = '1';
        element.style.animationDelay = '';
    });

    const styleElements = Array.from(svgDoc.querySelectorAll('style'));
    styleElements.forEach(style => {
        const cssRules = style.innerHTML.split('}').map(rule => rule.trim()).filter(Boolean);
        const filteredRules = cssRules.map(rule => {
            return filterAnimationProperties(rule);
        }).filter(Boolean);
        style.innerHTML = filteredRules.join(' ');
    });

    // Set the stroke-dashoffset property to its final value
    const rankCircle = svgDoc.querySelector('.rank-circle');
    if (rankCircle && dashoffset !== null) {
        rankCircle.style.strokeDashoffset = dashoffset;
    }
}

// Function to filter out animation properties from CSS rule
function filterAnimationProperties(rule) {
    if (rule.startsWith('@keyframes')) {
        return '';
    }
    const [selector, properties] = rule.split('{');
    const parsedProperties = properties.split(';').map(prop => prop.trim()).filter(Boolean);
    const filteredProperties = parsedProperties.filter(prop => {
        if (selector.trim() === '.stagger' && prop.startsWith('animation')) {
            return false;
        }
        return !prop.startsWith('animation');
    });
    return `${selector} { ${filteredProperties.join('; ')} }`;
}

// Function to fetch SVG from a URL and convert it to an Image object
async function fetchSvgAsImage(url, key) {
    const response = await fetch(url);
    let svgText = await response.text();

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');

    let dashoffset = null;
    if (key === 'animeStats' || key === 'mangaStats') {
        const userData = getUserDataFromSvg(svgDoc, key);
        dashoffset = calculateDashoffset(userData);
    }

    modifySvgDoc(svgDoc, dashoffset);

    const serializer = new XMLSerializer();
    svgText = serializer.serializeToString(svgDoc);

    const img = new Image();
    img.src = 'data:image/svg+xml,' + encodeURIComponent(svgText);

    return new Promise((resolve, reject) => {
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            img.src = canvas.toDataURL('image/png');
            resolve(img);
        };
        img.onerror = reject;
    });
}

// Function to get user data from SVG
function getUserDataFromSvg(svgDoc, key) {
    let dataTestId = '';
    if (key === 'animeStats') {
        dataTestId = 'episodesWatched';
    } else if (key === 'mangaStats') {
        dataTestId = 'chaptersRead';
    }

    // Find the text element with the data-testid
    const dataElement = svgDoc.querySelector(`[data-testid="${dataTestId}"]`);

    // Check if the element exists
    if (!dataElement) {
        console.error(`Element with data-testid "${dataTestId}" not found in SVG document`);
        return null;
    }

    // Get the text content of the element
    const dataValue = parseInt(dataElement.textContent, 10);

    // Return the user data
    return {
        dataValue: dataValue
    };
}

// Function to calculate dashoffset
function calculateDashoffset(userData) {
    // Initialize milestones array with the first three milestones
    let milestones = [100, 300, 500];

    // Determine the maximum milestone based on the user's data
    let maxMilestone = Math.ceil(userData.dataValue / 1000) * 1000;

    // Generate the rest of the milestones
    for (let i = 1000; i <= maxMilestone; i += 1000) {
        milestones.push(i);
    }

    const previous_milestone = Math.max(...milestones.filter(milestone => milestone < userData.dataValue));
    const current_milestone = Math.min(...milestones.filter(milestone => milestone > userData.dataValue));

    const percentage = ((userData.dataValue - previous_milestone) / (current_milestone - previous_milestone)) * 100;
    const circle_circumference = 2 * Math.PI * 40;
    const dashoffset = circle_circumference * (1 - (percentage / 100));

    return dashoffset;
}

// Function to convert an Image object to a PNG and download it
function downloadImageAsPng(img, filename) {
    // Create a new canvas element
    const canvas = document.createElement('canvas');
    // Set the canvas dimensions to match the image
    canvas.width = img.width;
    canvas.height = img.height;
    // Get the 2D rendering context for the canvas
    const ctx = canvas.getContext('2d');
    // Draw the image onto the canvas
    ctx.drawImage(img, 0, 0);
    // Get a data URL for the PNG image
    const pngUrl = canvas.toDataURL('image/png');

    // Create a new anchor element for the download
    const a = document.createElement('a');
    a.download = filename; // Set the download filename
    a.href = pngUrl; // Set the href to the data URL
    a.click(); // Trigger a click event to start the download
}

// Function to handle click events on download buttons
async function handleDownloadButtonClick(event) {
    // Get the URL of the SVG from the data-url attribute of the download button
    let svgUrl = event.target.getAttribute('data-url');
    // Replace http:// with https:// in the SVG URL
    if (window.location.protocol === 'https:') {
        svgUrl = svgUrl.replace('http://', 'https://');
    }
    // Get the key from the data-key attribute of the download button
    const key = event.target.getAttribute('data-key');
    // Create a filename for the PNG based on the key
    const filename = `${key}.png`;

    try {
        // Fetch the SVG as an Image object
        const img = await fetchSvgAsImage(svgUrl, key);
        // Download the Image object as a PNG
        downloadImageAsPng(img, filename);
    } catch (error) {
        // Log any errors to the console
        console.error('Failed to download SVG as PNG:', error);
    }
}

// Add click event listeners to all download buttons
const downloadButtons = document.querySelectorAll('.download-button');
downloadButtons.forEach(button => {
    // Add a click event listener to each download button
    button.addEventListener('click', handleDownloadButtonClick);
});