/* exported copyLink */
/* eslint-disable no-unused-vars */
// Filename: public/scripts/showLink.js

// Get the modal, linkText, and exampleUsage elements
const modal = document.getElementById('linkModal')
const linkText = document.getElementById('linkText')
const exampleUsage = document.getElementById('exampleUsage')

// Get the close button element
const closeButton = document.querySelector('.close')

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
  // Get the text to copy
  const textToCopy = isExample ? elementToCopy.textContent.replace('Anilist Example: ', '') : elementToCopy.textContent

  // Copy the text to the clipboard
  navigator.clipboard.writeText(textToCopy).then(function () {
    // Get the copyStatus element and change its text
    const copyStatus = document.getElementById('copyStatus')
    copyStatus.textContent = 'Link copied to clipboard'
    // Display the copyStatus element
    copyStatus.classList.remove('hide')

    // Hide the copyStatus element after 3 seconds
    setTimeout(function () {
      copyStatus.classList.add('hide')
    }, 3000)
  }, function (err) {
    console.error('Could not copy text: ', err)
  })
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

// Add click event listener to the close button to close the modal
closeButton.addEventListener('click', function () {
  modal.style.display = 'none'
})
