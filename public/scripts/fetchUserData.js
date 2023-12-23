// Filename: public/scripts/fetchUserData.js

// Function to fetch user data based on input
function fetchUserData() {
    // Get the username from the input field
    const username = document.getElementById('usernameInput').value;
    
    // Redirect the user to the URL associated with the username
    window.location.href = '/' + username;
}