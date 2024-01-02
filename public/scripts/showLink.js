var modal = document.getElementById("linkModal");
var linkText = document.getElementById("linkText");

function showLink(link) {
    linkText.textContent = link;
    modal.style.display = "block";
}

var span = document.getElementsByClassName("close")[0];

span.onclick = function() {
    modal.style.display = "none";
}

window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

function copyLink() {
    var tempInput = document.createElement("input");
    tempInput.value = linkText.textContent;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);

    // Get the copyStatus element and change its text
    var copyStatus = document.getElementById("copyStatus");
    copyStatus.textContent = "Link copied to clipboard";
    copyStatus.classList.remove("hide");

    // Clear the message after 3 seconds
    setTimeout(function() {
        copyStatus.classList.add("hide");
    }, 3000);
}

// Get the modal, close button, and copyStatus elements
var modal = document.getElementById("linkModal");
var closeButton = document.querySelector(".close");
var copyStatus = document.getElementById("copyStatus");

// Add an event listener to the close button
closeButton.addEventListener("click", function() {
    modal.style.display = "none";
    copyStatus.textContent = "";
    copyStatus.classList.remove("hide");
});

// Add an event listener to the modal background
modal.addEventListener("click", function(event) {
    if (event.target === modal) {
        modal.style.display = "none";
        copyStatus.textContent = "";
        copyStatus.classList.remove("hide");
    }
});