# Development Guide

## Local Data Caching

To speed up development, the dashboard implements automatic caching of webhook responses.

### How It Works

1. **Automatic Caching**: Every successful webhook response is cached in `localStorage`
2. **Cache Key**: Based on:
   - Days back parameter
   - Documentation period (MTD/Previous Month)
   - Hash of BigQuery queries
3. **Cache Duration**: 1 hour
4. **Smart Invalidation**: Cache automatically invalidates when:
   - Queries are modified (detected via hash change)
   - Cache expires (after 1 hour)
   - Manually cleared

### Benefits

- ⚡ **Instant Load**: Subsequent page loads are nearly instant
- 💰 **Reduced Costs**: Fewer BigQuery executions during development
- 🚀 **Faster Iteration**: Test UI changes without waiting for webhook

### Cache Control

#### Enable/Disable Caching
In `electron-app/api.js`:
```javascript
this.enableCache = true; // Set to false to disable caching
```

#### Force Refresh (Clear Cache)

**Option 1: Click Cache Icon**
- Click on the cache stats in footer: `💾 3 cached (216KB)`
- Tooltip appears: "Click to force refresh from webhook"
- Instantly clears cache and fetches fresh data

**Option 2: Keyboard Shortcut**
- Press **`Cmd+Shift+R`** (Mac) or **`Ctrl+Shift+R`** (Windows)
- Same effect: clears cache and reloads from webhook

#### Console Indicators
- `✅ Using cached data (age: X seconds)` - Data loaded from cache
- `🌐 Fetching fresh data from webhook...` - Making API call
- `💾 Data cached for future use` - Response saved to cache
- `🔄 Cache info clicked - forcing refresh from webhook` - Clicked on cache icon
- `🔄 Force refresh (keyboard): clearing cache and reloading data` - Used keyboard shortcut

### How Cache Invalidation Works

The cache automatically invalidates when you modify BigQuery queries because:
1. A hash is computed from the query strings
2. Hash is included in the cache key
3. When queries change, the hash changes → new cache key → cache miss → fresh fetch

**This means**: You can safely modify queries without worrying about stale cached data!

### Storage Location

- **Cache Storage**: Browser `localStorage`
- **Key Format**: `dashboard_cache_{daysBack}_{docPeriod}_{academyHash}_{docHash}`
- **Max Age**: 1 hour (3600000 ms)

### Troubleshooting

**Cache not working?**
- Check console for `enableCache` status
- Verify `localStorage` is not full
- Check for console errors

**Seeing stale data?**
- Click the cache icon (💾) in footer OR press `Cmd+Shift+R` to force refresh
- Cache should auto-invalidate after 1 hour
- Check console for cache age

**localStorage full?**
- Old caches are automatically cleaned when quota exceeded
- Manual clear: `localStorage.clear()` in console

