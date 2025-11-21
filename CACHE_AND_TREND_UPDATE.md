# Cache & Trend Updates

## ✅ Changes Made

### 1. **Removed Mock Data**
- ❌ Removed `useMockData` flag - app **always** uses webhook now
- ✅ Mock data functions still exist for reference but are never called
- ✅ All data now comes from real Torq webhook

### 2. **Improved Caching System**

#### Smart Cache with Auto-Invalidation
- ✅ Cache key includes **query hashes** - automatically invalidates when SQL changes
- ✅ Configurable TTL: `1 hour` (set in `cacheExpirationMs`)
- ✅ Manual clear: **Click cache icon** `💾 3 cached (216KB)` in footer OR press **`Cmd+Shift+R`** (Mac) / **`Ctrl+Shift+R`** (Windows)

#### Enhanced Logging
The console now shows:
```
💾 No cache found for key: dashboard_cache_7_mtd_abc123_def456_ghi789
🌐 Fetching fresh data from webhook...
🌐 Webhook response received
📦 Response structure: ["enrollments", "labs", "documentation"]
📊 Documentation keys: ["window", "support", "ai_agent", "trend"]
📈 Trend in response: 13 items
📊 First trend item: {month: "2024-11", active_users: 850, ...}
📊 Last trend item: {month: "2025-11", active_users: 896, ...}
```

Or if trend is missing:
```
📈 Trend in response: MISSING ❌
⚠️ Trend array is empty or missing! Check Torq workflow:
   1. Ensure trend_query BigQuery step exists
   2. Verify merge step includes: trend: (.trend_result // [])
   3. Check BigQuery permissions for trend query
```

#### Cache Statistics
- ✅ Last updated footer shows: `Updated: 10:30:45 AM | 💾 2 cached (1,234KB)`
- 🖱️ **NEW**: Cache icon is **clickable** - forces immediate webhook refresh
- 💡 Hover over cache icon to see tooltip: "Click to force refresh from webhook"
- ✅ Console shows cache age and size on every load
- ✅ `getCacheStats()` method provides detailed cache info

### 3. **Trend Chart Implementation**

#### What Was Added
- ✅ SQL query: `DOCUMENTATION_TREND_QUERY` (12 months of data)
- ✅ API sends `trend_query` to webhook alongside `dashboard_query` and `documentation_query`
- ✅ Chart component: Line chart with 4 metrics (Active Users, Tickets, Chatbot, Total Conversations)
- ✅ Debugging: Extensive console logging for trend data flow

#### Current Status
⚠️ **Trend is empty because Torq workflow needs updating**

The app is sending the trend query but the webhook isn't processing it yet.

---

## 🔧 What You Need to Do in Torq

### Step 1: Add BigQuery Step for Trend Query

1. **Open your Torq workflow**: `78f77a59-d2ee-4015-afee-3c8043bb6b31`
2. **Add a new step** after the documentation query step:
   - **Type**: Google BigQuery > Run Query
   - **Name**: `run_trend_query`
   - **Query**: `{{ $.event.trend_query }}`
   - **Output Variable**: `trend_result`

### Step 2: Update Merge Step

Update your final JQ merge step to include the trend data:

```jq
{
  enrollments: .enrollments_result,
  labs: (.labs_result // {
    window: {},
    today: {},
    current: {},
    previous: {},
    delta: {},
    trend: []
  }),
  documentation: {
    window: (.documentation_result.documentation.window // {}),
    support: (.documentation_result.documentation.support // {}),
    support_previous: (.documentation_result.documentation.support_previous // {}),
    support_delta: (.documentation_result.documentation.support_delta // {}),
    ai_agent: (.documentation_result.documentation.ai_agent // {}),
    ai_agent_previous: (.documentation_result.documentation.ai_agent_previous // {}),
    ai_agent_delta: (.documentation_result.documentation.ai_agent_delta // {}),
    trend: (.trend_result // [])  # ← ADD THIS LINE
  }
}
```

### Step 3: Test

After updating the workflow:

1. **Clear cache**: Press `Cmd+Shift+R` in the dashboard
2. **Watch console**: Look for trend logging messages
3. **Expected output**:
   ```
   📈 Trend in response: 13 items
   ✅ Rendering trend chart with 13 data points
   ```

---

## 📊 Expected Trend Query Output

The trend query should return an array like this:

```json
[
  {
    "month": "2024-11",
    "active_users": 850,
    "tickets_amount": 180,
    "chatbot_conversations": 200,
    "total_conversations": 750
  },
  {
    "month": "2024-12",
    "active_users": 870,
    "tickets_amount": 175,
    "chatbot_conversations": 210,
    "total_conversations": 760
  },
  ...
]
```

The chart will display all 4 metrics as lines over time.

---

## 🐛 Troubleshooting

### "Trend is empty" or "MISSING ❌"

**Check console for these messages:**

1. `📈 Trend in response: MISSING ❌`
   - → Torq workflow isn't sending trend data
   - → Check: Did you add the trend_query step?
   - → Check: Did you update the merge step?

2. `📈 Trend in cache: missing`
   - → Clear cache with `Cmd+Shift+R`
   - → Old cached data doesn't have trend

3. `googleapi: Error 403: Access Denied`
   - → BigQuery permissions issue
   - → Ensure service account has access to all tables in trend query

### "Cache not clearing"

```bash
# Open dev console and run:
localStorage.clear()
# Then reload app
```

### "Query seems wrong"

The trend query is in `electron-app/queries.js` as `DOCUMENTATION_TREND_QUERY`.
You can copy it directly from there to Torq.

---

## 🚀 Testing Without Webhook Updates

If you want to test the chart before updating Torq:

1. Open `electron-app/api.js`
2. Find line ~7: `this.useMockData = false;`
3. Change to: `this.useMockData = true;` (temporarily)
4. Reload app
5. You'll see a 13-month mock trend chart
6. Don't forget to change it back to `false` when done!

---

## 📝 Summary

**What works now:**
- ✅ Webhook integration (no mock data)
- ✅ Smart caching with auto-invalidation
- ✅ Cache statistics display
- ✅ Comprehensive logging for debugging
- ✅ Manual cache clear (Cmd+Shift+R)
- ✅ Trend query generation and sending

**What needs Torq update:**
- ⏳ Trend query BigQuery step
- ⏳ Merge step to include trend data

Once you update the Torq workflow, the trend chart will work immediately!

