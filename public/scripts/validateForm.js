// De// Define the validateForm function
function validateForm() {
    var username = document.getElementById('usernameInput').value; // Get username
    var checkboxes = document.querySelectorAll('#dataForm input[type="checkbox"]'); // Get checkboxes
    var isChecked = Array.from(checkboxes).some(checkbox => checkbox.checked); // Check if any checkbox is checked

    var color1 = document.getElementById('color1');
    var color2 = document.getElementById('color2');
    var color3 = document.getElementById('color3');
    var color4 = document.getElementById('color4');
    console.log(color1.value, color2.value, color3.value, color4.value);

    if (color1.value !== color1.defaultValue) document.getElementById('hiddenColor1').value = color1.value;
    if (color2.value !== color2.defaultValue) document.getElementById('hiddenColor2').value = color2.value;
    if (color3.value !== color3.defaultValue) document.getElementById('hiddenColor3').value = color3.value;
    if (color4.value !== color4.defaultValue) document.getElementById('hiddenColor4').value = color4.value;

    if (username && isChecked) { // If username is entered and a checkbox is checked
        fetchUserData(); // Call fetchUserData function
    } else {
        var message = 'Please '; // Initialize error message
        if (!username) message += 'enter a username'; // Add to error message if no username
        if (!isChecked) message += (!username ? ' and ' : '') + 'select at least one stat card type'; // Add to error message if no checkbox checked
        alert(message + '.'); // Show error message
    }
}