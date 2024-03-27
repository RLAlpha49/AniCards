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
      if (window.innerWidth < 400) {
        footer.style.width = 'calc(100% - ' + (64 * 0.5) + 'px)'
      } else if (window.innerWidth < 450) {
        footer.style.width = 'calc(100% - ' + (64 * 0.6) + 'px)'
      } else if (window.innerWidth < 500) {
        footer.style.width = 'calc(100% - ' + (64 * 0.7) + 'px)'
      } else if (window.innerWidth < 550) {
        footer.style.width = 'calc(100% - ' + (64 * 0.8) + 'px)'
      } else if (window.innerWidth < 700) {
        footer.style.width = 'calc(100% - ' + (64 * 0.9) + 'px)'
      } else {
        footer.style.width = 'calc(100% - 64px)'
      }
    }
    // Check if the page title is 'AniCards Error'
    if (document.title === 'AniCards Error') {
    // Remove the style element if it exists
      const style = document.getElementById('footer-div-style')
      if (style) {
        document.head.removeChild(style)
      }
    }
  } else {
    sidebar.classList.add('expanded')
    arrow.classList.add('expanded')
    // Check if the current page is 'anicards.html'
    if (window.location.pathname === '/') {
      if (window.innerWidth < 400) {
        footer.style.width = 'calc(100% - ' + (180 * 0.5) + 'px)'
      } else if (window.innerWidth < 450) {
        footer.style.width = 'calc(100% - ' + (180 * 0.6) + 'px)'
      } else if (window.innerWidth < 500) {
        footer.style.width = 'calc(100% - ' + (180 * 0.7) + 'px)'
      } else if (window.innerWidth < 550) {
        footer.style.width = 'calc(100% - ' + (180 * 0.8) + 'px)'
      } else if (window.innerWidth < 700) {
        footer.style.width = 'calc(100% - ' + (180 * 0.9) + 'px)'
      } else {
        footer.style.width = 'calc(100% - 180px)'
      }
    }
    // Check if the page title is 'AniCards Error'
    if (document.title === 'AniCards Error') {
      const style = document.createElement('style')
      style.id = 'footer-div-style'
      style.innerHTML = `
        .footer-div {
          width: auto !important;
        }
      `
      document.head.appendChild(style)
    }
  }
})
