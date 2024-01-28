// Filename: public/scripts/arrow.js

// Wait for the DOM to fully load
document.addEventListener('DOMContentLoaded', function() {
    // Select all select elements within elements with the class 'svg-item'
    let selects = document.querySelectorAll('.svg-item select');

    // Loop over each select element
    selects.forEach(select => {
        // Get the next sibling element of the select, which is assumed to be the arrow
        let arrow = select.nextElementSibling;

        // Initialize a flag to track whether the dropdown is open
        let isDropdownOpen = false;

        // When the select gets focus, add the 'open' class to the arrow and set the flag to true
        select.addEventListener('focus', () => {
            arrow.classList.add('open');
            isDropdownOpen = true;
        });

        // When the select loses focus, remove the 'open' class from the arrow and set the flag to false
        select.addEventListener('blur', () => {
            arrow.classList.remove('open');
            isDropdownOpen = false;
        });

        // When the select's value changes, remove the 'open' class from the arrow and unfocus the dropdown
        select.addEventListener('change', () => {
            arrow.classList.remove('open');
            select.blur();
        });

        // When the select is clicked while the dropdown is open, remove the 'open' class from the arrow, set the flag to false, and prevent the default action
        select.addEventListener('mousedown', (e) => {
            if (isDropdownOpen) {
                arrow.classList.remove('open');
                isDropdownOpen = false;
                e.preventDefault();
            }
        });
    });
});