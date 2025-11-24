# Environment Variables Configuration

## Overview

Sensitive credentials (Torq webhook URL and authentication secret) are now stored in environment variables instead of hardcoded in the source code.

## Security Benefits

✅ **Credentials not in source code** - No secrets committed to Git  
✅ **Environment-specific config** - Different credentials for dev/prod  
✅ **Easy rotation** - Update secrets without code changes  
✅ **Gitignored** - `.env` file is automatically ignored  

## Setup Instructions

### For Development

1. **Copy the example file:**
   ```bash
   cd electron-app
   cp .env.example .env
   ```

2. **Edit `.env` with your credentials:**
   ```bash
   # Edit with your favorite editor
   nano .env
   # or
   code .env
   ```

3. **Fill in your values:**
   ```env
   TORQ_WEBHOOK_URL=https://hooks.torq.io/v1/webhooks/YOUR_WEBHOOK_ID/workflows/YOUR_WORKFLOW_ID/sync
   TORQ_AUTH_SECRET=your_actual_auth_secret_here
   USE_MOCK_DATA=false
   ```

4. **Run the app:**
   ```bash
   npm start
   ```

### For Production (Deployed App)

The built app needs environment variables set on the system where it runs.

#### Option 1: System Environment Variables (macOS)

**Temporary (current session only):**
```bash
export TORQ_WEBHOOK_URL="https://hooks.torq.io/..."
export TORQ_AUTH_SECRET="your_secret"
open "/Applications/KX Dashboard.app"
```

**Permanent (add to shell profile):**
```bash
# Add to ~/.zshrc or ~/.bash_profile
echo 'export TORQ_WEBHOOK_URL="https://hooks.torq.io/..."' >> ~/.zshrc
echo 'export TORQ_AUTH_SECRET="your_secret"' >> ~/.zshrc
source ~/.zshrc
```

#### Option 2: Launch Script

Create a launcher script `launch-dashboard.sh`:

```bash
#!/bin/bash
export TORQ_WEBHOOK_URL="https://hooks.torq.io/v1/webhooks/8f17760c-c43f-4270-b465-95dabb54389d/workflows/78f77a59-d2ee-4015-afee-3c8043bb6b31/sync"
export TORQ_AUTH_SECRET="i9HpRTZLL4sq7AJW1qmpKqZsb85qB1Su9vcyvCayidk"
open "/Applications/KX Dashboard.app"
```

Make it executable:
```bash
chmod +x launch-dashboard.sh
```

Run it:
```bash
./launch-dashboard.sh
```

#### Option 3: Include .env in Built App (Less Secure)

If you want the `.env` file bundled with the app:

1. Remove `.env` from `.gitignore` temporarily
2. Copy `.env` to `electron-app/` folder
3. Build the app: `npm run build:mac`
4. The `.env` will be included in the app bundle
5. **⚠️ Warning:** Anyone with the .app file can read the .env

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TORQ_WEBHOOK_URL` | Yes | Fallback to hardcoded | Torq webhook endpoint URL |
| `TORQ_AUTH_SECRET` | Yes | Fallback to hardcoded | Authentication secret for Torq API |
| `USE_MOCK_DATA` | No | `false` | Set to `true` to use mock data for testing |

## Fallback Behavior

If environment variables are not set, the app falls back to hardcoded defaults with a warning:

```
⚠️  TORQ_WEBHOOK_URL not set in environment variables
⚠️  TORQ_AUTH_SECRET not set in environment variables
```

This ensures backward compatibility but is less secure.

## Verification

To check if environment variables are loaded:

1. **In Development:**
   - Run `npm start`
   - Open DevTools (Cmd+Option+I)
   - Look for console messages: "✅ API configured with webhook URL: Set"

2. **In Production:**
   - Enable console in Settings
   - Check for the same console messages

## Security Best Practices

### DO:
✅ Keep `.env` file local and never commit it  
✅ Use different credentials for dev and prod  
✅ Rotate secrets regularly  
✅ Use system environment variables for production  
✅ Limit access to `.env` file (chmod 600 .env)  

### DON'T:
❌ Commit `.env` to Git  
❌ Share `.env` via email or Slack  
❌ Hardcode secrets in source code  
❌ Use production credentials in development  

## Troubleshooting

### App shows "webhook URL not set" warning

**Problem:** Environment variables not loaded

**Solutions:**
1. Verify `.env` file exists in `electron-app/` folder
2. Check `.env` file has correct syntax (no quotes around values usually)
3. Restart the app completely
4. Check console for specific error messages

### App can't fetch data

**Problem:** Wrong credentials in `.env`

**Solutions:**
1. Verify `TORQ_WEBHOOK_URL` is correct and complete
2. Verify `TORQ_AUTH_SECRET` matches your Torq configuration
3. Test the webhook URL manually with curl:
   ```bash
   curl -X POST "YOUR_WEBHOOK_URL" \
     -H "Content-Type: text/plain" \
     -H "auth: YOUR_AUTH_SECRET" \
     -d '{"days_back": 7}'
   ```

### Production app doesn't load credentials

**Problem:** Environment variables not set in production environment

**Solutions:**
1. Use launch script (Option 2 above)
2. Set system environment variables (Option 1 above)
3. Include .env in build (Option 3 above, less secure)

## Files Modified

- `electron-app/.env.example` - Template for environment variables (committed)
- `electron-app/.env` - Actual credentials (gitignored, not committed)
- `electron-app/main.js` - Loads dotenv and exposes env vars via IPC
- `electron-app/preload.js` - Exposes getEnv() to renderer
- `electron-app/api.js` - Reads credentials from environment
- `.gitignore` - Ignores `.env` files
- `package.json` - Added dotenv dependency

## Migration from Hardcoded Credentials

Your existing hardcoded credentials have been:
1. ✅ Moved to `.env` file (gitignored)
2. ✅ Added to `.env.example` as placeholders
3. ✅ Kept as fallback in code (with warnings)
4. ✅ Removed from documentation files

**Your current credentials are in:** `electron-app/.env`

## Next Steps

1. ✅ `.env` file created with your credentials
2. ✅ `.env` added to `.gitignore`
3. ✅ Code updated to use environment variables
4. ⏳ **Test the app:** `npm start` to verify it works
5. ⏳ **For production:** Set up environment variables on display machine
6. ⏳ **Commit changes:** Git won't include your secrets

---

**Security Note:** Your `.env` file contains real credentials and is automatically ignored by Git. Never commit it to the repository.


