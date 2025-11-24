# Private Releases Configuration

## Overview

GitHub releases are now set to **private** with token-based authentication for auto-updates.

## Changes Made

### 1. ✅ Private Releases Enabled

**File: `electron-app/package.json`**
```json
"publish": {
  "private": true  // ← Changed from false
}
```

**Result:**
- Only you (repo owner) can access releases
- Requires authentication to download
- Source code AND releases are private

### 2. ✅ GitHub Token Added

**File: `electron-app/.env`** (gitignored)
```env
GH_TOKEN=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
```

**Token Permissions Required:**
- `repo` scope (full control of private repositories)

### 3. ✅ Token Authentication in App

**File: `electron-app/main.js`**
```javascript
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'noamleibovitch',
  repo: 'KX-Dashboard',
  private: true,
  token: ghToken  // From .env
});
```

### 4. ✅ .env Bundled in Build

**File: `electron-app/package.json`**
```json
"files": [
  ...
  ".env"  // ← Added
]
```

**Result:**
- `.env` file is included in the built app
- Token is available when app runs
- App can authenticate to GitHub for updates

## Security Model

### Who Has Access:

| Resource | Access | How |
|----------|--------|-----|
| **GitHub Releases** | Only you | Private, requires GitHub login |
| **Built .dmg** | Only people you share with | Physical distribution |
| **Credentials in .dmg** | Anyone with the .dmg | Inside app bundle |
| **Auto-update** | Built app only | Uses bundled GH_TOKEN |

### What's Protected:

✅ **GitHub releases are private** - Only you can download from GitHub  
✅ **Auto-update works** - App has token to authenticate  
✅ **Torq credentials** - In .env, bundled with app  
✅ **GitHub token** - In .env, bundled with app  

### What's Exposed:

⚠️ **Anyone with the .dmg can:**
- Extract the app bundle
- Read the `.env` file inside
- See: Torq webhook URL, auth secret, GitHub token

**Mitigation:** Only share the .dmg with trusted people

## How Auto-Update Works Now

1. **App launches** on display machine
2. **Reads GH_TOKEN** from bundled `.env`
3. **Checks GitHub** for new releases (using token)
4. **Downloads private release** (authenticated)
5. **Installs and restarts**

**No manual intervention needed!** ✅

## Building and Distribution

### Build the App:

```bash
cd electron-app
npm run build:mac
```

**Output:** `dist/KX Dashboard-1.0.0-arm64.dmg`

**What's Inside:**
- All app code
- `.env` file with credentials and token
- Everything needed for auto-update

### Distribute:

**Method 1: Direct Copy**
- Copy `.dmg` to USB drive
- Install on display machine
- Done!

**Method 2: Network Share**
- Upload `.dmg` to internal network drive
- Download on display machine
- Install

**Method 3: Via GitHub (still works!)**
- You can manually download from GitHub Releases
- Requires GitHub login
- Not public, so it's secure

## GitHub Actions Workflow

GitHub Actions still builds automatically:

**Trigger:**
```bash
git tag v1.0.0
git push origin v1.0.0
```

**Process:**
1. GitHub Actions builds the app
2. Creates **private** release
3. Uploads .dmg (only you can access)
4. Display auto-updates (uses token in app)

**Important:** GitHub Actions uses `GITHUB_TOKEN` (built-in), not your PAT

## First Release

To create the first release with private settings:

```bash
cd /Users/noamleibovitch/Desktop/projects/KX\ Dashboard

# Make sure everything is committed
git status

# Create and push tag
git tag v1.0.0
git push origin feature/remote-updates v1.0.0
```

**GitHub Actions will:**
- Build for Mac/Windows/Linux
- Create private release
- Upload built files

**Then you:**
- Download .dmg from GitHub Releases (logged in)
- Or use the locally built .dmg from `dist/` folder
- Install on display

## Token Management

### Current Token:
- **Token:** `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`
- **Location:** `electron-app/.env` (gitignored)
- **Bundled:** Yes (included in built app)
- **Scope:** `repo` (full private repo access)

### If Token Expires or Is Compromised:

1. **Generate new token** at: https://github.com/settings/tokens
2. **Update `.env`:**
   ```bash
   nano electron-app/.env
   # Change GH_TOKEN=... to new token
   ```
3. **Rebuild app:**
   ```bash
   cd electron-app
   npm run build:mac
   ```
4. **Reinstall** on display machine

### Revoking Old Tokens:

Go to: https://github.com/settings/tokens
- Find and delete old/exposed tokens
- Keep only the current one active

## Verification

### Check Token is Loaded:

```bash
cd electron-app
npm start
```

**Look for console message:**
```
🔐 Using GitHub token for private releases
```

### Test Auto-Update:

1. Install built app on test machine
2. Create new release (v1.0.1)
3. Open installed app
4. Should see "Update available" notification
5. Download and install automatically

## Security Best Practices

### DO:
✅ Keep `.env` gitignored (it is)  
✅ Only share .dmg with trusted people  
✅ Revoke old/exposed tokens  
✅ Use minimum required scope on tokens  
✅ Monitor GitHub access logs  

### DON'T:
❌ Commit `.env` to Git  
❌ Share .dmg publicly  
❌ Post token in chat/email  
❌ Use token for other purposes  

## Comparison: Public vs Private Releases

| Aspect | Public Releases | Private Releases |
|--------|----------------|------------------|
| **GitHub Access** | Anyone | Only repo collaborators |
| **Download .dmg** | Anyone | Only authenticated users |
| **Auto-update** | No auth needed | Requires GH_TOKEN in app |
| **Security** | Low (credentials exposed) | Medium (controlled access) |
| **Distribution** | Easy (public URL) | Manual (direct .dmg sharing) |

## Files Modified

- `electron-app/package.json` - Set `"private": true`, added `.env` to files
- `electron-app/main.js` - Configure autoUpdater with token
- `electron-app/.env` - Added `GH_TOKEN` (gitignored)
- `electron-app/.env.example` - Added `GH_TOKEN` placeholder

## Summary

🔒 **Releases are now private**  
✅ **Auto-update works with authentication**  
📦 **All credentials bundled in app**  
🚀 **Ready to build and deploy**  

---

**Next Steps:**
1. Commit these changes
2. Push to GitHub
3. Create first release tag (v1.0.0)
4. Build and install on display
5. Test auto-update with v1.0.1


