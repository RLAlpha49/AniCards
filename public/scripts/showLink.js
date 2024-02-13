/* eslint-disable no-unused-vars */
// Filename: public/scripts/showLink.js

// Get the modal and linkText elements
const modal = document.getElementById('linkModal')
const linkText = document.getElementById('linkText')

// Function to show the link in the modal
function showLink (link) {
  // Replace 'http' with 'https' in the link
  const secureLink = link.replace('http://', 'https://')
  // Set the text content of the linkText element to the secure link
  linkText.textContent = secureLink
  // Display the modal
  modal.style.display = 'block'
}

// Get the close button element
const span = document.getElementsByClassName('close')[0]

// Add an onclick event to the close button to hide the modal
span.onclick = function () {
  modal.style.display = 'none'
}

// Add an onclick event to the window to hide the modal if clicked outside of it
window.onclick = function (event) {
  if (event.target === modal) {
    modal.style.display = 'none'
  }
}

// Function to copy the link to the clipboard
function copyLink () {
  // Create a temporary input element
  const tempInput = document.createElement('input')
  // Set the value of the input to the link text
  tempInput.value = linkText.textContent
  // Add the input to the document
  document.body.appendChild(tempInput)
  // Select the input text
  tempInput.select()
  // Copy the selected text
  document.execCommand('copy')
  // Remove the temporary input from the document
  document.body.removeChild(tempInput)

  // Get the copyStatus element and change its text
  const copyStatus = document.getElementById('copyStatus')
  copyStatus.textContent = 'Link copied to clipboard'
  // Display the copyStatus element
  copyStatus.classList.remove('hide')

  // Hide the copyStatus element after 3 seconds
  setTimeout(function () {
    copyStatus.classList.add('hide')
  }, 3000)
}

// Get the close button and copyStatus elements
const closeButton = document.querySelector('.close')
const copyStatus = document.getElementById('copyStatus')

// Add a click event listener to the close button to hide the modal and clear the copyStatus text
closeButton.addEventListener('click', function () {
  modal.style.display = 'none'
  copyStatus.textContent = ''
  copyStatus.classList.remove('hide')
})

// Add a click event listener to the modal to hide it and clear the copyStatus text if clicked outside of it
modal.addEventListener('click', function (event) {
  if (event.target === modal) {
    modal.style.display = 'none'
    copyStatus.textContent = ''
    copyStatus.classList.remove('hide')
  }
})
