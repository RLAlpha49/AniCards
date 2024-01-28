document.addEventListener('DOMContentLoaded', function() {
    var links = document.querySelectorAll('.sidebar nav ul li a');
    links.forEach(function(link) {
        var img = link.querySelector('img');
        if (link.href === window.location.href) {
            img.style.filter = 'invert(1) brightness(1)';
            link.style.backgroundColor = '#16181f'; 
        } else {
            img.style.filter = 'invert(1) brightness(0.6)';
            link.style.backgroundColor = 'transparent';
        }
    });
});