function forceRerender(svgElement) {
    // Get the parent of the SVG element
    var parent = svgElement.parentNode;

    // Remove the SVG element from the DOM
    parent.removeChild(svgElement);

    // Add the SVG element back to the DOM
    parent.appendChild(svgElement);
}

// Get all SVG elements
var svgs = document.querySelectorAll('svg');

// Create an intersection observer
var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
        if (entry.isIntersecting) {
            // The SVG element is in the viewport, force a re-render
            forceRerender(entry.target);
        }
    });
});

// Start observing all SVG elements
svgs.forEach(function(svg) {
    observer.observe(svg);
});