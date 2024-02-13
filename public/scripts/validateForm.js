/* global fetchUserData */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
// Filename: public/scripts/validateForm.js

// Define the validateForm function
function validateForm () {
  // Get the username from the input field with id 'usernameInput'
  const username = document.getElementById('usernameInput').value

  // Get all the checkboxes in the form with id 'dataForm'
  const checkboxes = document.querySelectorAll(
    '#dataForm input[type="checkbox"]'
  )

  // Check if any checkbox is checked
  const isChecked = Array.from(checkboxes).some((checkbox) => checkbox.checked)

  // Get the color input elements
  const color1 = document.getElementById('color1')
  const color2 = document.getElementById('color2')
  const color3 = document.getElementById('color3')
  const color4 = document.getElementById('color4')

  // If the value of a color input has been changed, set the value of the corresponding hidden input to the new color
  if (color1.value !== color1.defaultValue) { document.getElementById('hiddenColor1').value = color1.value }
  if (color2.value !== color2.defaultValue) { document.getElementById('hiddenColor2').value = color2.value }
  if (color3.value !== color3.defaultValue) { document.getElementById('hiddenColor3').value = color3.value }
  if (color4.value !== color4.defaultValue) { document.getElementById('hiddenColor4').value = color4.value }

  // If a username has been entered and at least one checkbox is checked
  if (username && isChecked) {
    // Call the fetchUserData function
    fetchUserData()
  } else {
    // Initialize the error message
    let message = 'Please '

    // If no username has been entered, add to the error message
    if (!username) message += 'enter a username'

    // If no checkbox is checked, add to the error message
    if (!isChecked) {
      message +=
        (!username ? ' and ' : '') + 'select at least one stat card type'
    }

    // Show the error message
    alert(message + '.')
  }
}
