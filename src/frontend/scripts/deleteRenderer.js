const ipc = window.electronAPI;
const body = document.querySelector('body');
const sidebar = document.querySelector('.sidebar');
const toggle = document.querySelector('.toggle');
const modeSwitch = document.querySelector('.toggle-switch');
const modeText = document.querySelector('.mode-text');
const dropdownBtn = document.getElementById("dropdownBtn");
const dropdown = document.getElementById("myDropdown");
const selectFolderBtn = document.getElementById('selectFolderBtn');
const selectedPathSpan = document.getElementById('selectedPath');
const scanBtn = document.getElementById('scanBtn');
const fileListDiv = document.getElementById('fileList');
const deleteAllBtn = document.getElementById('deleteAllBtn');

let currentFolder = null;
let currentFiles = [];

// 🗂️ Select folder
selectFolderBtn.addEventListener('click', async () => {
  const folderPath = await ipc.openFolderDialog();
  if (folderPath) {
    currentFolder = folderPath;
    selectedPathSpan.textContent = folderPath;
    scanBtn.disabled = false;
  }
});

// 🔍 Scan for large files
scanBtn.addEventListener('click', async () => {
  if (!currentFolder) return;

  fileListDiv.innerHTML = `
    <div class="spinner">
      <div class="spinner-icon"></div>
      <div class="spinner-text">Scanning for large files...</div>
    </div>
  `;

  const files = await ipc.findLargeFiles(currentFolder);
  currentFiles = files;
  renderFileList(files);
  deleteAllBtn.disabled = files.length === 0;
});

// 🧹 Delete All
deleteAllBtn.addEventListener('click', async () => {
  if (currentFiles.length === 0) return;

  const confirmed = confirm(`Are you sure you want to delete ${currentFiles.length} files?`);
  if (!confirmed) return;

  // Send files via stdin as JSON
  const result = await ipc.deleteAllFiles(currentFiles);
  alert(result);
  fileListDiv.innerHTML = '';
  deleteAllBtn.disabled = true;
});


// 🧾 Render files
function renderFileList(files) {
  if (files.length === 0) {
    fileListDiv.innerHTML = '<p>No files over 100MB found.</p>';
    return;
  }

  const list = document.createElement('ul');
  files.forEach(file => {
    const item = document.createElement('li');
    item.innerHTML = `
      <div class="file-info">
        <i class="bi bi-file-earmark"></i>
        <span class="file-name">${file.path}</span>
      </div>
      <button class="delete-btn">
        <i class="bi bi-trash"></i> Delete (${file.size_mb} MB)
      </button>
    `;

    const delBtn = item.querySelector('.delete-btn');
    delBtn.onclick = async () => {
      const res = await ipc.deleteFile(file.path);
      alert(res);
      item.remove();
    };

    list.appendChild(item);
  });

  fileListDiv.innerHTML = '';
  fileListDiv.appendChild(list);
}


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

