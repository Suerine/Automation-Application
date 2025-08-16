const body = document.querySelector("body");
const sidebar = document.querySelector(".sidebar");
const toggle = document.querySelector(".toggle");
const modeSwitch = document.querySelector(".toggle-switch");
const modeText = document.querySelector(".mode-text");
const dropdownBtn = document.getElementById("dropdownBtn");
const dropdown = document.getElementById("myDropdown");
const el = (sel) => document.querySelector(sel);
const profilesBox = el("#profiles");
const productInput = el("#productInput");
const researchInput = el("#researchInput");
const productBtn = el("#productBtn");
const researchBtn = el("#researchBtn");
const productResults = el("#productResults");
const researchResults = el("#researchResults");
const autoOpenProfiles = el("#autoOpenProfiles");
const autoOpenProduct = el("#autoOpenProduct");
const autoOpenResearch = el("#autoOpenResearch");
const ipc = window.electronAPI;

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

function escapeHtml(s) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c])
  );
}

async function loadProfiles() {
  const profiles = await window.electronAPI.getProfiles();
  profilesBox.innerHTML = "";

  // Helper function to generate consistent color from profile name
  const getColorFromName = (name) => {
    // Simple hash function to convert name to hue value (0-360)
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`; // Vibrant color
  };

  Object.entries(profiles).forEach(([name, urls]) => {
    const btn = document.createElement("button");
    btn.style.width = "100px";
    btn.style.cursor = "pointer";
    btn.textContent = `${name}`;

    // Set unique color based on profile name
    btn.style.backgroundColor = getColorFromName(name);
    btn.style.color = "white"; // White text for better contrast
    btn.style.border = "none";
    btn.style.borderRadius = "4px";
    btn.style.padding = "8px 12px";
    btn.style.margin = "4px 0";
    btn.style.transition = "all 0.2s";

    // Hover effect
    btn.addEventListener("mouseenter", () => {
      btn.style.filter = "brightness(90%)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.filter = "brightness(100%)";
    });

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Launching...";
      btn.style.opacity = "0.8";
      try {
        await window.electronAPI.launchProfile(name, autoOpenProfiles.checked);
      } finally {
        btn.disabled = false;
        btn.textContent = `${name}`;
        btn.style.opacity = "1";
      }
    });

    const list = document.createElement("div");
    list.className = "muted";
    list.innerHTML = `
      <div class="dropdown">
        <button class="dropdown-toggle">Links</button>
        <ul class="dropdown-menu">
          ${urls.map((u) => `<li>${escapeHtml(u)}</li>`).join("")}
        </ul>
      </div>
    `;

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.alignItems = "center";
    wrap.style.marginBottom = "8px";
    wrap.appendChild(btn);
    wrap.appendChild(list);
    profilesBox.appendChild(wrap);
  });
}

productBtn.addEventListener("click", async () => {
  const q = productInput.value.trim();
  productResults.innerHTML = "";
  if (!q) return;
  const res = await window.electronAPI.searchProduct(
    q,
    autoOpenProduct.checked
  );
  if (!res.ok) {
    productResults.textContent = res.error || "Something went wrong.";
    return;
  }

  // const { jumia, meta } = res;

  // if (jumia?.length) {
  //   productResults.insertAdjacentHTML(
  //     "beforeend",
  //     `<div class="result"><b>Jumia (Top ${jumia.length})</b><br>${jumia
  //       .map(
  //         (i) => `
  //     <div style="margin:6px 0;">
  //       <div>${escapeHtml(i.title)} <span class="chip">${escapeHtml(
  //           i.price
  //         )}</span></div>
  //       <div><a href="${i.link}" target="_blank">${i.link}</a></div>
  //     </div>
  //   `
  //       )
  //       .join("")}</div>`
  //   );
  // } else {
  //   productResults.insertAdjacentHTML(
  //     "beforeend",
  //     `<div class="result">No Jumia results found.</div>`
  //   );
  // }

  // productResults.insertAdjacentHTML(
  //   "beforeend",
  //   `<div class="result">
  //   <b>Meta Searches</b>
  //   <ul class="list">
  //     <li><a target="_blank" href="${meta.amazon}">Amazon</a></li>
  //     <li><a target="_blank" href="${meta.aliexpress}">AliExpress</a></li>
  //     <li><a target="_blank" href="${meta.ebay}">eBay</a></li>
  //   </ul>
  // </div>`
  // );
});

researchBtn.addEventListener("click", async () => {
  const t = researchInput.value.trim();
  researchResults.innerHTML = "";
  if (!t) return;
  const res = await window.electronAPI.searchResearch(
    t,
    autoOpenResearch.checked
  );
  if (!res.ok) {
    researchResults.textContent = res.error || "Something went wrong.";
    return;
  }
  const s = res.sources;
  // researchResults.insertAdjacentHTML(
  //   "beforeend",
  //   `<div class="result">
  //   <b>Sources</b>
  //   <ul class="list">
  //     <li><a target="_blank" href="${s.scholar}">Google Scholar</a></li>
  //     <li><a target="_blank" href="${s.wikipedia}">Wikipedia</a></li>
  //     <li><a target="_blank" href="${s.news}">Google News</a></li>
  //     <li><a target="_blank" href="${s.youtube}">YouTube</a></li>
  //     <li><a target="_blank" href="${s.twitter}">Twitter / X</a></li>
  //   </ul>
  // </div>`
  // );
});

loadProfiles();
