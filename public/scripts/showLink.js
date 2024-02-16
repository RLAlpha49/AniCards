/* exported copyLink */
/* eslint-disable no-unused-vars */
// Filename: public/scripts/showLink.js

// Get the modal, linkText, and exampleUsage elements
const modal = document.getElementById('linkModal')
const linkText = document.getElementById('linkText')
const exampleUsage = document.getElementById('exampleUsage')

// Function to show the link in the modal
function showLink (link) {
  // Replace 'http' with 'https' in the link
  const secureLink = link.replace('http://', 'https://')
  // Set the text content of the linkText element to the secure link
  linkText.textContent = secureLink
  // Display the modal
  modal.style.display = 'block'
  // Set the text content of the example usage element to an example of how to use the link in an Anilist bio
  exampleUsage.textContent = `Anilist Example: img150("${secureLink}")`
}

// Function to copy the link or example to the clipboard
function copyLink (elementToCopy, isExample = false) {
  // Create a temporary input element
  const tempInput = document.createElement('input')
  // Set the value of the input to the link text or example
  tempInput.value = isExample ? elementToCopy.textContent.replace('Anilist Example: ', '') : elementToCopy.textContent
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

// Get the copy button elements
const copyLinkButton = document.getElementById('copyLinkButton')
const copyExampleButton = document.getElementById('copyExampleButton')

// Add click event listeners to the copy buttons to copy the link or example
copyLinkButton.addEventListener('click', function () {
  copyLink(linkText)
})
copyExampleButton.addEventListener('click', function () {
  copyLink(exampleUsage, true)
})