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
});
