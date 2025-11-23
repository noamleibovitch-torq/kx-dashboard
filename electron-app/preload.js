// Preload script - Bridge between main and renderer processes
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  toggleDevTools: () => ipcRenderer.invoke('toggle-devtools'),
  isDevToolsOpened: () => ipcRenderer.invoke('is-devtools-opened'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, data) => callback(data))
});

