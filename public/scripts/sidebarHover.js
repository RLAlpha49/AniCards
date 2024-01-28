// Filename: public/scripts/sidebarHover.js

// Add an event listener for the DOMContentLoaded event
// This event is fired when the initial HTML document has been completely loaded and parsed
document.addEventListener('DOMContentLoaded', function() {
    // Get all the anchor elements inside list items in the sidebar navigation
    var links = document.querySelectorAll('.sidebar nav ul li a');

    // Loop over each link
    links.forEach(function(link) {
        // Get the image inside the link
        var img = link.querySelector('img');

        // If the href of the link matches the current URL
        if (link.href === window.location.href) {
            // Apply a filter to the image to invert the colors and set the brightness to 1
            img.style.filter = 'invert(1) brightness(1)';
            // Set the background color of the link to #16181f
            link.style.backgroundColor = '#16181f'; 
        } else {
            // Apply a filter to the image to invert the colors and set the brightness to 0.6
            img.style.filter = 'invert(1) brightness(0.6)';
            // Set the background color of the link to transparent
            link.style.backgroundColor = 'transparent';
        }
    });
});