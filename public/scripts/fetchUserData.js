// Filename: public/scripts/fetchUserData.js

// Function to fetch user data based on input
function fetchUserData() {
    // Get the username from the input field
    const username = document.getElementById('usernameInput').value;

    // Set the action of the form to the correct URL
    const form = document.getElementById('dataForm');
    form.action = '/AniCards/StatCards/' + username + '/generate_svgs';

    // Submit the form
    form.submit();
}