# KX Dashboard - Electron Quick Start

## 🚀 Get Running in 2 Minutes

### Step 1: Install Dependencies
```bash
cd electron-app
npm install
```

### Step 2: Run the App
```bash
npm start
```

**That's it!** 🎉 The dashboard will open automatically.

---

## 📦 Build Standalone App (3 minutes)

### Build for Your Platform
```bash
npm run build
```

### Find Your App
- **macOS**: `dist/KX Dashboard-1.0.0.dmg`
- **Windows**: `dist/KX Dashboard Setup 1.0.0.exe`  
- **Linux**: `dist/KX Dashboard-1.0.0.AppImage`

### Distribute
Just copy the file from `dist/` to other computers. No installation needed!

---

## ⚙️ What You Get

✅ Beautiful dark mode dashboard  
✅ Real-time Torq data  
✅ Auto-refreshes every hour  
✅ Adjustable time window (1-30 days)  
✅ Settings persist across restarts  
✅ Works on Mac, Windows, Linux  

---

## 🎯 Controls

**Top Right Corner:**
- **+/− buttons**: Change days_back (1-30)
- **Last Updated**: Shows when data was last fetched

**Automatic:**
- Data loads on launch
- Refreshes every 60 minutes
- Settings saved automatically

---

## 🔧 Troubleshooting

### App won't start?
```bash
rm -rf node_modules
npm install
npm start
```

### Need to change refresh time?
Edit `renderer.js` line 76:
```javascript
setInterval(() => { this.load(); }, 3600000); // milliseconds
```

### Want to see Console logs?
- **macOS**: `Cmd+Option+I`
- **Windows/Linux**: `Ctrl+Shift+I`

---

## 📁 Files You Have

```
electron-app/
├── package.json     # Dependencies & build config
├── main.js          # Window management
├── preload.js       # Security bridge
├── renderer.js      # UI logic ⭐ main code here
├── api.js           # API client
├── index.html       # HTML structure
├── styles.css       # Dark mode styles
└── README.md        # Full documentation
```

---

## 🎨 Customization

### Colors (styles.css)
```css
--accent-cyan: #00D9FF;    /* Charts */
--accent-green: #00FF88;   /* Positive */
--accent-pink: #FF006E;    /* Negative */
```

### Window Size (main.js)
```javascript
width: 1600,      // Default width
height: 1000,     // Default height
minWidth: 1400,   // Minimum width
minHeight: 900,   // Minimum height
```

### API Endpoint (api.js)
```javascript
this.webhookURL = 'https://hooks.torq.io/...'
```

---

## 📚 Commands Reference

| Command | What It Does |
|---------|--------------|
| `npm install` | Install dependencies (first time only) |
| `npm start` | Run the app |
| `npm run build` | Build standalone app for your OS |
| `npm run build:mac` | Build for macOS only |
| `npm run build:all` | Build for Mac, Windows, Linux |

---

## ✨ Quick Tips

1. **First Run**: Takes ~30 seconds to install dependencies
2. **Subsequent Runs**: Opens in ~2 seconds
3. **No Internet**: Shows error banner, keeps previous data
4. **Wide Screen**: Best viewed at 1920×1080 or larger
5. **Distribution**: Built apps (~150MB) are self-contained

---

## 🆘 Need Help?

1. Check `README.md` for full documentation
2. Open DevTools (`Cmd+Option+I`) to see console errors
3. Delete `node_modules/` and reinstall if issues persist

---

**Happy Dashboarding!** 🚀

```bash
npm install && npm start
```

