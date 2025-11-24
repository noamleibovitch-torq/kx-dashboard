# Versioning Guide

## Overview

The app version is displayed in the footer and automatically synced from `package.json`. This ensures consistency across the codebase and visible version tracking.

## Version Display

**Location:** Footer (bottom of screen)

**Format:** `v1.0.0`

**Source:** `electron-app/package.json` → `"version": "1.0.0"`

## How Versioning Works

### 1. Single Source of Truth

**File: `electron-app/package.json`**
```json
{
  "name": "kx-dashboard",
  "version": "1.0.0",
  ...
}
```

This version is used for:
- ✅ Footer display
- ✅ Auto-update version checking
- ✅ GitHub Release tags
- ✅ Built app metadata

### 2. Automatic Display

**On app startup:**
1. `renderer.js` calls `electronAPI.getAppVersion()`
2. `preload.js` forwards to main process
3. `main.js` returns `app.getVersion()` from package.json
4. Footer displays: `v1.0.0`

**No manual updates needed!** The version automatically updates from package.json.

## Updating Version for New Release

### Step 1: Update package.json

**File: `electron-app/package.json`**

```json
{
  "version": "1.0.1"  // ← Change this
}
```

### Step 2: Commit the Change

```bash
cd /Users/noamleibovitch/Desktop/projects/KX\ Dashboard

git add electron-app/package.json
git commit -m "Bump version to 1.0.1"
```

### Step 3: Create Git Tag

```bash
git tag v1.0.1
git push origin feature/remote-updates v1.0.1
```

**That's it!** Everything else updates automatically:
- ✅ Footer shows `v1.0.1`
- ✅ GitHub Actions builds version 1.0.1
- ✅ GitHub Release is tagged `v1.0.1`
- ✅ Auto-update detects new version

## Semantic Versioning

We use [Semantic Versioning](https://semver.org/): **MAJOR.MINOR.PATCH**

### Version Format: `MAJOR.MINOR.PATCH`

| Type | When to Increment | Example |
|------|-------------------|---------|
| **MAJOR** | Breaking changes, incompatible API changes | `1.0.0` → `2.0.0` |
| **MINOR** | New features, backward-compatible | `1.0.0` → `1.1.0` |
| **PATCH** | Bug fixes, backward-compatible | `1.0.0` → `1.0.1` |

### Examples:

**Bug Fix (Patch):**
- Fixed console not hiding
- Fixed data refresh
- **Version:** `1.0.0` → `1.0.1`

**New Feature (Minor):**
- Added remote configuration
- Added new dashboard view
- **Version:** `1.0.0` → `1.1.0`

**Breaking Change (Major):**
- Changed API structure
- Removed old features
- **Version:** `1.0.0` → `2.0.0`

## Version Checklist

Before each release, verify version is updated in:

- [x] `electron-app/package.json` - **Only file to edit** ✅
- [x] Footer display - **Automatic** ✅
- [x] Git tag - **Matches package.json** ✅
- [x] GitHub Release - **Automatic from tag** ✅

## Quick Release Process

### For Bug Fixes (Patch):

```bash
# 1. Update version
cd electron-app
# Edit package.json: "version": "1.0.1"

# 2. Commit
git add package.json
git commit -m "Fix: [describe fix] (v1.0.1)"

# 3. Tag and push
git tag v1.0.1
git push origin feature/remote-updates v1.0.1

# 4. GitHub Actions builds automatically
# 5. Display auto-updates
```

### For New Features (Minor):

```bash
# 1. Update version
# Edit package.json: "version": "1.1.0"

# 2. Commit
git add package.json
git commit -m "Feature: [describe feature] (v1.1.0)"

# 3. Tag and push
git tag v1.1.0
git push origin feature/remote-updates v1.1.0
```

## Version in Different Environments

| Environment | Version Source | Update Method |
|-------------|---------------|---------------|
| **Development** (`npm start`) | `package.json` | Hot reload |
| **Built App** (`.dmg`) | Embedded `package.json` | Rebuild required |
| **GitHub Release** | Git tag | Automatic from tag |
| **Auto-update Check** | Git tag | Automatic comparison |

## Verification

### Check Current Version:

**In Development:**
```bash
cd electron-app
npm start
# Look at footer: should show v1.0.0
```

**In Built App:**
```bash
cd electron-app
npm run build:mac
open dist/KX\ Dashboard-*.dmg
# Install and run
# Look at footer: should show v1.0.0
```

**Via Console:**
```bash
cd electron-app
npm start
# Open DevTools (Cmd+Option+I)
# Look for: "📦 App version: 1.0.0"
```

## Common Issues

### Footer shows wrong version

**Problem:** Footer displays old version after update

**Solution:**
1. Verify `package.json` has correct version
2. Restart app completely (Cmd+Q then reopen)
3. Clear app cache if needed

### Git tag doesn't match package.json

**Problem:** Created `v1.0.1` tag but package.json says `1.0.0`

**Solution:**
1. Delete the tag:
   ```bash
   git tag -d v1.0.1
   git push origin :refs/tags/v1.0.1
   ```
2. Update `package.json`
3. Recreate tag:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

### Auto-update not detecting new version

**Problem:** Display doesn't show "Update available"

**Solutions:**
1. Verify new version is **higher** than installed version
2. Check GitHub Release was created successfully
3. Check GitHub Release is not a draft
4. Restart display app to trigger update check

## Version History Template

Keep a changelog in your commits:

```bash
# v1.0.0 - Initial Release
git commit -m "Initial release with auto-update (v1.0.0)"

# v1.0.1 - Bug Fix
git commit -m "Fix: Console not hiding by default (v1.0.1)"

# v1.1.0 - New Feature
git commit -m "Feature: Add remote configuration (v1.1.0)"

# v2.0.0 - Breaking Change
git commit -m "Breaking: New API structure (v2.0.0)"
```

## Files Modified

- `electron-app/index.html` - Added version display element
- `electron-app/styles.css` - Added version styling
- `electron-app/renderer.js` - Added `loadAppVersion()` method
- Uses existing `electronAPI.getAppVersion()` from preload.js

## Summary

✅ **Single source:** Only edit `package.json`  
✅ **Automatic display:** Footer updates from package.json  
✅ **Automatic releases:** Git tag triggers build  
✅ **Automatic updates:** Display checks and installs  
✅ **No manual tracking:** Everything synced automatically  

**To release:** Update version in package.json → commit → tag → push

That's it! Everything else is automatic. 🚀


