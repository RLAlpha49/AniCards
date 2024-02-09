// Filename: public/scripts/sidebarExpanded.js

// Add a click event listener to the element with id 'arrow'
document.getElementById('arrow').addEventListener('click', function () {
    var sidebar = document.getElementsByClassName('sidebar')[0];
    var footer = document.getElementsByClassName('footer-div')[0];

    if (sidebar.classList.contains('expanded')) {
        sidebar.classList.remove('expanded');
        // Check if the current page is 'anicards.html'
        if (window.location.pathname === '/') {
            footer.style.width = 'calc(100% - 62px)';
        }
    } else {
        sidebar.classList.add('expanded');
        // Check if the current page is 'anicards.html'
        if (window.location.pathname === '/') {
            footer.style.width = 'calc(100% - 180px)';
        }
    }
});