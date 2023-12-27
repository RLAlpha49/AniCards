document.addEventListener('DOMContentLoaded', function() {
    let selects = document.querySelectorAll('.svg-item select');
    selects.forEach(select => {
        select.addEventListener('click', () => {
            select.focus();
        });
    });
});