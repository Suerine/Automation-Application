const body = document.querySelector('body');
const sidebar = document.querySelector('.sidebar');
const toggle = document.querySelector('.toggle');
const modeSwitch = document.querySelector('.toggle-switch');
const modeText = document.querySelector('.mode-text');
const dropdownBtn = document.getElementById("dropdownBtn");
const dropdown = document.getElementById("myDropdown");

toggle.addEventListener('click', () => {
 sidebar.classList.toggle('close');
}); 

modeSwitch.addEventListener('click', () => {
 body.classList.toggle('dark');

 if(body.classList.contains('dark')){
   modeText.innerText = 'Light Mode';
 }
 else{
   modeText.innerText = 'Dark Mode';
 }
}); 


document.addEventListener("DOMContentLoaded", function () {
  dropdownBtn.addEventListener("click", function (event) {
    dropdown.classList.toggle("show");
    event.stopPropagation(); // Prevent it from triggering the window click
  });
  // Close the dropdown if the user clicks outside
  window.addEventListener("click", function () {
    if (dropdown.classList.contains("show")) {
      dropdown.classList.remove("show");
    }
  });
});

