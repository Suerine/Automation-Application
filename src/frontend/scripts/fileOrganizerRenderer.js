const body = document.querySelector("body");
const sidebar = document.querySelector(".sidebar");
const toggle = document.querySelector(".toggle");
const modeSwitch = document.querySelector(".toggle-switch");
const modeText = document.querySelector(".mode-text");
const dropdownBtn = document.getElementById("dropdownBtn");
const dropdown = document.getElementById("myDropdown");

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

document.getElementById("run").addEventListener("click", async () => {
  const mode = document.getElementById("mode").value;
  const payload = {
    mode: mode,
    params: {},
    base_path: document.getElementById("base").value || ".",
    auto_confirm: true, // run without interactive prompt
  };

  if (mode === "1")
    payload.params.keyword = document.getElementById("keyword").value;
  if (mode === "2") payload.params.date = document.getElementById("date").value;
  if (mode === "3") payload.params.ext = document.getElementById("ext").value;
  if (mode === "4") {
    payload.params.ext = document.getElementById("ext").value;
    payload.params.date = document.getElementById("date").value;
  }
  if (document.getElementById("dest").value)
    payload.params.dest = document.getElementById("dest").value;

  const out = document.getElementById("output");
  out.textContent = "Running...";

  try {
    const result = await window.deskflow.runOrganizer(payload);
    out.textContent = JSON.stringify(result, null, 2);
  } catch (err) {
    out.textContent = "Error: " + JSON.stringify(err, null, 2);
  }
});
