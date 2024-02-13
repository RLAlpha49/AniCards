// Filename: public/scripts/forceRenderSVGs.js

// Function to force a re-render of an SVG element
function forceRerender(svgElement) {
  // Get the parent of the SVG element
  var parent = svgElement.parentNode

  // Remove the SVG element from the DOM
  parent.removeChild(svgElement)

  // Add the SVG element back to the DOM
  // This forces the browser to re-render the SVG
  parent.appendChild(svgElement)
}

// Get all SVG elements in the document
var svgs = document.querySelectorAll('svg')

// Create an intersection observer
// This will call a function whenever an SVG enters or leaves the viewport
var observer = new IntersectionObserver(function (entries) {
  // Loop over all the entries
  entries.forEach(function (entry) {
    // If the SVG is in the viewport
    if (entry.isIntersecting) {
      // Force a re-render of the SVG
      forceRerender(entry.target)
    }
  })
})

// Start observing all SVG elements
// Whenever an SVG enters or leaves the viewport, the observer will be notified
svgs.forEach(function (svg) {
  observer.observe(svg)
})
