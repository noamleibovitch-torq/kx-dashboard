// Main process - Electron entry point
const { app, BrowserWindow, ipcMain, powerSaveBlocker } = require('electron');
const path = require('path');

let mainWindow;
let powerSaveBlockerId;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1400,
    minHeight: 900,
    backgroundColor: '#0D0D0D',
    titleBarStyle: 'hiddenInset',
    fullscreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setFullScreen(true);

  // Always open DevTools for debugging
  mainWindow.webContents.openDevTools();

  // Add keyboard shortcut to toggle DevTools (Cmd+Option+I)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'i' && input.meta && input.alt) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  // Prevent display from sleeping (keep dashboard visible)
  powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  console.log('🔋 Power save blocker started - screen will stay awake');
  console.log('   Blocker ID:', powerSaveBlockerId);
  console.log('   Is blocking:', powerSaveBlocker.isStarted(powerSaveBlockerId));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Stop power save blocker when app closes
  if (powerSaveBlockerId && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    console.log('🔋 Power save blocker stopped');
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Ensure power save blocker is stopped before quitting
  if (powerSaveBlockerId && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    console.log('🔋 Power save blocker stopped (before-quit)');
  }
});

// IPC handlers for communication between main and renderer
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

