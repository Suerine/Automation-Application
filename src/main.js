const { app, BrowserWindow } = require('electron')
const path = require('path');


const createWindow = () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 1000
  })

  win.loadFile(path.join(__dirname, 'frontend', 'pages', 'home.html'));
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})