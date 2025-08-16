// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openFolderDialog: () => ipcRenderer.invoke("open-folder-dialog"),
  findLargeFiles: (folderPath) =>
    ipcRenderer.invoke("find-large-files", folderPath),
  deleteFile: (filePath) => ipcRenderer.invoke("delete-file", filePath),
  deleteAllFiles: (fileList) =>
    ipcRenderer.invoke("delete-all-files", fileList),
  replyGenerator: {
    generateReply: (emailData) =>
      ipcRenderer.invoke("ai:generateReply", emailData),
  },
  gmail: {
    fetchEmails: () => ipcRenderer.invoke("gmail-fetch"),
    sendEmail: (to, subject, body) =>
      ipcRenderer.invoke("gmail-send", to, subject, body),
  },

  onIdleTime: (callback) => {
    ipcRenderer.on("system-idle-time", (event, idleTime) => {
      callback(idleTime);
    });
  },
  saveTask: (taskData) => ipcRenderer.invoke("save-task", taskData),
  updateTaskDates: (data) => ipcRenderer.invoke("update-task-dates", data),
  updateTask: (taskData) => ipcRenderer.invoke("update-task", taskData),
  updateTaskDuration: (data) =>
    ipcRenderer.invoke("update-task-duration", data),
  getTasks: () => ipcRenderer.invoke("get-tasks"),
  deleteTask: (taskId) => ipcRenderer.invoke("delete-task", taskId),
  runOrganizer: (payload) => ipcRenderer.invoke("file-organizer-run", payload),
  scanDuplicates: (folderPath) =>
    ipcRenderer.invoke("scan-duplicates", folderPath),
  deleteDuplicates: (folderPath) =>
    ipcRenderer.invoke("delete-duplicates", folderPath),

  getProfiles: () => ipcRenderer.invoke("profiles:get"),
  launchProfile: (name, openLinks) =>
    ipcRenderer.invoke("profiles:launch", { name, openLinks }),
  searchProduct: (productName, openLinks) =>
    ipcRenderer.invoke("search:product", { productName, openLinks }),
  searchResearch: (topic, openLinks) =>
    ipcRenderer.invoke("search:research", { topic, openLinks }),
  exportToCSV: (taskData) => ipcRenderer.send("export-to-csv", taskData),
});
