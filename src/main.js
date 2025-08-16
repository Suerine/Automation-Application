const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  powerMonitor,
  shell,
} = require("electron");
const path = require("path");
const db = require("./database");
const { spawn } = require("child_process");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
let idleInterval = null;
const isDev = !app.isPackaged;

const createWindow = () => {
  if (process.platform === "darwin") {
    app.dock.setIcon(
      path.join(__dirname, "frontend/images/DeskFlow-Logo2.png")
    );
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "frontend", "pages", "timetracker.html"));

  win.webContents.on("did-finish-load", () => {
    const idleInterval = setInterval(() => {
      if (win && !win.isDestroyed()) {
        const idleTime = powerMonitor.getSystemIdleTime();
        win.webContents.send("system-idle-time", idleTime);
      } else {
        clearInterval(idleInterval);
      }
    }, 1000);
  });

  win.on("closed", () => {
    clearInterval(idleInterval);
  });
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("open-folder-dialog", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  } else {
    return null;
  }
});

// 🔹 Run Python scan with selected folder
ipcMain.handle("find-large-files", async (event, folderPath) => {
  return new Promise((resolve, reject) => {
    const python = spawn("python3", [
      "./backend/python/findLargeFiles.py",
      folderPath,
    ]);
    let data = "";

    python.stdout.on("data", (chunk) => {
      data += chunk.toString();
    });

    python.stderr.on("data", (err) => {
      console.error("Python Error:", err.toString());
    });

    python.on("close", () => {
      try {
        const parsed = JSON.parse(data || "[]");
        if (parsed.error) {
          console.error("Python Script Error:", parsed.error);
          resolve([]);
        } else {
          resolve(parsed);
        }
      } catch (e) {
        console.error("JSON Parse Error:", e);
        console.error("Raw Data Received:", data);
        resolve([]); // Fail gracefully
      }
    });
  });
});

ipcMain.handle("delete-file", async (event, filePath) => {
  return new Promise((resolve, reject) => {
    const python = spawn("python3", [
      "./backend/python/deleteFile.py",
      filePath,
    ]);
    let result = "";

    python.stdout.on("data", (chunk) => (result += chunk));
    python.stderr.on("data", (err) => console.error(err.toString()));
    python.on("close", () => resolve(result.trim()));
  });
});

ipcMain.handle("delete-all-files", async (event, fileList) => {
  return new Promise((resolve, reject) => {
    const python = spawn(
      "python3",
      ["./backend/python/deleteFile.py", "--batch"],
      {
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    let result = "";

    python.stdout.on("data", (chunk) => (result += chunk));
    python.stderr.on("data", (err) => console.error(err.toString()));

    // Send the list of files as JSON through stdin
    python.stdin.write(JSON.stringify(fileList));
    python.stdin.end();

    python.on("close", () => resolve(result.trim()));
  });
});

// Fetch latest Gmail messages
ipcMain.handle("gmail-fetch", async () => {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python3", [
      path.join(__dirname, "backend", "python", "gmailRead.py"),
      "list",
    ]);

    let output = "";
    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error("Python stderr:", data.toString());
    });

    pythonProcess.on("close", (code) => {
      if (code === 0) {
        try {
          const parsed = JSON.parse(output);
          resolve(parsed); // Send structured data to frontend
        } catch (e) {
          console.error("JSON parse error:", e);
          reject("Invalid JSON from Python");
        }
      } else {
        reject(`Python exited with code ${code}`);
      }
    });
  });
});

ipcMain.handle("gmail-send", async (event, to, subject, body) => {
  console.log("[MAIN] Sending email:", { to, subject, body }); // Debug log
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(
      __dirname,
      "backend",
      "python",
      "gmailRead.py"
    );
    const process = spawn("python3", [pythonScript, "send", to, subject, body]);

    let output = "";
    let error = "";

    process.stdout.on("data", (data) => (output += data.toString()));
    process.stderr.on("data", (data) => (error += data.toString()));

    process.on("close", (code) => {
      if (code === 0) {
        console.log("[MAIN] Email sent successfully:", output);
        resolve(output || "✅ Email sent!");
      } else {
        console.error("[MAIN] Email failed:", error);
        reject(`Error: ${error}`);
      }
    });
  });
});

// Generate Reply for a given Email ID
// Update the ai:generateReply handler in main.js

ipcMain.handle(
  "ai:generateReply",
  async (event, { body, subject = "", sender = "", emailId = "" }) => {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(
        __dirname,
        "backend",
        "python",
        "replyGenerator.py"
      );

      // Prepare the input data as JSON
      const inputData = JSON.stringify({
        body,
        subject,
        sender,
        email_id: emailId,
      });

      // Spawn the Python process
      const pythonProcess = spawn("python3", [scriptPath], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Set timeout (30 seconds)
      const timeout = setTimeout(() => {
        pythonProcess.kill();
        reject(new Error("Python script timed out after 30 seconds"));
      }, 30000);

      // Handle Python process output
      let stdout = "";
      let stderr = "";

      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      // Send input data to Python process
      pythonProcess.stdin.write(inputData);
      pythonProcess.stdin.end();

      // Handle process completion
      pythonProcess.on("close", (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          console.error(`Python script exited with code ${code}`);
          console.error("Python stderr:", stderr);
          reject(new Error(stderr || "Python script failed"));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result.replies);
          }
        } catch (parseError) {
          console.error("Failed to parse Python output:", stdout);
          reject(new Error("Invalid response from Python script"));
        }
      });

      pythonProcess.on("error", (error) => {
        clearTimeout(timeout);
        console.error("Failed to start Python process:", error);
        reject(new Error("Python process failed to start"));
      });
    });
  }
);

ipcMain.handle("save-task", (event, taskData) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO tasks (name, current_date, start_date, stop_date, duration_time, idle_time, task_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      taskData.name,
      taskData.current_date,
      taskData.start_date,
      taskData.stop_date,
      taskData.duration_time,
      taskData.idle_time,
      taskData.task_status ? 1 : 0
    );

    return { success: true, task_id: result.lastInsertRowid }; // 👈 Return auto-incremented ID
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-tasks", async () => {
  try {
    const stmt = db.prepare("SELECT * FROM tasks"); // or SELECT id, name, ...
    const tasks = stmt.all();

    return { success: true, tasks };
  } catch (err) {
    console.error("❌ DB Retrieval Error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("delete-task", async (event, task_id) => {
  try {
    const stmt = db.prepare("DELETE FROM tasks WHERE task_id = ?");
    stmt.run(task_id);
    return { success: true };
  } catch (err) {
    console.error("❌ Delete error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle(
  "update-task-dates",
  async (_, { task_id, start_date, stop_date }) => {
    try {
      await db.run(
        `UPDATE tasks SET start_date = ?, stop_date = ? WHERE task_id = ?`,
        [start_date, stop_date, task_id]
      );
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
);

ipcMain.handle(
  "update-task-duration",
  async (_, { task_id, duration_time, idle_time }) => {
    try {
      await db.run(
        `UPDATE tasks SET duration_time = ?, idle_time = ? WHERE task_id = ?`,
        [duration_time, idle_time, task_id]
      );
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
);

// Update your updateTask handler
ipcMain.handle("update-task", async (event, taskData) => {
  try {
    const stmt = db.prepare(`
      UPDATE tasks SET
        name = ?,
        current_date = ?,
        start_date = ?,
        stop_date = ?,
        duration_time = ?,
        idle_time = ?,
        task_status = ?
      WHERE task_id = ?
    `);

    const result = stmt.run(
      taskData.name,
      taskData.current_date,
      taskData.start_date,
      taskData.stop_date,
      taskData.duration_time,
      taskData.idle_time,
      taskData.task_status ? 1 : 0,
      taskData.task_id
    );

    return {
      success: true,
      changes: result.changes,
    };
  } catch (error) {
    console.error("Database update error:", error);
    return { success: false, error: error.message };
  }
});

async function loadSavedTasks() {
  try {
    const response = await window.electronAPI.getTasks();
    if (response.success) {
      const container = document.getElementById("tasks");

      response.tasks.forEach((task) => {
        const taskEl = createTaskElement(task, task);
        container.appendChild(taskEl);

        // For running tasks, calculate elapsed time since last pause
        if (task.is_running) {
          const timeDisplay = taskEl.querySelector(".time");
          const startBtn = taskEl.querySelector(".start");

          if (timeDisplay && startBtn) {
            // Parse saved duration (HH:MM:SS)
            const [h, m, s] = task.duration_time.split(":").map(Number);
            let totalSeconds = h * 3600 + m * 60 + s;

            // Add time elapsed since last start
            if (task.last_start_time) {
              const secondsSinceStart = Math.floor(
                (new Date() - new Date(task.last_start_time)) / 1000
              );
              totalSeconds += secondsSinceStart;
            }

            // Update display immediately
            timeDisplay.textContent = formatTime(totalSeconds);

            // Start the timer
            seconds = totalSeconds; // Your timer's counter variable
            startBtn.click(); // Trigger the start action
          }
        }
      });
    }
  } catch (err) {
    console.error("Load tasks error:", err);
  }
}

const checkColumns = () => {
  try {
    const columns = db.prepare("PRAGMA table_info(tasks)").all();
    const columnNames = columns.map((col) => col.name);

    // 2. Add missing columns
    if (!columnNames.includes("is_running")) {
      db.prepare(
        "ALTER TABLE tasks ADD COLUMN is_running INTEGER DEFAULT 0"
      ).run();
      console.log("Added is_running column");
    }

    if (!columnNames.includes("last_start_time")) {
      db.prepare("ALTER TABLE tasks ADD COLUMN last_start_time TEXT").run();
      console.log("Added last_start_time column");
    }

    return true;
  } catch (error) {
    console.error("Schema modification error:", error);
    return false;
  }
};

// Show table columns
const pragma = db.prepare("PRAGMA table_info(tasks);").all();
console.log("📋 Table columns:", pragma);

// Show saved data
//const tasks = db.prepare("SELECT * FROM tasks;").all();
// console.log("📦 All tasks:", tasks);

const csvPath = path.join(app.getPath("documents"), "tasks.csv");

ipcMain.on("export-to-csv", (event, taskData) => {
  const headers = [
    "Date",
    "Task",
    "Start Date",
    "Stop Date",
    "Active Time",
    "Idle Time",
    "Status",
  ];

  const row = [
    taskData.date,
    `"${taskData.task}"`, // quote in case task name has commas
    taskData.start_date,
    taskData.stop_date,
    taskData.active_time,
    taskData.idle_time,
    taskData.status,
  ].join(",");

  // if file doesn’t exist, add headers first
  if (!fs.existsSync(csvPath)) {
    fs.writeFileSync(csvPath, headers.join(",") + "\n", "utf8");
  }

  // append new row
  fs.appendFile(csvPath, row + "\n", (err) => {
    if (err) {
      console.error("❌ Failed to write to CSV:", err);
    } else {
      console.log("✅ Task exported to CSV:", csvPath);
    }
  });
});

ipcMain.handle("file-organizer-run", async (event, payload) => {
  // payload: { mode: "1", params: { ... }, base_path: "...", pythonPath: "python3" (optional) }
  return new Promise((resolve, reject) => {
    const pythonPath = payload.pythonPath || "python3"; // or 'python' depending on environment
    const scriptPath = path.join(
      __dirname,
      "backend",
      "python",
      "file_organizer.py"
    );

    const py = spawn(pythonPath, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    py.stdout.on("data", (d) => {
      stdout += d.toString();
    });

    py.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    py.on("error", (err) => {
      reject({
        status: "error",
        message: `Failed to start Python: ${err.message}`,
      });
    });

    py.on("close", (code) => {
      if (stderr && !stdout) {
        // if there is stderr and no stdout, return error
        reject({ status: "error", message: stderr });
        return;
      }
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        reject({
          status: "error",
          message: "Invalid JSON from Python",
          raw: stdout,
          stderr,
        });
      }
    });

    // Send payload JSON to python stdin
    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();
  });
});

function runPythonScript(args) {
  return new Promise((resolve, reject) => {
    // Get the correct path to the Python script
    const scriptPath = path.join(
      __dirname,
      "backend",
      "python",
      "duplicateCleaner.py"
    );

    const pythonProcess = spawn("python3", [scriptPath, ...args]);

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(`Python script failed with code ${code}: ${errorOutput}`)
        );
      }

      try {
        const result = output.trim() ? JSON.parse(output) : {};
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result);
        }
      } catch (err) {
        reject(
          new Error(`Invalid JSON from Python: ${output}\n${errorOutput}`)
        );
      }
    });

    pythonProcess.on("error", (err) => {
      reject(new Error(`Failed to start Python: ${err.message}`));
    });
  });
}

ipcMain.handle("scan-duplicates", async (event, folderPath) => {
  try {
    const result = await runPythonScript([folderPath, "scan"]);
    return result;
  } catch (error) {
    console.error("Scan duplicates error:", error);
    return { error: error.message };
  }
});

ipcMain.handle("delete-duplicates", async (event, folderPath) => {
  try {
    const result = await runPythonScript([folderPath, "delete"]);
    return result;
  } catch (error) {
    console.error("Delete duplicates error:", error);
    return { error: error.message };
  }
});

async function openAll(urls, openLinks, delay = 1500) {
  if (!urls || urls.length === 0) return;
  if (!openLinks) return;

  for (const url of urls) {
    try {
      await shell.openExternal(url);
      console.log("Opened:", url);

      // wait before opening the next one
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (err) {
      console.error(`Failed to open: ${url}`, err.message || err);
    }
  }
}

// Example profiles (replace with yours)

const profiles = {
  Work: [
    "https://mail.google.com",
    "https://calendar.google.com",
    "https://slack.com",
    "https://notion.so",
    "https://drive.google.com",
  ],
  Coding: [
    "https://stackoverflow.com",
    "https://github.com",
    "https://developer.mozilla.org",
    "https://codepen.io",
    "https://npmjs.com",
  ],
  Research: [
    "https://scholar.google.com",
    "https://wikipedia.org",
    "https://news.google.com",
    "https://www.researchgate.net",
  ],
  Content: [
    "https://canva.com",
    "https://notion.so",
    "https://grammarly.com",
    "https://medium.com",
  ],
};

// Scraper for Jumia
async function scrapeJumia(query) {
  const url = `https://www.jumia.co.ke/catalog/?q=${encodeURIComponent(query)}`;
  try {
    const res = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 10000,
    });
    const $ = cheerio.load(res.data);
    const items = [];
    $("article.prd").each((_, el) => {
      if (items.length >= 5) return false;
      const title = $(el).find("h3.name").text().trim();
      const price = $(el).find("div.prc").text().trim();
      const linkRel = $(el).find("a.core").attr("href");
      if (title && price && linkRel) {
        items.push({
          title,
          price,
          link: `https://www.jumia.co.ke${linkRel}`,
        });
      }
    });
    return items;
  } catch (e) {
    console.error("Jumia scrape failed:", e?.message || e);
    return [];
  }
}

/* ---------------- IPC HANDLERS ---------------- */

ipcMain.handle("profiles:get", async () => profiles);

ipcMain.handle("profiles:launch", async (_ev, { name, openLinks }) => {
  const list = profiles[name] || [];
  await openAll(list, openLinks);
  return { ok: true, count: list.length };
});

ipcMain.handle("search:product", async (_ev, { productName, openLinks }) => {
  const q = productName?.trim();
  if (!q) return { ok: false, error: "Empty product name." };

  const jumia = await scrapeJumia(q);

  // Meta searches
  const amazon = `https://www.amazon.com/s?k=${encodeURIComponent(q)}`;
  const ali = `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(
    q
  )}`;
  const ebay = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`;

  if (openLinks) {
    await openAll(
      jumia.map((i) => i.link),
      true
    );
    await openAll([amazon, ali, ebay], true);
  }

  return {
    ok: true,
    jumia,
    meta: { amazon, aliexpress: ali, ebay },
  };
});

ipcMain.handle("search:research", async (_ev, { topic, openLinks }) => {
  const t = topic?.trim();
  if (!t) return { ok: false, error: "Empty topic." };

  const q = encodeURIComponent(t);
  const src = {
    scholar: `https://scholar.google.com/scholar?q=${q}`,
    wikipedia: `https://en.wikipedia.org/wiki/${encodeURIComponent(t).replace(
      /%20/g,
      "_"
    )}`,
    news: `https://news.google.com/search?q=${q}`,
    youtube: `https://www.youtube.com/results?search_query=${q}`,
    twitter: `https://twitter.com/search?q=${q}&src=typed_query`,
  };

  if (openLinks) {
    await openAll(Object.values(src), true);
  }

  return { ok: true, sources: src };
});

ipcMain.handle("getProfiles", async () => profiles);
