const body = document.querySelector('body');
const sidebar = document.querySelector('.sidebar');
const toggle = document.querySelector('.toggle');
const modeSwitch = document.querySelector('.toggle-switch');
const modeText = document.querySelector('.mode-text');

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