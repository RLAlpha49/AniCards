// Filename: public/scripts/sidebarExpanded.js

// Add a click event listener to the element with id 'arrow'
document.getElementById('arrow').addEventListener('click', function() {
    // Get the first element with class 'sidebar'
    var sidebar = document.getElementsByClassName('sidebar')[0];

    // Check if the sidebar has the class 'expanded'
    if (sidebar.classList.contains('expanded')) {
        // If it does, remove the 'expanded' class
        sidebar.classList.remove('expanded');
        footer.style.width = 'calc(100% - 62px)';
    } else {
        // If it doesn't, add the 'expanded' class
        sidebar.classList.add('expanded');
        footer.style.width = 'calc(100% - 180px)';
    }
});