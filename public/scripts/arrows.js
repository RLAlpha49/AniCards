document.addEventListener('DOMContentLoaded', function() {
    let selects = document.querySelectorAll('.svg-item select');
    selects.forEach(select => {
        let arrow = select.nextElementSibling; // Assuming the arrow is the next sibling of the select
        let isDropdownOpen = false;

        select.addEventListener('focus', () => {
            arrow.classList.add('open');
            isDropdownOpen = true;
        });
        select.addEventListener('blur', () => {
            arrow.classList.remove('open');
            isDropdownOpen = false;
        });
        select.addEventListener('change', () => {
            arrow.classList.remove('open');
            select.blur(); // Unfocus the dropdown
        });
        select.addEventListener('mousedown', (e) => {
            if (isDropdownOpen) {
                arrow.classList.remove('open');
                isDropdownOpen = false;
                e.preventDefault();
            }
        });
    });
});