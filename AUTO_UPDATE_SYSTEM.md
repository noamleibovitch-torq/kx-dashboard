# Auto-Update System

## Overview

The KX Dashboard now has a fully automated update system using GitHub Actions and electron-updater. Updates are pushed automatically to the display without manual intervention.

## How It Works

### 1. **Developer Workflow**

```bash
# 1. Make changes to the code
# 2. Commit changes
git add .
git commit -m "Add new feature"

# 3. Create a version tag
git tag v1.0.1
git push origin feature/remote-updates --tags

# 4. GitHub Actions automatically:
#    - Builds Mac/Windows/Linux versions
#    - Creates GitHub Release
#    - Uploads .dmg, .zip, .exe, .AppImage
```

### 2. **Automatic Updates on Dashboard**

The dashboard checks for updates:
- **On launch** (3 seconds after startup)
- **Display shows notification** when update is available
- **Downloads automatically** in background
- **Installs and restarts** after 5 seconds

## GitHub Actions Workflow

Location: `.github/workflows/release.yml`

**Triggers on:** Push of version tags (e.g., `v1.0.1`, `v1.0.2`)

**Steps:**
1. Checkout code
2. Setup Node.js
3. Install dependencies
4. Build for all platforms (Mac, Windows, Linux)
5. Create GitHub Release
6. Upload built files

**Uses Public Releases:**
- Repository can stay private
- Releases are public (no authentication needed)
- Only built files are accessible, not source code

## Update Notifications

The app shows visual notifications for:

| Status | Icon | Message |
|--------|------|---------|
| Checking | 🔍 | "Checking for updates..." |
| Available | 📥 | "Update available (v1.0.1). Downloading..." |
| Downloading | ⬇️ | "Downloading update... 45%" |
| Downloaded | ✅ | "Update downloaded! Installing in 5 seconds..." |
| Up to Date | ✅ | "App is up to date!" |
| Error | ⚠️ | "Update error: [message]" |

## Configuration

### package.json

```json
{
  "version": "1.0.0",  // Bump this for new releases
  "build": {
    "publish": {
      "provider": "github",
      "owner": "noamleibovitch",
      "repo": "KX-Dashboard",
      "private": false  // Public releases on private repo
    }
  }
}
```

### Repository Settings

Your GitHub Personal Access Token: `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`

**Used for:**
- GitHub Actions to create releases
- Stored as repository secret (optional, GITHUB_TOKEN works automatically)

**Security:**
- Token has `repo` scope
- Can be revoked anytime at: GitHub → Settings → Developer Settings → Tokens

## Creating a New Release

### Method 1: Command Line (Recommended)

```bash
# 1. Make sure all changes are committed
git status

# 2. Update version in package.json
# Edit electron-app/package.json: "version": "1.0.1"

# 3. Commit version bump
git add electron-app/package.json
git commit -m "Bump version to 1.0.1"

# 4. Create and push tag
git tag v1.0.1
git push origin feature/remote-updates
git push origin v1.0.1

# 5. GitHub Actions automatically builds and releases
```

### Method 2: GitHub Web Interface

1. Go to repository → Releases → "Draft a new release"
2. Click "Choose a tag" → Create new tag (e.g., `v1.0.1`)
3. Set target branch: `feature/remote-updates`
4. Title: `v1.0.1`
5. Click "Publish release"
6. GitHub Actions triggers automatically

## Versioning

Use [Semantic Versioning](https://semver.org/):
- **v1.0.0** → v1.0.1 (Bug fixes)
- **v1.0.0** → v1.1.0 (New features)
- **v1.0.0** → v2.0.0 (Breaking changes)

## Testing Updates

### Test in Development

```bash
cd electron-app
npm start
# Auto-update is disabled in development mode
# Console shows: "Auto-update disabled in development mode"
```

### Test with Built App

1. Build current version:
   ```bash
   cd electron-app
   npm run build:mac
   ```

2. Install the built app

3. Create a new version (bump version number)

4. Push tag to trigger GitHub Actions

5. Wait for release to be created

6. Open installed app → it should check for update and notify

## Troubleshooting

### Update Not Found

**Problem:** App says "up to date" but new version exists

**Solutions:**
- Check version in `package.json` is higher than installed version
- Verify GitHub Release was created successfully
- Check GitHub Release is public (not draft)
- Look at app console for electron-updater logs

### GitHub Actions Build Fails

**Problem:** Workflow fails to build or upload

**Solutions:**
- Check workflow logs at: Actions tab in GitHub
- Verify `package.json` syntax is valid
- Ensure all dependencies are listed
- Check GitHub token has correct permissions

### Download Fails

**Problem:** Update downloads but fails to install

**Solutions:**
- Check internet connection on display machine
- Verify GitHub Release assets are accessible
- Check disk space on machine

## Manual Update Check

Users can manually check for updates via:
- Settings modal (if implemented)
- App will auto-check on every launch

## Disabling Auto-Update

To disable (for testing):

```javascript
// In main.js, comment out:
// autoUpdater.checkForUpdatesAndNotify();
```

## Benefits

✅ **Zero manual deployment** - Push code, automatic builds  
✅ **No physical access needed** - Display updates automatically  
✅ **Version control** - All releases tracked in GitHub  
✅ **Rollback support** - Can publish older versions if needed  
✅ **Multi-platform** - Builds for Mac, Windows, Linux simultaneously  
✅ **Progress indication** - Users see download progress  
✅ **Graceful updates** - Auto-installs with minimal disruption  

## Security Notes

- Repository code stays private
- Only releases (built files) are public
- Personal Access Token should be kept secure
- Token can be revoked if compromised
- Built apps are unsigned (users need to right-click → Open first time)

---

## Next Steps

1. **Commit and push this implementation**
2. **Create first release (v1.0.0)**
3. **Verify GitHub Actions builds successfully**
4. **Install on display and test auto-update**
5. **Make a change and release v1.0.1 to test**

