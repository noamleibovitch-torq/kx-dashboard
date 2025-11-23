// Load environment variables from .env file FIRST (before everything else)
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Main process - Electron entry point
const { app, BrowserWindow, ipcMain, powerSaveBlocker } = require('electron');
const HotUpdater = require('./hot-update');

let mainWindow;
let powerSaveBlockerId;
let hotUpdater;
let updateCheckInterval;

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

  // Initialize hot updater (only in production)
  if (app.isPackaged) {
    hotUpdater = new HotUpdater();
    
    // Initial check after 5 seconds
    setTimeout(() => {
      checkForHotUpdates();
    }, 5000);
    
    // Set up periodic checks (default: 5 minutes, configurable)
    const updateInterval = 5 * 60 * 1000; // 5 minutes
    updateCheckInterval = setInterval(() => {
      checkForHotUpdates();
    }, updateInterval);
  } else {
    console.log('⚠️  Hot updates disabled in development mode');
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

// Hot update function
async function checkForHotUpdates() {
  if (!hotUpdater) return;
  
  try {
    const updateInfo = await hotUpdater.checkForUpdates();
    
    if (updateInfo.available) {
      console.log('🎉 Hot update available:', updateInfo.latestVersion);
      
      if (mainWindow) {
        mainWindow.webContents.send('update-status', {
          status: 'available',
          type: 'hot',
          currentVersion: updateInfo.currentVersion,
          latestVersion: updateInfo.latestVersion
        });
      }
      
      // Auto-download and apply
      console.log('📥 Downloading hot update...');
      const downloadResults = await hotUpdater.downloadUpdates();
      
      console.log('🔄 Applying hot update...');
      await hotUpdater.applyUpdates(downloadResults);
      
      if (mainWindow) {
        mainWindow.webContents.send('update-status', {
          status: 'applied',
          type: 'hot',
          version: updateInfo.latestVersion
        });
        
        // Reload window to apply changes
        setTimeout(() => {
          console.log('🔃 Reloading window...');
          mainWindow.reload();
        }, 2000);
      }
    } else if (updateInfo.error) {
      console.error('❌ Hot update check failed:', updateInfo.error);
    }
  } catch (error) {
    console.error('❌ Hot update error:', error);
    if (mainWindow) {
      mainWindow.webContents.send('update-status', {
        status: 'error',
        type: 'hot',
        error: error.message
      });
    }
  }
}

// Manual hot update check
ipcMain.handle('check-for-updates', async () => {
  if (app.isPackaged && hotUpdater) {
    await checkForHotUpdates();
    return { status: 'checking', type: 'hot' };
  }
  return { status: 'dev-mode' };
});

// Configure update check interval
ipcMain.handle('set-update-interval', (event, minutes) => {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
  }
  
  if (minutes > 0) {
    const interval = minutes * 60 * 1000;
    updateCheckInterval = setInterval(() => {
      checkForHotUpdates();
    }, interval);
    console.log(`⏰ Update check interval set to ${minutes} minutes`);
    return { success: true, interval: minutes };
  } else {
    console.log('⏰ Update check disabled');
    return { success: true, interval: 0 };
  }
});
