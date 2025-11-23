# 🚀 Quick Start Guide - Web Dashboard

## One-Time Setup (5 minutes)

### 1. Push Code
```bash
cd /Users/noamleibovitch/Desktop/projects/KX\ Dashboard
git push origin feature/remote-updates
```
Then merge the PR to `main` on GitHub.

### 2. Enable GitHub Pages
1. Go to: https://github.com/noamleibovitch-torq/kx-dashboard/settings/pages
2. Set Source: **Branch: `main`** | **Folder: `/web-dashboard`**
3. Click **Save**
4. Copy the URL (e.g., `https://noamleibovitch-torq.github.io/kx-dashboard/`)

### 3. Add Secrets
1. Go to: https://github.com/noamleibovitch-torq/kx-dashboard/settings/secrets/actions
2. Click **New repository secret** twice:
   - Name: `TORQ_WEBHOOK_URL` → Value: [Your webhook URL]
   - Name: `TORQ_AUTH_SECRET` → Value: [Your auth token]

### 4. Run First Data Fetch
1. Go to: https://github.com/noamleibovitch-torq/kx-dashboard/actions
2. Click **Fetch Dashboard Data** workflow
3. Click **Run workflow** → **Run workflow**
4. Wait ~30 seconds for completion

### 5. Open Dashboard
Navigate to your GitHub Pages URL in any browser!

---

## For TV Display

1. **Open URL** in Chrome/Firefox
2. **Press F11** for full-screen
3. **Click ⚙️** (settings icon) and configure:
   - ✅ Auto-rotate: Every 60 seconds
   - ✅ Auto-refresh: Every 60 minutes
   - ✅ Show weather
   - ✅ Show clock
4. **Close settings** - Dashboard runs automatically!

---

## Daily Usage

**Nothing!** The dashboard updates itself every hour automatically via GitHub Actions.

### Manual Update (if needed)
1. Go to Actions tab
2. Run "Fetch Dashboard Data" workflow

### Change Dashboard Code
1. Edit files in `web-dashboard/`
2. Commit and push to `main`
3. GitHub Pages deploys automatically (~1 minute)
4. Refresh browser to see changes

---

## Troubleshooting

**Problem**: Dashboard shows "Failed to load data"
- **Fix**: Run the GitHub Actions workflow manually (Actions tab)

**Problem**: Data is stale
- **Fix**: Check Actions tab to see if workflow is failing
- Verify secrets are set correctly

**Problem**: Changes not appearing
- **Fix**: Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
- Wait 1-2 minutes for GitHub Pages to deploy

---

## URLs

| What | URL |
|------|-----|
| **Dashboard** | https://noamleibovitch-torq.github.io/kx-dashboard/ |
| **GitHub Pages Settings** | https://github.com/noamleibovitch-torq/kx-dashboard/settings/pages |
| **Actions** | https://github.com/noamleibovitch-torq/kx-dashboard/actions |
| **Secrets** | https://github.com/noamleibovitch-torq/kx-dashboard/settings/secrets/actions |

---

## That's It! 🎉

Your dashboard is now:
- ✅ Auto-updating every hour
- ✅ Accessible from any device
- ✅ No installation required
- ✅ Perfect for TV displays
- ✅ Zero maintenance

Just open the URL and enjoy! 📊✨

