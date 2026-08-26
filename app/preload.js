const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('virtualDisplay', {
  getStatus: () => ipcRenderer.invoke('display:get-status'),
  setEnabled: enabled => ipcRenderer.invoke('display:set-enabled', enabled),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setLaunchAtLogin: enabled => ipcRenderer.invoke('settings:set-launch-at-login', enabled),
  openDisplaySettings: () => ipcRenderer.invoke('system:open-display-settings'),
  onStatus: callback => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('display:status', listener);
    return () => ipcRenderer.removeListener('display:status', listener);
  },
});
