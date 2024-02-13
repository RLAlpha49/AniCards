/* eslint-disable no-unused-vars */
// Filename: public/scripts/fetchUserData.js

// Function to fetch user data based on input
function fetchUserData () {
  // Get the username from the input field with id 'usernameInput'
  const username = document.getElementById('usernameInput').value

  // Get the form element with id 'dataForm'
  const form = document.getElementById('dataForm')
  // Set the action of the form to the correct URL, using the entered username
  form.action = '/StatCards/' + username + '/generate_svgs'

  // Submit the form, triggering the request to the server
  form.submit()
}
