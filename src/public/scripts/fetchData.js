/* eslint-disable no-unused-vars */
// Filename: public/scripts/fetchData.js

// Function to fetch data from a specific URL and update an SVG element
function fetchData (name, username) {
  // Construct the URL for the fetch request using the provided username and name
  const url = `/StatCards/${username}/${name}`

  // Fetch data from the server
  fetch(url)
    .then((response) => {
      // Convert the response to text
      return response.text()
    })
    .then((data) => {
      // Get the SVG element by its ID, which is assumed to be the same as the name
      const svgElement = document.getElementById(name)

      // Update the SVG element's source with the fetched data
      // The data is URL-encoded and prefixed with the necessary data URL metadata
      svgElement.src =
        'data:image/svg+xmlcharset=utf-8,' + encodeURIComponent(data)

      // Add an alt attribute to the SVG element
      svgElement.setAttribute('alt', `SVG image of ${name}`)
    })
    .catch((error) => {
      // Log any errors that occurred during the fetch
      console.error('Error:', error)
    })
}
