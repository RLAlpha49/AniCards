// Filename: public/scripts/sidebarHover.js

// Add an event listener for the DOMContentLoaded event
// This event is fired when the initial HTML document has been completely loaded and parsed
document.addEventListener('DOMContentLoaded', function () {
  // Get all the list items in the sidebar navigation
  const listItems = document.querySelectorAll('.sidebar nav ul li')

  // Loop over each list item
  listItems.forEach(function (listItem) {
    const link = listItem.querySelector('a')

    // Check if the listItem is not the site icon
    if (!listItem.classList.contains('site-icon-li')) {
      // Check if the link's href is equal to the current URL or if the link's href ends with 'StatCards/' and the current URL starts with the link's href
      if (
        link.href === window.location.href ||
        (link.href.endsWith('StatCards/') &&
          window.location.href.startsWith(link.href))
      ) {
        listItem.classList.add('active-link')
      } else {
        listItem.classList.remove('active-link')
      }
    }
  })
})
