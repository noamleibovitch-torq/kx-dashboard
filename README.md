# KX Dashboard - Electron Edition

A beautiful, self-contained cross-platform desktop dashboard for Torq enrollment and labs analytics.

## 🎯 Overview

This is an **Electron-based desktop application** that displays real-time Torq data with automatic refresh, configurable time windows, and a beautiful dark-mode interface optimized for wide-screen displays.

**Key Benefits:**
- ✅ **Cross-platform**: Works on macOS, Windows, and Linux
- ✅ **Self-contained**: No Xcode, no Apple Developer account needed
- ✅ **Easy distribution**: Build once, copy anywhere
- ✅ **Familiar tech**: Built with HTML, CSS, and JavaScript
- ✅ **Fast setup**: `npm install && npm start`

---

## 🚀 Quick Start

```bash
# Navigate to the app
cd electron-app

# Install dependencies (first time only)
npm install

# Run the app
npm start
```

**See it running in under 2 minutes!** 🎉

For detailed instructions, see [`electron-app/QUICK_START.md`](electron-app/QUICK_START.md)

---

## 📦 Building Standalone App

```bash
cd electron-app

# Build for current platform
npm run build

# Build for all platforms
npm run build:all
```

Output appears in `electron-app/dist/`:
- **macOS**: `.dmg` and `.zip` files
- **Windows**: `.exe` installer
- **Linux**: `.AppImage` file

**File size**: ~150MB (includes Node.js and Chromium)

---

## 📂 Project Structure

```
KX Dashboard/
├── electron-app/              ← All app files here
│   ├── package.json           # Dependencies & build config
│   ├── main.js                # Electron main process
│   ├── preload.js             # Security bridge
│   ├── renderer.js            # UI logic (⭐ main code)
│   ├── api.js                 # Torq API client
│   ├── index.html             # App structure
│   ├── styles.css             # Dark mode styling
│   ├── README.md              # Full documentation
│   ├── QUICK_START.md         # 2-minute guide
│   └── .gitignore             # Git ignore rules
└── README.md                  ← You are here
```

---

## ✨ Features

### Data & Integration
- Real-time data from Torq webhook
- Auto-refresh every hour
- Configurable time window (1-30 days)
- Content-Type: text/plain (avoids CORS)
- Persistent settings (localStorage)

### User Interface
- 8 KPI cards with delta indicators (▲/▼)
- Enrollments breakdown (current vs previous)
- Top Guides horizontal bar chart
- Segments distribution visualization
- Labs activity metrics
- Labs trend chart (Chart.js)
- Error handling with banners
- Loading states
- Last updated timestamp

### Design
- Dark mode optimized for LED displays
- High-contrast colors (cyan, green, pink accents)
- Responsive layout for wide screens
- Smooth animations
- Professional NOC-style dashboard

---

## 🎨 What It Looks Like

### Top Section - KPI Cards
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│Total Enroll │Unique Users │Completed    │In Progress  │
│    293      │    129      │    190      │     90      │
│ ▼ 43%       │ ▼ 58%       │ ▼ 38%       │ ▲ 15%       │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### Middle Section - Enrollments & Segments
```
┌─────────────────────────────────┬──────────────────┐
│ Enrollments                     │ Segments         │
│ ┌─────────────────────────────┐ │ ┌──────────────┐ │
│ │ Current vs Previous         │ │ │ Current      │ │
│ │ Total: 293 / 513            │ │ │ Torq: 99%    │ │
│ │ Users: 129 / 309            │ │ │ None: 1%     │ │
│ └─────────────────────────────┘ │ └──────────────┘ │
│ ┌─────────────────────────────┐ │ ┌──────────────┐ │
│ │ Top Guides                  │ │ │ Previous     │ │
│ │ [████████] Torq Fund... 69  │ │ │ Torq: 99%    │ │
│ │ [█████] Hyperautom... 44    │ │ │ None: 1%     │ │
│ └─────────────────────────────┘ │ └──────────────┘ │
└─────────────────────────────────┴──────────────────┘
```

### Bottom Section - Labs Activity
```
┌──────────────────────────────────────────────────────┐
│ Labs Activity                                        │
│ ┌───────────────┬────────────────────────────────┐   │
│ │ Today's Labs  │ Activity Trend                 │   │
│ │ Running: 101  │     ▂▄█▆▃                      │   │
│ │ Attempts: 30  │   Attempts over time           │   │
│ └───────────────┴────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

---

## ⚙️ Configuration

### Change Refresh Interval
**File**: `electron-app/renderer.js` (line ~76)
```javascript
this.refreshTimer = setInterval(() => {
  this.load();
}, 3600000); // Change to your desired milliseconds
```

### Change Colors
**File**: `electron-app/styles.css` (lines 9-14)
```css
:root {
  --accent-cyan: #00D9FF;    /* Charts, primary */
  --accent-green: #00FF88;   /* Positive, passed */
  --accent-pink: #FF006E;    /* Negative, failed */
}
```

### Change Window Size
**File**: `electron-app/main.js` (lines 10-13)
```javascript
width: 1600,
height: 1000,
minWidth: 1400,
minHeight: 900,
```

### Change API Endpoint
**File**: `electron-app/api.js` (line 4)
```javascript
this.webhookURL = 'https://hooks.torq.io/...';
```

---

## 🛠️ Development

### Run in Development Mode
```bash
cd electron-app
NODE_ENV=development npm start
```

This opens DevTools automatically.

### Debug
- **macOS**: `Cmd+Option+I`
- **Windows/Linux**: `Ctrl+Shift+I`

Console logs and network requests appear in DevTools.

### Make Changes
1. Edit files (`renderer.js`, `styles.css`, etc.)
2. Save
3. Restart app (`Cmd+R` or reload window)

---

## 📚 Documentation

- **[electron-app/README.md](electron-app/README.md)** - Full documentation
- **[electron-app/QUICK_START.md](electron-app/QUICK_START.md)** - 2-minute setup guide

---

## 🆚 Electron vs Swift

We originally built a native Swift/SwiftUI version, but switched to Electron for easier distribution.

| Aspect | Electron | Swift |
|--------|----------|-------|
| **Platform** | Mac, Win, Linux ✅ | macOS only |
| **Size** | ~150 MB | ~5 MB |
| **Build** | `npm run build` ✅ | Xcode required |
| **Distribution** | Copy .dmg/.exe ✅ | Code signing needed |
| **Development** | HTML/CSS/JS ✅ | Swift/SwiftUI |
| **Setup Time** | 2 minutes ✅ | 10+ minutes |
| **Requires** | Node.js ✅ | Xcode + macOS |

**Electron wins for ease of use and cross-platform support!**

---

## 🎯 Use Cases

- **Office Dashboard**: Display on large LED screen in NOC
- **Team Monitoring**: Share with multiple team members
- **Cross-Platform**: Deploy to Mac, Windows, Linux simultaneously
- **No IT Hassle**: No code signing or notarization required
- **Quick Updates**: Edit HTML/CSS/JS and rebuild in seconds

---

## 🐛 Troubleshooting

### App Won't Start
```bash
cd electron-app
rm -rf node_modules package-lock.json
npm install
npm start
```

### Data Not Loading
1. Check network connectivity
2. Open DevTools (`Cmd+Option+I`)
3. Look for errors in Console tab
4. Verify webhook URL is accessible

### Build Fails
```bash
# Install electron-builder globally
npm install -g electron-builder

# Clean rebuild
cd electron-app
rm -rf dist node_modules
npm install
npm run build
```

### Blank Screen
- Check Console for JavaScript errors
- Verify all files are present (main.js, renderer.js, api.js, index.html, styles.css)
- Clear localStorage: DevTools → Application → Local Storage → Clear All

---

## 📦 Distribution Checklist

- [ ] Run `npm run build` in electron-app/
- [ ] Test the built app from dist/ folder
- [ ] Copy .dmg (Mac) or .exe (Windows) or .AppImage (Linux)
- [ ] Share via network drive, email, or USB
- [ ] Recipients double-click to run (no installation needed)

---

## 🙏 Tech Stack

- **Electron** - Desktop app framework
- **Chart.js** - Data visualization
- **Vanilla JavaScript** - No framework overhead
- **CSS3** - Modern styling
- **LocalStorage** - Settings persistence
- **Fetch API** - HTTP requests

---

## 📝 License

MIT

---

## ✅ Ready to Use!

```bash
cd electron-app
npm install
npm start
```

**Build your dashboard in under 2 minutes!** 🚀

For more details, see [`electron-app/README.md`](electron-app/README.md) or [`electron-app/QUICK_START.md`](electron-app/QUICK_START.md).
