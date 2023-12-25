// Add a JavaScript function to select all checkboxes
function selectAllCheckboxes() {
    // Get all the checkboxes in the form
    var checkboxes = document.getElementById('dataForm').querySelectorAll('input[type=checkbox]');

    // Set the checked property of each checkbox to true
    for (var i = 0; i < checkboxes.length; i++) {
        checkboxes[i].checked = true;
    }
}