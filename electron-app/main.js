// Load environment variables from .env file FIRST (before everything else)
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Main process - Electron entry point
const { app, BrowserWindow, ipcMain, powerSaveBlocker } = require('electron');
const { autoUpdater } = require('electron-updater');

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

  // DevTools are now controlled via settings (not auto-opened)
  
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

  // Check for updates (only in production)
  if (app.isPackaged) {
    console.log('🔄 Initializing auto-updater...');
    
    // Configure autoUpdater for private GitHub releases with token
    const ghToken = process.env.GH_TOKEN;
    
    if (ghToken) {
      console.log('🔐 Using GitHub token for private releases');
      console.log('   Token loaded:', ghToken ? 'Yes (length: ' + ghToken.length + ')' : 'No');
      
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'noamleibovitch-torq',
        repo: 'kx-dashboard',
        private: true,
        token: ghToken
      });
      
      setTimeout(() => {
        console.log('🔍 Checking for updates...');
        autoUpdater.checkForUpdatesAndNotify();
      }, 3000); // Check 3 seconds after app starts
    } else {
      console.error('❌ GH_TOKEN not found in environment variables!');
      console.error('   Auto-update will not work without the token.');
      console.error('   Make sure .env file exists and contains GH_TOKEN');
    }
  } else {
    console.log('⚠️  Auto-update disabled in development mode');
  }

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

// Get environment variables (securely from main process)
ipcMain.handle('get-env', (event, key) => {
  // Only allow specific environment variables
  const allowedKeys = ['TORQ_WEBHOOK_URL', 'TORQ_AUTH_SECRET', 'USE_MOCK_DATA', 'GH_TOKEN'];
  if (allowedKeys.includes(key)) {
    return process.env[key];
  }
  return null;
});

// Toggle DevTools from renderer (settings)
ipcMain.handle('toggle-devtools', () => {
  if (mainWindow) {
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    } else {
      mainWindow.webContents.openDevTools();
    }
    return mainWindow.webContents.isDevToolsOpened();
  }
  return false;
});

// Get DevTools state
ipcMain.handle('is-devtools-opened', () => {
  if (mainWindow) {
    return mainWindow.webContents.isDevToolsOpened();
  }
  return false;
});

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('🔍 Checking for update...');
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { status: 'checking' });
  }
});

autoUpdater.on('update-available', (info) => {
  console.log('✅ Update available:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { 
      status: 'available', 
      version: info.version 
    });
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('✅ App is up to date:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { 
      status: 'not-available',
      version: info.version 
    });
  }
});

autoUpdater.on('error', (err) => {
  console.error('❌ Update error:', err);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { 
      status: 'error',
      error: err.message 
    });
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
  console.log('📥', message);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { 
      status: 'downloading',
      percent: Math.round(progressObj.percent),
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('✅ Update downloaded:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { 
      status: 'downloaded',
      version: info.version 
    });
  }
  // Auto-install after 5 seconds
  setTimeout(() => {
    console.log('🔄 Installing update and restarting...');
    autoUpdater.quitAndInstall();
  }, 5000);
});

// Manual update check
ipcMain.handle('check-for-updates', () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
    return { status: 'checking' };
  }
  return { status: 'dev-mode' };
});
