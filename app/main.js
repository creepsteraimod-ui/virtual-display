const path = require('node:path');
const fs = require('node:fs/promises');
const {pathToFileURL} = require('node:url');
const {spawn} = require('node:child_process');
const {app, BrowserWindow, ipcMain, Menu, nativeImage, Tray} = require('electron');
const {createDisplayBackend} = require('./platform');

const APP_ID = 'io.virtualdisplay.Controller';
const backend = createDisplayBackend();
let mainWindow;
let tray;
let status;
let quitting = false;

app.disableHardwareAcceleration();

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function getPidPath() {
  return path.join(app.getPath('userData'), 'virtual-display.pid');
}

async function getSettings() {
  try {
    return {launchAtLogin: true, ...JSON.parse(await fs.readFile(getSettingsPath(), 'utf8'))};
  } catch (_error) {
    return {launchAtLogin: true};
  }
}

function quoteDesktopArgument(value) {
  if (/[\r\n\0]/.test(value))
    throw new Error('Invalid executable path for autostart.');
  return `"${value.replaceAll('%', '%%').replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

async function updateAutostart(enabled) {
  const autostartDir = path.join(app.getPath('home'), '.config', 'autostart');
  const desktopFile = path.join(autostartDir, `${APP_ID}.desktop`);
  if (!enabled) {
    await fs.rm(desktopFile, {force: true});
    return;
  }

  await fs.mkdir(autostartDir, {recursive: true});
  const executable = process.platform === 'linux' && process.env.APPIMAGE
    ? process.env.APPIMAGE
    : process.execPath;
  const command = app.isPackaged
    ? quoteDesktopArgument(executable)
    : `${quoteDesktopArgument(process.execPath)} ${quoteDesktopArgument(app.getAppPath())}`;
  await fs.writeFile(desktopFile, [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Virtual Display',
    `Exec=${command} --hidden`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    '',
  ].join('\n'));
}

async function saveSettings(settings) {
  await fs.mkdir(path.dirname(getSettingsPath()), {recursive: true});
  await fs.writeFile(getSettingsPath(), `${JSON.stringify(settings, null, 2)}\n`);
  await updateAutostart(settings.launchAtLogin);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 650,
    minWidth: 460,
    minHeight: 580,
    useContentSize: true,
    show: false,
    title: 'Virtual Display',
    backgroundColor: '#101317',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const rendererUrl = pathToFileURL(path.join(__dirname, 'renderer', 'index.html')).href;
  mainWindow.loadURL(rendererUrl);
  mainWindow.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== rendererUrl)
      event.preventDefault();
  });
  mainWindow.on('close', event => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed())
    createWindow();
  mainWindow.show();
  mainWindow.focus();
  refreshStatus();
}

function buildTrayMenu() {
  tray.setContextMenu(Menu.buildFromTemplate([
    {label: 'Open Virtual Display', click: showWindow},
    {type: 'separator'},
    {
      label: status?.enabled ? 'Disable Virtual Display' : 'Enable Virtual Display',
      enabled: status?.configured ?? false,
      click: () => setDisplayEnabled(!(status?.enabled ?? false)).catch(async error => {
        status = {...await backend.getStatus(), error: error.message};
        buildTrayMenu();
        mainWindow?.webContents.send('display:status', status);
      }),
    },
    {label: 'Refresh', click: refreshStatus},
    {type: 'separator'},
    {label: 'Quit', click: () => {
      quitting = true;
      app.quit();
    }},
  ]));
  tray.setToolTip(status?.enabled
    ? 'Virtual Display: enabled'
    : 'Virtual Display: disabled');
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray.png'));
  tray = new Tray(icon.resize({width: 22, height: 22}));
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
  buildTrayMenu();
}

async function refreshStatus() {
  status = await backend.getStatus();
  buildTrayMenu();
  mainWindow?.webContents.send('display:status', status);
  return status;
}

async function setDisplayEnabled(enabled) {
  status = await backend.setEnabled(enabled);
  buildTrayMenu();
  mainWindow?.webContents.send('display:status', status);
  return status;
}

function registerIpc() {
  const authorize = event => {
    if (event.senderFrame !== mainWindow?.webContents.mainFrame)
      throw new Error('Unauthorized IPC sender.');
  };
  ipcMain.handle('display:get-status', event => {
    authorize(event);
    return refreshStatus();
  });
  ipcMain.handle('display:set-enabled', (event, enabled) => {
    authorize(event);
    if (typeof enabled !== 'boolean')
      throw new TypeError('enabled must be a boolean.');
    return setDisplayEnabled(enabled);
  });
  ipcMain.handle('settings:get', event => {
    authorize(event);
    return getSettings();
  });
  ipcMain.handle('settings:set-launch-at-login', async (event, enabled) => {
    authorize(event);
    if (typeof enabled !== 'boolean')
      throw new TypeError('enabled must be a boolean.');
    const settings = {...await getSettings(), launchAtLogin: enabled};
    await saveSettings(settings);
    return settings;
  });
  ipcMain.handle('system:open-display-settings', event => {
    authorize(event);
    if (process.platform !== 'linux')
      return false;
    return new Promise((resolve, reject) => {
      const settings = spawn('gnome-control-center', ['display'], {detached: true, stdio: 'ignore'});
      settings.once('error', reject);
      settings.once('spawn', () => {
        settings.unref();
        resolve(true);
      });
    });
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.setName('Virtual Display');
  app.setAppUserModelId(APP_ID);
  app.on('before-quit', () => {
    quitting = true;
  });
  app.on('quit', () => fs.rm(getPidPath(), {force: true}).catch(() => {}));
  app.on('second-instance', showWindow);
  app.whenReady().then(async () => {
    registerIpc();
    await fs.mkdir(path.dirname(getPidPath()), {recursive: true});
    await fs.writeFile(getPidPath(), `${process.pid}\n`);
    createWindow();
    createTray();
    const settings = await getSettings();
    await updateAutostart(settings.launchAtLogin);
    await refreshStatus();
    setInterval(refreshStatus, 5000).unref();
    if (!process.argv.includes('--hidden'))
      showWindow();
  });
  app.on('activate', showWindow);
  app.on('window-all-closed', () => {});
}
