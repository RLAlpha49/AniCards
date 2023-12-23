// Filename: public/scripts/fetch_data.js

// Function to fetch data from a specific URL and update an SVG element
function fetchData(name, username) {
    // Fetch data from the server
    fetch(`http://127.0.0.1:5000/${username}/${name}`)
        .then(response => response.text()) // Convert the response to text
        .then(data => {
            // Update the SVG element with the new data
            document.getElementById(name).src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
        })
        .catch(error => console.error('Error:', error)); // Log any errors
}