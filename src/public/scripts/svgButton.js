/* eslint-disable no-undef */
// Filename: public/scripts/svgButton.js

// When the page is loaded, set up an Intersection Observer for each SVG container
window.onload = function () {
  // The keys and username variables will be defined in the HTML file
  // Loop over each key and set up an Intersection Observer for the corresponding SVG container
  for (const key of keys) {
    observeSvg(key, username)
  }
}

// Function to set up an Intersection Observer for a given SVG container
function observeSvg (key, username) {
  // Get the container element by its ID, which is assumed to be the same as the key
  const container = document.getElementById(key)

  // Create a new IntersectionObserver instance
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      // If the container is in the viewport, fetch the SVG
      if (entry.isIntersecting) {
        fetchSvg(key, username)()

        // Once the SVG is fetched, we don't need to observe the container anymore
        observer.unobserve(container)
      }
    })
  })

  // Observe the SVG container
  observer.observe(container)
}

// Function to fetch an SVG for a given key and username
function fetchSvg (key, username) {
  // Return a function that fetches the SVG when called
  return function () {
    // Construct the URL for the fetch request
    const url = `/StatCards/get_svg/${username}/${key}`

    // Fetch the SVG from the server
    fetch(url)
      .then(response => {
        // If the response status is 404, throw an error indicating the SVG was not found
        if (response.status === 404) {
          throw new Error('SVG not found')
        } else if (!response.ok) {
          // If the response status is not OK, throw an error with the status
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        // Otherwise, return the response text
        return response.text()
      })
      .then(svg => {
        // Get the container element by its ID, which is assumed to be the same as the key
        const container = document.getElementById(key)

        // Set the inner HTML of the container to an image element with the SVG as its source
        // The SVG is base64-encoded and prefixed with the necessary data URL metadata
        // Add an alt attribute to the image element
        container.innerHTML = `<img src="data:image/svg+xml;base64,${btoa(svg)}" alt="SVG image of ${key}" />`
      })
      .catch(error => {
        // Get the container element by its ID, which is assumed to be the same as the key
        const container = document.getElementById(key)

        // If the error message indicates the SVG was not found
        if (error.message === 'SVG not found') {
          // Set the inner HTML of the container to a button that can be clicked to retry fetching the SVG
          container.innerHTML = `<button class="svg-button" onclick="(fetchSvg('${key}', '${username}'))()">Retry creating SVG</button>`
        } else {
          // Otherwise, set the inner HTML of the container to an error message
          container.innerHTML = `Error: ${error.message}`
        }
      })
  }
}
