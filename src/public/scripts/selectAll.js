/* eslint-disable no-unused-vars */
// Filename: public/scripts/selectAll.js

// Function to select all checkboxes in a form
function selectAllCheckboxes () {
  // Get all the checkboxes in the form with id 'dataForm'
  // querySelectorAll returns a NodeList of all matching elements
  const checkboxes = document
    .getElementById('dataForm')
    .querySelectorAll('input[type=checkbox]')

  // Loop over each checkbox in the NodeList
  for (let i = 0; i < checkboxes.length; i++) {
    // Set the checked property of the current checkbox to true
    // This effectively checks the checkbox
    checkboxes[i].checked = true
  }
}
