// deleteRenderer.js - Fixed Version
const ipc = window.electronAPI;
const body = document.querySelector("body");
const sidebar = document.querySelector(".sidebar");
const toggle = document.querySelector(".toggle");
const modeSwitch = document.querySelector(".toggle-switch");
const modeText = document.querySelector(".mode-text");
const dropdownBtn = document.getElementById("dropdownBtn");
const dropdown = document.getElementById("myDropdown");
const selectFolderBtn = document.getElementById("selectFolderBtn");
const selectedPathSpan = document.getElementById("selectedPath");
const scanBtn = document.getElementById("scanBtn");
const scanBtnDuplicate = document.getElementById("scanBtnDuplicate"); // Added missing reference
const fileListDiv = document.getElementById("fileList");
const deleteAllBtn = document.getElementById("deleteAllBtn");

let currentFolder = null;
let currentFiles = [];
let isDuplicateMode = false; // Track which mode we're in

toggle.addEventListener("click", () => {
  sidebar.classList.toggle("close");
});

// Apply saved theme on page load
document.addEventListener("DOMContentLoaded", () => {
  const savedMode = localStorage.getItem("theme");

  if (savedMode === "dark") {
    body.classList.add("dark");
    if (modeText) modeText.innerText = "Light Mode";
  } else {
    body.classList.remove("dark");
    if (modeText) modeText.innerText = "Dark Mode";
  }
});

// Toggle theme + save preference
if (modeSwitch) {
  modeSwitch.addEventListener("click", () => {
    body.classList.toggle("dark");

    if (body.classList.contains("dark")) {
      if (modeText) modeText.innerText = "Light Mode";
      localStorage.setItem("theme", "dark");
    } else {
      if (modeText) modeText.innerText = "Dark Mode";
      localStorage.setItem("theme", "light");
    }
  });
}

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

// 🗂️ Select folder
selectFolderBtn.addEventListener("click", async () => {
  const folderPath = await ipc.openFolderDialog();
  if (folderPath) {
    currentFolder = folderPath;
    selectedPathSpan.textContent = folderPath;
    scanBtn.disabled = false;
    scanBtnDuplicate.disabled = false;
    fileListDiv.innerHTML = "";
  }
});

// 🔍 Scan for large files
scanBtn.addEventListener("click", async () => {
  if (!currentFolder) return;
  isDuplicateMode = false;

  fileListDiv.innerHTML = `
    <div class="spinner">
      <div class="spinner-icon"></div>
      <div class="spinner-text">Scanning for large files...</div>
    </div>
  `;

  try {
    const files = await ipc.findLargeFiles(currentFolder);
    currentFiles = files;
    renderFileList(files);
    deleteAllBtn.disabled = files.length === 0;
  } catch (error) {
    fileListDiv.innerHTML = `<p class="error">Error scanning files: ${error.message}</p>`;
    console.error("Scan error:", error);
  }
});

// 🧹 Delete All
deleteAllBtn.addEventListener("click", async () => {
  if (currentFiles.length === 0) return;

  const action = isDuplicateMode
    ? "delete all duplicates (keeping one file per group)"
    : `delete ${currentFiles.length} files`;

  const confirmed = confirm(`Are you sure you want to ${action}?`);
  if (!confirmed) return;

  try {
    let result;
    if (isDuplicateMode) {
      result = await ipc.deleteDuplicates(currentFolder);
      alert(`Deleted ${result.deleted.length} duplicate files`);
    } else {
      result = await ipc.deleteAllFiles(currentFiles);
      alert(result);
    }
    fileListDiv.innerHTML = "";
    deleteAllBtn.disabled = true;
  } catch (error) {
    alert(`Error during deletion: ${error.message}`);
    console.error("Deletion error:", error);
  }
});

// 🧾 Render files
function renderFileList(files) {
  if (files.length === 0) {
    fileListDiv.innerHTML = "<p>No files over 100MB found.</p>";
    return;
  }

  const list = document.createElement("ul");
  files.forEach((file) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <div class="file-info">
        <i class="bi bi-file-earmark"></i>
        <span class="file-name">${file.path}</span>
      </div>
      <button class="delete-btn">
        <i class="bi bi-trash"></i> Delete (${file.size_mb} MB)
      </button>
    `;

    const delBtn = item.querySelector(".delete-btn");
    delBtn.onclick = async () => {
      try {
        const res = await ipc.deleteFile(file.path);
        alert(res);
        item.remove();
        currentFiles = currentFiles.filter((f) => f.path !== file.path);
        deleteAllBtn.disabled = currentFiles.length === 0;
      } catch (error) {
        alert(`Error deleting file: ${error.message}`);
      }
    };

    list.appendChild(item);
  });

  fileListDiv.innerHTML = "";
  fileListDiv.appendChild(list);
}

// 🔍 Scan for duplicates
scanBtnDuplicate.addEventListener("click", async () => {
  if (!currentFolder) {
    alert("Please select a folder first.");
    return;
  }
  isDuplicateMode = true;

  fileListDiv.innerHTML = `
    <div class="spinner">
      <div class="spinner-icon"></div>
      <div class="spinner-text">Scanning for duplicate files...</div>
    </div>
  `;

  try {
    const result = await ipc.scanDuplicates(currentFolder);

    if (result.error) {
      throw new Error(result.error);
    }

    // Transform the grouped data for rendering
    const files = [];
    let groupId = 1;

    // Handle the new grouped response format
    for (const group of result.groups || []) {
      // Add the original file first
      files.push({
        path: group.original,
        group: groupId,
        isOriginal: true,
        hash: group.hash,
      });

      // Then add all duplicates
      group.duplicates.forEach((duplicatePath) => {
        files.push({
          path: duplicatePath,
          group: groupId,
          isOriginal: false,
          hash: group.hash,
        });
      });

      groupId++;
    }

    currentFiles = files;
    renderDuplicateList(files);
    deleteAllBtn.disabled = files.filter((f) => !f.isOriginal).length === 0;
  } catch (error) {
    fileListDiv.innerHTML = `
      <div class="error-message">
        <i class="bi bi-exclamation-triangle"></i>
        <p>Error scanning duplicates: ${error.message}</p>
      </div>
    `;
    console.error("Duplicate scan error:", error);
  }
});

// Render duplicate list
function renderDuplicateList(files) {
  if (files.length === 0) {
    fileListDiv.innerHTML = "<p>No duplicates found.</p>";
    return;
  }

  // Group files by their group ID
  const groupedFiles = {};
  files.forEach((file) => {
    if (!groupedFiles[file.group]) {
      groupedFiles[file.group] = [];
    }
    groupedFiles[file.group].push(file);
  });

  const list = document.createElement("div");
  list.className = "duplicate-groups";

  // Create a section for each group
  Object.entries(groupedFiles).forEach(([groupId, groupFiles]) => {
    const groupElement = document.createElement("div");
    groupElement.className = "duplicate-group";
    groupElement.innerHTML = `
      <h3 class="group-header">Duplicate Group ${groupId} (${groupFiles.length} files)</h3>
      <hr>
      <ul class="group-files"></ul>
    `;

    const filesList = groupElement.querySelector(".group-files");

    groupFiles.forEach((file) => {
      const item = document.createElement("li");
      item.className = file.isOriginal ? "original-file" : "duplicate-file";
      item.innerHTML = `
        <div class="file-info">
          <i class="bi ${
            file.isOriginal ? "bi-file-earmark-check" : "bi-file-earmark"
          }"></i>
          <span class="file-path">${file.path}</span>
          ${
            file.isOriginal
              ? '<span class="original-badge">Original</span>'
              : ""
          }
        </div>
        ${
          !file.isOriginal
            ? `
          <button class="delete-btn">
            <i class="bi bi-trash"></i> Delete
          </button>
        `
            : ""
        }
      `;

      if (!file.isOriginal) {
        const delBtn = item.querySelector(".delete-btn");
        delBtn.onclick = async () => {
          try {
            const res = await ipc.deleteFile(file.path);
            alert(res);
            item.remove();
            // Update currentFiles and button state
            currentFiles = currentFiles.filter((f) => f.path !== file.path);
            deleteAllBtn.disabled =
              currentFiles.filter((f) => !f.isOriginal).length === 0;
          } catch (error) {
            alert(`Error deleting file: ${error.message}`);
          }
        };
      }

      filesList.appendChild(item);
    });

    list.appendChild(groupElement);
  });

  fileListDiv.innerHTML = "";
  fileListDiv.appendChild(list);
}

deleteAllBtn.addEventListener("click", async () => {
  if (!currentFolder || currentFiles.length === 0) return;

  // Only count duplicate files (non-originals)
  const duplicateCount = currentFiles.filter((f) => !f.isOriginal).length;
  if (duplicateCount === 0) return;

  const confirmed = confirm(
    `Are you sure you want to delete ${duplicateCount} duplicate files?`
  );
  if (!confirmed) return;

  try {
    const result = await ipc.deleteDuplicates(currentFolder);

    if (result.error) {
      throw new Error(result.error);
    }

    // Show deletion results
    let message = `Deleted ${result.deleted.length} files.`;
    if (result.errors.length > 0) {
      message += ` ${result.errors.length} files could not be deleted.`;
    }

    alert(message);

    // Refresh the list
    fileListDiv.innerHTML = "";
    deleteAllBtn.disabled = true;
  } catch (error) {
    alert(`Error deleting duplicates: ${error.message}`);
  }
});
