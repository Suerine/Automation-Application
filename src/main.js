const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const { exec } = require("child_process");
const { execFile } = require("child_process");
const isDev = !app.isPackaged;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile(path.join(__dirname, "frontend", "pages", "timetracker.html"));
};

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
