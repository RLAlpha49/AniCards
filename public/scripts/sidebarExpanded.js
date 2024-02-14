// Filename: public/scripts/sidebarExpanded.js

// Add a click event listener to the element with id 'arrow'
document.getElementById('arrow').addEventListener('click', function () {
  const sidebar = document.getElementsByClassName('sidebar')[0]
  const footer = document.getElementsByClassName('footer-div')[0]
  const arrow = document.getElementById('arrow')

  if (sidebar.classList.contains('expanded')) {
    sidebar.classList.remove('expanded')
    arrow.classList.remove('expanded')
    // Check if the current page is 'anicards.html'
    if (window.location.pathname === '/') {
      footer.style.width = 'calc(100% - 62px)'
    }
  } else {
    sidebar.classList.add('expanded')
    arrow.classList.add('expanded')
    // Check if the current page is 'anicards.html'
    if (window.location.pathname === '/') {
      footer.style.width = 'calc(100% - 180px)'
    }
  }
})
