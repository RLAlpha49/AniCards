// Filename: public/scripts/download.js

// Function to fetch SVG from a URL and convert it to an Image object
async function fetchSvgAsImage(url) {
    // Fetch the SVG from the URL
    const response = await fetch(url);
    // Get the SVG text from the response
    const svgText = await response.text();
    // Create a Blob object from the SVG text
    const blob = new Blob([svgText], {type: "image/svg+xml"});
    // Create a URL for the Blob object
    const blobUrl = URL.createObjectURL(blob);

    // Return a new Promise that resolves with the Image object
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img); // Resolve the Promise when the image has loaded
        img.onerror = reject; // Reject the Promise if there's an error
        img.src = blobUrl; // Set the source of the Image object to the Blob URL
    });
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
    // Get the image element associated with the download button
    const imgElement = event.target.previousElementSibling;
    // Get the URL of the SVG
    const svgUrl = imgElement.src;
    // Create a filename for the PNG
    const filename = imgElement.id + '.png';

    try {
        // Fetch the SVG as an Image object
        const img = await fetchSvgAsImage(svgUrl);
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