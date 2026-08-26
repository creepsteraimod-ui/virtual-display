const fs = require('node:fs/promises');
const path = require('node:path');
const {app, BrowserWindow, ipcMain} = require('electron');
const {LinuxDisplayBackend} = require('../app/platform/linux');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const backend = new LinuxDisplayBackend();
  ipcMain.handle('display:get-status', () => backend.getStatus());
  ipcMain.handle('settings:get', () => ({launchAtLogin: true}));

  const window = new BrowserWindow({
    width: 520,
    height: 650,
    useContentSize: true,
    show: true,
    backgroundColor: '#101317',
    webPreferences: {
      preload: path.join(__dirname, '..', 'app', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.once('did-finish-load', async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const image = await window.webContents.capturePage();
    await fs.writeFile(
      path.join(__dirname, '..', 'assets', 'virtual-display-app.png'),
      image.toPNG()
    );
    window.destroy();
    app.quit();
  });
  window.loadFile(path.join(__dirname, '..', 'app', 'renderer', 'index.html'));
});
