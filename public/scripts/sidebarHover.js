// Filename: public/scripts/sidebarHover.js

// Add an event listener for the DOMContentLoaded event
// This event is fired when the initial HTML document has been completely loaded and parsed
document.addEventListener('DOMContentLoaded', function() {
    // Get all the anchor elements inside list items in the sidebar navigation
    var links = document.querySelectorAll('.sidebar nav ul li a');
    console.log(links);

    // Loop over each link
    links.forEach(function(link) {
        var img = link.querySelector('img');

        if (link.href === window.location.href) {
            link.classList.add('active-link');
        } else {
            link.classList.remove('active-link');
        }
    });
});