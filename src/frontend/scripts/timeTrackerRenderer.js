// timeTrackerRenderer.js (final merged)
// Per-task timers, resume-from-db, autosave, and AFK handling.

const body = document.querySelector("body");
const sidebar = document.querySelector(".sidebar");
const toggle = document.querySelector(".toggle");
const modeSwitch = document.querySelector(".toggle-switch");
const modeText = document.querySelector(".mode-text");
const dropdownBtn = document.getElementById("dropdownBtn");
const dropdown = document.getElementById("myDropdown");
const tasksContainer = document.getElementById("tasks");
const completeTasksContainer = document.getElementById("complete-tasks");
const afkLimit = 20; // seconds before showing AFK prompt

console.log("📦 timeTrackerRenderer.js loaded (updated)");

/* -------------------------
   small UI helpers
   ------------------------- */
toggle?.addEventListener("click", () => sidebar?.classList.toggle("close"));

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
  dropdownBtn?.addEventListener("click", function (event) {
    dropdown.classList.toggle("show");
    event.stopPropagation();
  });
  window.addEventListener("click", function () {
    if (dropdown.classList.contains("show")) dropdown.classList.remove("show");
  });
});

/* -------------------------
   time helpers
   ------------------------- */
function formatTime(s) {
  const hrs = String(Math.floor(s / 3600)).padStart(2, "0");
  const mins = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const secs = String(s % 60).padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
}
function parseTimeToSeconds(str = "00:00:00") {
  const [h = 0, m = 0, s = 0] = str.split(":").map((n) => Number(n || 0));
  return h * 3600 + m * 60 + s;
}

/* -------------------------
   DB Logging Helper
   ------------------------- */
async function logFullDBState(currentTaskId = null) {
  try {
    const allTasks = await window.electronAPI.getTasks();
    if (allTasks?.success && Array.isArray(allTasks.tasks)) {
      console.log("📋 Current DB State:");
      const tableData = allTasks.tasks.map((task) => ({
        ...task,
        running:
          Number(task.task_id ?? task.id) === Number(currentTaskId)
            ? "▶️ RUNNING"
            : "",
      }));
      console.table(tableData);
    } else {
      console.warn("⚠️ Could not fetch all tasks:", allTasks?.error);
    }
  } catch (err) {
    console.error("❌ Failed to fetch tasks:", err);
  }
}

/* -------------------------
   create task element & load saved
   ------------------------- */
function createTaskElement(taskInput = "A new task", savedData = null) {
  const taskText = typeof taskInput === "string" ? taskInput : taskInput.name;
  const fullDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const wrapper = document.createElement("div");
  wrapper.classList.add("task-wrapper");

  const dateContainer = document.createElement("div");
  dateContainer.classList.add("date-container");
  dateContainer.innerHTML = `
    <div class="date">${fullDate}</div>
    <div class="due">
      <label>Start date:</label>
      <input type="date" class="start-date" value="" min="2025-01-01" max="2027-12-31" />
      <label>Stop date:</label>
      <input type="date" class="stop-date" value="" min="2025-01-01" max="2027-12-31" />
    </div>
  `;

  const task = document.createElement("div");
  task.classList.add("task");
  task.innerHTML = `
    <div class="content">
      <input type="text" class="task-text" value="${taskText}" readonly />
    </div>
    <div class="counter">
      <div class="time">00:00:00</div>
      <div class="controls">
        <button class="start"><i class="bi bi-play-fill icon"></i></button>
        <button class="pause"><i class="bi bi-pause-fill icon"></i></button>
        <button class="stop"><i class="bi bi-stop-fill icon"></i></button>
        <button class="reset">Reset</button>
      </div>
    </div>
    <div class="actions">
      <button class="done">Done</button>
      <button class="edit">Edit</button>
      <button class="delete">Delete</button>
    </div>
  `;

  wrapper.appendChild(dateContainer);
  wrapper.appendChild(task);

  // set values from savedData
  if (savedData) {
    const taskInputEl = wrapper.querySelector(".task-text");
    const timeDisplay = wrapper.querySelector(".time");
    const startDateInput = wrapper.querySelector(".start-date");
    const stopDateInput = wrapper.querySelector(".stop-date");

    if (taskInputEl) {
      taskInputEl.value = savedData.name || taskText;
      taskInputEl.readOnly = true;
      taskInputEl.style.textDecoration = savedData.task_status
        ? "line-through"
        : "none";
    }
    if (timeDisplay)
      timeDisplay.textContent = savedData.duration_time || "00:00:00";
    if (startDateInput)
      startDateInput.value =
        savedData.start_date || new Date().toISOString().split("T")[0];
    if (stopDateInput)
      stopDateInput.value =
        savedData.stop_date || new Date().toISOString().split("T")[0];

    const idVal = savedData.task_id ?? savedData.id;
    if (idVal) wrapper.setAttribute("data-id", idVal);
  } else {
    const today = new Date().toISOString().split("T")[0];
    dateContainer.querySelector(".start-date").value = today;
    dateContainer.querySelector(".stop-date").value = today;
  }

  attachTaskEventListeners(task, wrapper, savedData);
  wrapper.setAttribute("draggable", "true");
  addDragEvents(wrapper);

  return wrapper;
}

async function loadSavedTasks() {
  try {
    const response = await window.electronAPI.getTasks();
    if (response.success && Array.isArray(response.tasks)) {
      const container = document.getElementById("tasks");
      response.tasks.forEach((task) => {
        const taskEl = createTaskElement(task, task);
        container.prepend(taskEl);
      });
    } else {
      console.error("⚠️ Failed to load tasks:", response?.error);
    }
  } catch (err) {
    console.error("❌ Renderer Error loading tasks:", err);
  }
}
window.addEventListener("DOMContentLoaded", loadSavedTasks);

/* -------------------------
   Drag helpers
   ------------------------- */
function addDragEvents(taskEl) {
  taskEl.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", e.target.innerText);
    e.target.classList.add("dragging");
  });
  taskEl.addEventListener("dragend", (e) => {
    e.target.classList.remove("dragging");
  });
}
[tasksContainer, completeTasksContainer].forEach((container) => {
  container?.addEventListener("dragover", (e) => {
    e.preventDefault();
    container.classList.add("drag-over");
  });
  container?.addEventListener("dragleave", () =>
    container.classList.remove("drag-over")
  );
  container?.addEventListener("drop", (e) => {
    e.preventDefault();
    container.classList.remove("drag-over");
    const draggingEl = document.querySelector(".dragging");
    if (draggingEl) container.appendChild(draggingEl);
  });
});

/* -------------------------
   Single-running-task manager
   ------------------------- */
let currentRunningWrapper = null;

/* -------------------------
   AFK notification for current running task
   ------------------------- */
function resetAfkForWrapper(wrapper) {
  if (!wrapper) return;
  wrapper._notificationSent = false;
  wrapper._isUserIdle = false;
  if (wrapper._idleCheckTimeout) {
    clearTimeout(wrapper._idleCheckTimeout);
    wrapper._idleCheckTimeout = null;
  }
  // hide any UI AFK prompt if you have one
  const afkPrompt = document.getElementById("afkPrompt");
  if (afkPrompt) afkPrompt.style.display = "none";
}

function showNativeAfkNotificationForCurrent() {
  const wrapper = currentRunningWrapper;
  if (!wrapper || wrapper._notificationSent) return;

  wrapper._notificationSent = true;
  const notification = new Notification("Are you still working?", {
    body: "Click to continue; otherwise the app will mark you idle.",
    silent: false,
  });

  let userResponded = false;
  notification.onclick = () => {
    window.focus();
    userResponded = true;
    wrapper._isUserIdle = false;
    resetAfkForWrapper(wrapper);
    console.log("User clicked AFK notification -> continue");
  };

  // if no response after 60s, mark as idle (but we DO NOT stop the timer)
  wrapper._idleCheckTimeout = setTimeout(() => {
    if (!userResponded) {
      wrapper._isUserIdle = true;
      console.log("No AFK response, marking current task idle");
    }
  }, 10000);
}

/* global idle events from main process (via preload) */
if (window.electronAPI && window.electronAPI.onIdleTime) {
  window.electronAPI.onIdleTime((idleTime) => {
    // only relevant when a task is running
    if (!currentRunningWrapper) return;

    // if device idle crosses threshold -> show notification
    if (idleTime >= afkLimit && !currentRunningWrapper._notificationSent) {
      showNativeAfkNotificationForCurrent();
    }

    // if user comes back (idleTime small) reset the AFK state
    if (idleTime < 3 && currentRunningWrapper._notificationSent) {
      resetAfkForWrapper(currentRunningWrapper);
    }
  });
}

/* Ask for notification permission up-front */
if (Notification.permission !== "granted") Notification.requestPermission();

/* -------------------------
   attachTaskEventListeners (per-task logic)
   ------------------------- */
function attachTaskEventListeners(taskEl, wrapperEl, savedData) {
  // query elements
  const timeDisplay = taskEl.querySelector(".time");
  const startBtn = taskEl.querySelector(".start");
  const pauseBtn = taskEl.querySelector(".pause");
  const stopBtn = taskEl.querySelector(".stop");
  const resetBtn = taskEl.querySelector(".reset");
  const editBtn = taskEl.querySelector(".edit");
  const deleteBtn = taskEl.querySelector(".delete");
  const doneBtn = taskEl.querySelector(".done");
  const taskInput = taskEl.querySelector(".task-text");
  const startDateInput = wrapperEl.querySelector(".start-date");
  const stopDateInput = wrapperEl.querySelector(".stop-date");

  // Basic guard
  if (!timeDisplay || !startBtn || !pauseBtn) {
    console.error(
      "Missing critical elements for a task. Aborting listener attach."
    );
    return;
  }

  // Per-task state
  let seconds = 0;
  let idleSeconds = 0;
  let localInterval = null;
  let promptInterval = null;
  let autosaveInterval = null;

  // restore saved data if present
  if (savedData?.duration_time)
    seconds = parseTimeToSeconds(savedData.duration_time);
  if (savedData?.idle_time)
    idleSeconds = parseTimeToSeconds(savedData.idle_time);
  if (timeDisplay) timeDisplay.textContent = formatTime(seconds);

  // helper to update DB
  async function saveTaskStateToDB() {
    const taskId = wrapperEl.getAttribute("data-id");
    if (!taskId) return;

    const taskData = {
      task_id: Number(taskId),
      name: taskInput.value.trim(),
      current_date: new Date().toISOString().split("T")[0],
      start_date:
        startDateInput?.value || new Date().toISOString().split("T")[0],
      stop_date: stopDateInput?.value || new Date().toISOString().split("T")[0],
      duration_time: formatTime(seconds),
      idle_time: formatTime(idleSeconds),
      task_status: taskInput.style.textDecoration === "line-through",
    };

    console.log("💾 Saving to DB:", taskData);

    try {
      const res = await window.electronAPI.updateTask(taskData);
      if (!res?.success) {
        console.warn("Autosave returned error:", res?.error);
        return;
      }
      console.log("✅ DB save result:", res);

      // Fetch & log all tasks, with highlight for current task
      const allTasks = await window.electronAPI.getTasks();
      if (allTasks?.success && Array.isArray(allTasks.tasks)) {
        console.log("📋 Current DB State:");

        const tableData = allTasks.tasks.map((task) => {
          return {
            ...task,
            running:
              Number(task.task_id ?? task.id) === Number(taskId)
                ? "▶️ RUNNING"
                : "",
          };
        });

        console.table(tableData);
      } else {
        console.warn("⚠️ Could not fetch all tasks:", allTasks?.error);
      }
    } catch (err) {
      console.error("❌ Autosave failed:", err);
    }
  }

  // expose a pause method on wrapper so manager can pause it
  wrapperEl._pauseTask = async function pauseLocalTask() {
    // stop timers
    if (localInterval) {
      clearInterval(localInterval);
      localInterval = null;
    }
    if (promptInterval) {
      clearInterval(promptInterval);
      promptInterval = null;
    }
    if (autosaveInterval) {
      clearInterval(autosaveInterval);
      autosaveInterval = null;
    }

    // mark not-running
    wrapperEl.classList.remove("running");
    if (currentRunningWrapper === wrapperEl) currentRunningWrapper = null;

    // stop AFK tracking for this wrapper
    resetAfkForWrapper(wrapperEl);

    // persist final state
    await saveTaskStateToDB();
  };

  wrapperEl._startTask = function startLocalTask() {
    // If someone else running, pause them
    if (
      currentRunningWrapper &&
      currentRunningWrapper !== wrapperEl &&
      currentRunningWrapper._pauseTask
    ) {
      currentRunningWrapper._pauseTask();
    }

    // already running?
    if (localInterval) return;

    // begin ticking
    localInterval = setInterval(() => {
      seconds++;
      if (wrapperEl._isUserIdle) idleSeconds++;
      timeDisplay.textContent = formatTime(seconds);
    }, 1000);

    // autosave every 5s (keeps DB writes reasonable)
    autosaveInterval = setInterval(saveTaskStateToDB, 5000);

    // AFK prompt manager: reuse global idle events & notification
    currentRunningWrapper = wrapperEl;
    wrapperEl._notificationSent = false;
    wrapperEl._isUserIdle = false;

    wrapperEl.classList.add("running");
  };

  // start button
  startBtn?.addEventListener("click", () => {
    wrapperEl._startTask();
  });

  // pause button
  pauseBtn?.addEventListener("click", async () => {
    await wrapperEl._pauseTask();
    await logFullDBState(wrapperEl.getAttribute("data-id")); // <—
    showToast("Task paused and saved");
  });

  // stop button -> pause + reset counts
  stopBtn?.addEventListener("click", async () => {
    await wrapperEl._pauseTask();
    seconds = 0;
    idleSeconds = 0;
    timeDisplay.textContent = "00:00:00";
    await saveTaskStateToDB();
    await logFullDBState(wrapperEl.getAttribute("data-id")); // <—
  });

  // reset button -> local reset, not necessarily saved
  resetBtn?.addEventListener("click", () => {
    seconds = 0;
    idleSeconds = 0;
    timeDisplay.textContent = "00:00:00";
  });

  // edit/save name
  editBtn?.addEventListener("click", async () => {
    if (taskInput.readOnly) {
      taskInput.readOnly = false;
      taskInput.focus();
      editBtn.textContent = "Save";
    } else {
      const taskId = wrapperEl.getAttribute("data-id");
      const newName = taskInput.value.trim();
      if (!newName) {
        showToast("Task name required", "error");
        return;
      }
      try {
        if (taskId) {
          const result = await window.electronAPI.updateTask({
            task_id: Number(taskId),
            name: newName,
            current_date: new Date().toISOString().split("T")[0],
            start_date:
              startDateInput?.value || new Date().toISOString().split("T")[0],
            stop_date:
              stopDateInput?.value || new Date().toISOString().split("T")[0],
            duration_time: formatTime(seconds),
            idle_time: formatTime(idleSeconds),
            task_status: taskInput.style.textDecoration === "line-through",
          });
          if (!result?.success)
            throw new Error(result?.error || "updateTask failed");
        }
        taskInput.readOnly = true;
        editBtn.textContent = "Edit";
        showToast("Task updated");
      } catch (err) {
        console.error("Update failed:", err);
        showToast("Update failed", "error");
      }
    }
  });

  // delete
  deleteBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const taskId = wrapperEl.getAttribute("data-id");
    if (taskId) {
      // show modal or just delete
      window.electronAPI
        .deleteTask(Number(taskId))
        .then((res) => {
          if (res?.success) {
            wrapperEl.remove();
            showToast("Task Deleted");
          } else showToast("Failed to delete", "error");
        })
        .catch((err) => {
          console.error("Delete failed:", err);
          showToast("Delete failed", "error");
        });
    } else {
      wrapperEl.remove();
    }
  });

  // done
  doneBtn?.addEventListener("click", async () => {
    taskInput.style.textDecoration = "line-through";
    await saveTaskStateToDB();
    await wrapperEl._pauseTask();
    await logFullDBState(wrapperEl.getAttribute("data-id"));

    const duration = timeDisplay.textContent || "00:00:00";
    const idle = formatTime(idleSeconds || 0);
    const taskName = taskInput.value;
    const startDate = startDateInput?.value || "";
    const stopDate = stopDateInput?.value || "";
    const today = new Date().toISOString().split("T")[0];

    // Toast + system notification
    showToast(`Task "${taskName}" marked done`);
    if (Notification.permission === "granted") {
      new Notification("✅ Task Completed", {
        body: `Task: ${taskName}\nActive Time: ${duration}\nIdle Time: ${idle}`,
      });
    }

    // 📤 Send data to main process for CSV logging
    window.electronAPI.exportToCSV({
      date: today,
      task: taskName,
      start_date: startDate,
      stop_date: stopDate,
      active_time: duration,
      idle_time: idle,
      status: "Done",
    });
  });

  // date changes -> save dates + current times
  [startDateInput, stopDateInput].forEach((input) => {
    input?.addEventListener("change", async () => {
      await saveTaskStateToDB();
      showToast("Dates updated");
    });
  });
}

/* -------------------------
   beforeunload: save all running tasks
   ------------------------- */
window.addEventListener("beforeunload", () => {
  document.querySelectorAll(".task-wrapper").forEach((wrapper) => {
    if (wrapper._pauseTask) {
      try {
        // pause synchronously; DB calls are async in renderer, but call to pause will at least clear intervals
        wrapper._pauseTask();
      } catch (err) {
        console.warn("Error while pausing task during unload:", err);
      }
    }
  });
});

/* -------------------------
   small toast helper
   ------------------------- */
function showToast(message, type = "success") {
  // Create toast container if not exists
  let toastContainer = document.querySelector(".toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  // Auto remove after 3s
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

document.getElementById("task-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const taskInputEl = document.getElementById("task-input");
  if (!taskInputEl) {
    console.warn("Task input not found");
    return;
  }

  const name = taskInputEl.value.trim();
  if (!name) {
    showToast("Please enter a task name", "error");
    taskInputEl.focus();
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const taskData = {
    name,
    current_date: today,
    start_date: today,
    stop_date: today,
    duration_time: "00:00:00",
    idle_time: "00:00:00",
    task_status: false,
  };

  console.log("🆕 Creating task:", taskData);

  try {
    const result = await window.electronAPI.saveTask(taskData);
    console.log("saveTask result:", result);

    let savedTask = null;
    if (result?.task && typeof result.task === "object") {
      savedTask = { ...taskData, ...result.task };
    } else if (result?.id || result?.task_id) {
      savedTask = { ...taskData, task_id: result.id ?? result.task_id };
    } else if (result?.success && result?.task) {
      savedTask = { ...taskData, ...result.task };
    } else if (result?.success && (result?.id || result?.task_id)) {
      savedTask = { ...taskData, task_id: result.id ?? result.task_id };
    } else {
      savedTask = { ...taskData };
    }

    if (!savedTask.duration_time) savedTask.duration_time = "00:00:00";
    if (!savedTask.idle_time) savedTask.idle_time = "00:00:00";
    if (!savedTask.start_date) savedTask.start_date = today;
    if (!savedTask.stop_date) savedTask.stop_date = today;

    const newTaskEl = createTaskElement(savedTask.name || name, savedTask);
    const tasksContainerEl = document.getElementById("tasks");
    if (tasksContainerEl) {
      tasksContainerEl.prepend(newTaskEl);
    }

    taskInputEl.value = "";
    taskInputEl.focus();

    showToast("Task added");
    const currentId = savedTask.task_id ?? savedTask.id ?? null;
    await logFullDBState(currentId);
  } catch (err) {
    console.error("❌ Failed to save new task:", err);
    showToast("Failed to save task", "error");
  }
});
