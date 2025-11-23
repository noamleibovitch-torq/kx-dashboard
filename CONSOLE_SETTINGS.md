# Console Settings Implementation

## Overview

The developer console (DevTools) is now hidden by default and can be toggled via the Settings modal. All settings are persistent across app restarts.

## Changes Made

### 1. Main Process (`electron-app/main.js`)
- **Removed** auto-open DevTools on startup
- **Added** IPC handlers for:
  - `toggle-devtools` - Toggles DevTools on/off
  - `is-devtools-opened` - Returns current DevTools state
- **Keyboard shortcut** still works: `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux)

### 2. Preload Script (`electron-app/preload.js`)
- **Exposed** new IPC methods to renderer:
  - `window.electronAPI.toggleDevTools()`
  - `window.electronAPI.isDevToolsOpened()`

### 3. Renderer Process (`electron-app/renderer.js`)
- **Added** console toggle persistence:
  - `loadConsoleToggle()` - Loads saved state (default: false/hidden)
  - `saveConsoleToggle(show)` - Saves state to localStorage
  - `applyConsoleSettings()` - Applies saved state on app startup
- **Added** console toggle handler in settings modal
- **Console state** is synchronized with localStorage on every toggle

### 4. HTML (`electron-app/index.html`)
- **Added** "Show developer console" checkbox in Settings modal

## User Experience

### Default Behavior
- Console is **hidden** by default on app launch
- Setting is **persistent** - remembered across restarts

### How to Show Console

**Option 1: Settings Modal**
1. Click ⚙️ (gear icon) in footer
2. Check "Show developer console"
3. Console opens immediately

**Option 2: Keyboard Shortcut**
- Mac: `Cmd+Option+I`
- Windows/Linux: `Ctrl+Shift+I`
- Note: This bypasses the setting and toggles console directly

### Persistent Settings Summary

All dashboard settings are now persistent via localStorage:

| Setting | Storage Key | Default | Description |
|---------|-------------|---------|-------------|
| Current View | `currentView` | `academy` | Academy or Documentation |
| Academy Period | `selectedPeriod` | `7` | 7d, MTD, 30d, Q, YTD |
| Documentation Period | `docPeriod` | `mtd` | MTD or Prev Mo |
| Auto-rotation Interval | `rotationInterval` | `0` (disabled) | Seconds between view switches |
| Show Weather Widget | `showWeather` | `true` | Weather widget visibility |
| Show Clock | `showClock` | `true` | Clock widget visibility |
| **Show Console** | **`showConsole`** | **`false`** | **DevTools visibility** |
| Trend Chart Filters | `trendFilters_<chartId>` | `{}` | Hidden datasets per chart |

## Testing

To test the changes:

```bash
cd electron-app
npm start
```

1. **Verify console is hidden** on first launch
2. **Open Settings** (⚙️ icon)
3. **Check "Show developer console"**
4. **Verify console opens**
5. **Restart the app**
6. **Verify console state persists** (opens automatically if enabled)
7. **Uncheck the setting** and verify console closes
8. **Restart again** and verify console stays hidden

## Building

To create a new executable with these changes:

```bash
cd electron-app
npm run build:mac
```

The built app will be in `electron-app/dist/`.

## Notes

- Console setting does **not** affect the keyboard shortcut (Cmd+Option+I)
- Keyboard shortcut is always available for debugging, regardless of saved setting
- Console state is checked and applied on every app startup
- Setting is stored locally in browser's localStorage (per-machine)

