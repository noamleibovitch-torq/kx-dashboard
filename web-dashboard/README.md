# KX Dashboard - Web Version

A modern, responsive web dashboard for tracking Knowledge Experience metrics, powered by GitHub Pages and automated data updates.

## 🌟 Features

- **Real-time Academy Metrics**: Track enrollments, unique users, labs activity, and solve times
- **Documentation Analytics**: Monitor active users, ticket volume, AI adoption, and deflection rates
- **Interactive Charts**: Beautiful, responsive visualizations with Chart.js
- **Auto-refresh**: Configurable data refresh intervals (5min to 1 hour)
- **Persistent Settings**: All preferences saved in browser localStorage
- **Auto-rotation**: Optional automatic tab switching for TV displays
- **Weather & Clock**: Optional widgets for additional context
- **Mobile Responsive**: Works on any device

## 🚀 Quick Start

### View the Dashboard

Once deployed, your dashboard will be available at:
```
https://noamleibovitch-torq.github.io/kx-dashboard/
```

Just open this URL in any web browser!

## 📦 Setup & Deployment

### 1. Enable GitHub Pages

1. Go to your repository settings
2. Navigate to **Pages** (in the left sidebar)
3. Under **Source**, select:
   - Branch: `main`
   - Folder: `/web-dashboard`
4. Click **Save**
5. GitHub will provide your URL (usually `https://<username>.github.io/<repo-name>/`)

### 2. Configure Secrets

Add your Torq webhook credentials as GitHub repository secrets:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add:
   - Name: `TORQ_WEBHOOK_URL`
     Value: Your Torq webhook endpoint
   - Name: `TORQ_AUTH_SECRET`
     Value: Your authentication token

### 3. GitHub Actions Workflow

The included workflow (`.github/workflows/fetch-dashboard-data.yml`) will:
- ✅ Run automatically **every hour**
- ✅ Fetch fresh data from your Torq webhook
- ✅ Update `data/dashboard.json`
- ✅ Commit changes to the repo
- ✅ GitHub Pages auto-deploys the update

You can also **trigger manually**:
1. Go to **Actions** tab
2. Select "Fetch Dashboard Data"
3. Click **Run workflow**

## 🎨 Customization

### Change Data Refresh Interval

Edit `.github/workflows/fetch-dashboard-data.yml`:

```yaml
on:
  schedule:
    - cron: '0 * * * *'  # Every hour
    # Examples:
    # - cron: '*/30 * * * *'  # Every 30 minutes
    # - cron: '0 */6 * * *'   # Every 6 hours
```

### Update Dashboard Version

Edit `web-dashboard/dashboard.js`:

```javascript
async loadAppVersion() {
  const versionElement = document.getElementById('appVersion');
  if (versionElement) {
    versionElement.textContent = 'Web v1.0.0'; // Change version here
  }
}
```

### Modify Colors/Styling

Edit `web-dashboard/styles.css` to customize:
- Color scheme
- Font sizes
- Layout spacing
- Chart colors

## 🖥️ Local Development

To test locally before deploying:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/noamleibovitch-torq/kx-dashboard.git
   cd kx-dashboard/web-dashboard
   ```

2. **Start a local server**:
   ```bash
   # Python 3
   python3 -m http.server 8000
   
   # Or Node.js
   npx http-server -p 8000
   ```

3. **Open in browser**:
   ```
   http://localhost:8000
   ```

4. **Use sample data**:
   The included `data/dashboard.json` has sample data for testing.

## 📁 Project Structure

```
web-dashboard/
├── index.html          # Main dashboard HTML
├── dashboard.js        # Dashboard logic & rendering
├── styles.css          # All styling
├── queries.js          # SQL/JQ query definitions
├── data/
│   └── dashboard.json  # Auto-generated data cache
└── README.md          # This file

.github/workflows/
└── fetch-dashboard-data.yml  # Automated data fetching
```

## 🔧 Dashboard Settings

Access settings via the ⚙️ icon in the footer:

- **Auto-rotate between tabs**: Automatically switch between Academy/Documentation views
- **Show weather widget**: Toggle Tel Aviv weather display
- **Show clock**: Toggle date/time display
- **Auto-refresh data**: How often to reload dashboard data from cache

All settings are saved to browser localStorage and persist across sessions.

## 🎯 TV Display Mode

Perfect for office dashboards:

1. Open the dashboard URL in a browser
2. Press **F11** for full-screen mode (or use browser's full-screen option)
3. Configure auto-rotation in settings (e.g., every 60 seconds)
4. Optionally enable weather and clock widgets
5. Dashboard will run indefinitely, auto-refreshing data

### Browser Recommendations for TV:
- **Chrome/Edge**: Excellent performance, kiosk mode available
- **Firefox**: Good performance
- **Safari**: Works well on Apple TV/Mac Mini

## 🔄 How Updates Work

```
┌─────────────────────────────────────────────────────────┐
│  GitHub Actions (runs hourly)                            │
│  1. Fetch data from Torq webhook                        │
│  2. Save to data/dashboard.json                         │
│  3. Commit & push to repo                               │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  GitHub Pages                                            │
│  - Automatically deploys latest version                  │
│  - Serves static files via CDN                          │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Dashboard (in browser)                                  │
│  - Loads dashboard.json every N minutes (configurable)   │
│  - Renders data with Chart.js                           │
│  - No page reload needed                                │
└─────────────────────────────────────────────────────────┘
```

## 🆚 Web vs Electron Comparison

| Feature | Web Dashboard | Electron App |
|---------|---------------|--------------|
| **Installation** | None (just URL) | DMG install required |
| **Updates** | Instant (refresh) | Complex (code signing issues) |
| **Size** | ~1MB | ~200MB |
| **Cross-platform** | Any browser | Mac/Windows/Linux builds |
| **Remote management** | ✅ Perfect | ⚠️ Difficult |
| **Offline support** | ❌ No | ✅ Yes |

## 🐛 Troubleshooting

### Dashboard shows "Failed to load data"
- Check that `data/dashboard.json` exists
- Verify GitHub Actions workflow ran successfully
- Check browser console for errors

### GitHub Actions failing
- Verify secrets are set correctly (`TORQ_WEBHOOK_URL`, `TORQ_AUTH_SECRET`)
- Check Actions tab for error logs
- Ensure webhook endpoint is accessible

### GitHub Pages not updating
- Verify Pages is enabled and set to `/web-dashboard` folder
- Check Pages deployment status in Settings → Pages
- May take 1-2 minutes for changes to deploy

### Data is stale
- Check when GitHub Actions last ran (Actions tab)
- Manually trigger workflow if needed
- Increase dashboard auto-refresh frequency in settings

## 📝 License

Internal tool for KX Dashboard tracking.

## 🤝 Support

For issues or questions, contact the development team or create an issue in the repository.

---

**Last Updated**: November 2025
**Version**: Web v1.0.0

