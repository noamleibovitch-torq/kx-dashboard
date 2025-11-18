# KX Dashboard - Electron App

A beautiful, self-contained desktop dashboard built with Electron for displaying real-time Torq enrollment and labs analytics.

## ✨ Features

- **Cross-Platform**: Runs on macOS, Windows, and Linux
- **Self-Contained**: Single executable, no additional dependencies needed
- **Auto-Refresh**: Automatically updates every hour
- **Configurable Time Window**: Adjust days_back from 1-30 days
- **Persistent Settings**: Remembers your preferences across restarts
- **Dark Mode**: Beautiful dark theme optimized for wide screens
- **Real-Time Data**: Fetches live data from Torq webhook
- **No Xcode Required**: Build and run with Node.js/npm

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm (or yarn)
- That's it! No Xcode, no Apple Developer account needed

### Installation

```bash
cd electron-app

# Install dependencies
npm install

# Run the app
npm start
```

### Building Standalone App

```bash
# Build for current platform
npm run build

# Build for macOS specifically
npm run build:mac

# Build for all platforms
npm run build:all
```

The built app will be in the `dist/` folder:
- **macOS**: `dist/KX Dashboard-1.0.0.dmg` and `.zip`
- **Windows**: `dist/KX Dashboard Setup 1.0.0.exe`
- **Linux**: `dist/KX Dashboard-1.0.0.AppImage`

## 📦 Project Structure

```
electron-app/
├── main.js          # Electron main process (window management)
├── preload.js       # Security bridge between main and renderer
├── renderer.js      # UI logic and data management
├── api.js           # Torq API client
├── index.html       # App HTML structure
├── styles.css       # Dark mode styling
├── package.json     # Dependencies and build config
└── README.md        # This file
```

## 🎨 What You'll See

### Top Section - Global KPIs
- 8 metric cards showing key performance indicators
- Delta indicators with ▲/▼ arrows and color coding
- Values include: Total Enrollments, Unique Users, Completed Passed, In Progress, Labs Running, Total Attempts, Passed/Failed Checks

### Middle Left - Enrollments
- Current vs Previous period comparison
- Top Guides horizontal bar chart
- Percentage breakdowns for each guide
- "Others" category aggregation

### Middle Right - Segments
- Current and Previous period segment distribution
- Visual progress bars
- Count and percentage for each segment
- Color-coded by segment type

### Bottom - Labs Activity
- Today's labs metrics (running, created, resolved, attempts)
- Pass/fail check percentages
- Average resolve time
- Activity trend bar chart
- Detailed trend data table

## ⚙️ Configuration

### API Endpoint

The app connects to:
```
https://hooks.torq.io/v1/webhooks/8f17760c-c43f-4270-b465-95dabb54389d/workflows/78f77a59-d2ee-4015-afee-3c8043bb6b31/sync
```

**Important**: Uses `Content-Type: text/plain` to avoid CORS issues.

### Settings

- **Days Back**: Use +/- buttons in top-right (1-30 days)
- **Auto-Refresh**: Every 60 minutes (3600000ms)
- **Persistence**: Settings saved in localStorage

### Customization

**Change refresh interval** (renderer.js line ~76):
```javascript
this.refreshTimer = setInterval(() => {
  this.load();
}, 3600000); // Change to desired milliseconds
```

**Change colors** (styles.css lines 9-14):
```css
--accent-cyan: #00D9FF;
--accent-green: #00FF88;
--accent-pink: #FF006E;
```

**Change window size** (main.js lines 10-11):
```javascript
width: 1600,
height: 1000,
minWidth: 1400,
minHeight: 900,
```

## 🛠️ Development

### Run in Development Mode

```bash
# Install dependencies first
npm install

# Start with DevTools open
NODE_ENV=development npm start
```

### Hot Reload

For development with auto-reload, install electron-reload:
```bash
npm install --save-dev electron-reload

# Add to main.js (top):
if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(__dirname);
}
```

### Debug

- Press `Cmd+Option+I` (macOS) or `Ctrl+Shift+I` (Windows/Linux) to open DevTools
- Console logs appear in DevTools console
- Network requests visible in Network tab

## 📦 Distribution

### Build for Distribution

```bash
# Clean build
rm -rf dist/ node_modules/
npm install
npm run build
```

### macOS Distribution

The `.dmg` file in `dist/` can be:
- Directly copied to other Macs
- Distributed via network/USB
- Uploaded to internal file server

**Note**: For distribution outside your organization, you may need to sign and notarize (requires Apple Developer account).

### Windows Distribution

The `.exe` installer in `dist/` can be:
- Run directly on any Windows PC
- Distributed via network share
- No admin rights needed for installation

### Linux Distribution

The `.AppImage` file in `dist/` can be:
- Made executable: `chmod +x "KX Dashboard-1.0.0.AppImage"`
- Run directly: `./KX Dashboard-1.0.0.AppImage`
- No installation required

## 🔧 Troubleshooting

### App won't start
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm start
```

### Data not loading
- Check network connectivity
- Open DevTools (Cmd+Option+I) and check Console for errors
- Verify webhook URL is accessible

### Build fails
```bash
# Install electron-builder globally
npm install -g electron-builder

# Clean and rebuild
rm -rf dist/ node_modules/
npm install
npm run build
```

### Blank screen on launch
- Check Console for JavaScript errors
- Verify all files (main.js, renderer.js, api.js, index.html, styles.css) are present
- Try clearing localStorage: DevTools → Application → Local Storage → Clear

## 🎯 Features Checklist

- ✅ Cross-platform (macOS, Windows, Linux)
- ✅ Self-contained executable
- ✅ No Xcode required
- ✅ Auto-refresh every hour
- ✅ Configurable days_back (1-30)
- ✅ Persistent settings (localStorage)
- ✅ Dark mode optimized
- ✅ Error handling with banners
- ✅ Loading states
- ✅ Real-time Torq data
- ✅ Beautiful charts and visualizations
- ✅ Wide-screen optimized layout
- ✅ One-command build and run

## 📊 Tech Stack

- **Electron**: Desktop application framework
- **Chart.js**: Data visualization
- **Vanilla JavaScript**: No framework overhead
- **CSS3**: Modern styling with CSS variables
- **LocalStorage**: Settings persistence
- **Fetch API**: Network requests

## 🆚 vs Swift Version

| Aspect | Electron | Swift |
|--------|----------|-------|
| **Platform** | Cross-platform ✅ | macOS only |
| **Size** | ~150 MB | ~5 MB |
| **Build** | `npm run build` ✅ | Xcode required |
| **Distribution** | Easy ✅ | Needs signing |
| **Development** | HTML/CSS/JS ✅ | Swift/SwiftUI |
| **Setup** | `npm install` ✅ | Xcode project |

## 📝 License

MIT

## 🙏 Credits

Built with Electron, Chart.js, and modern web technologies.

---

**Ready to use!** Run `npm install && npm start` to see your dashboard! 🚀

