// De// Define the validateForm function
function validateForm() {
    var username = document.getElementById('usernameInput').value; // Get username
    var checkboxes = document.querySelectorAll('#dataForm input[type="checkbox"]'); // Get checkboxes
    var isChecked = Array.from(checkboxes).some(checkbox => checkbox.checked); // Check if any checkbox is checked

    if (username && isChecked) { // If username is entered and a checkbox is checked
        fetchUserData(); // Call fetchUserData function
    } else {
        var message = 'Please '; // Initialize error message
        if (!username) message += 'enter a username'; // Add to error message if no username
        if (!isChecked) message += (!username ? ' and ' : '') + 'select at least one stat card type'; // Add to error message if no checkbox checked
        alert(message + '.'); // Show error message
    }
}