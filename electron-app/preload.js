// Preload script - Bridge between main and renderer processes
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  toggleDevTools: () => ipcRenderer.invoke('toggle-devtools'),
  isDevToolsOpened: () => ipcRenderer.invoke('is-devtools-opened'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  setUpdateInterval: (minutes) => ipcRenderer.invoke('set-update-interval', minutes),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, data) => callback(data)),
  getEnv: (key) => ipcRenderer.invoke('get-env', key),
  getContentPath: (filename) => ipcRenderer.invoke('get-content-path', filename)
});

