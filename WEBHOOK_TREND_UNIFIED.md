# Webhook Update: Trend Data Now in Documentation Query

## ✅ **What Changed**

The **12-month trend data** is now **included in the documentation query** itself, so you **don't need a separate BigQuery step** for trend data.

## 📦 **Simplified Webhook Flow**

### Before (Old - 3 separate queries):
```json
{
  "days_back": 7,
  "month_start": "2025-11-01",
  "dashboard_query": "SELECT ...",      // Academy
  "documentation_query": "SELECT ...",   // Documentation metrics
  "trend_query": "SELECT ..."            // Trend (separate)
}
```

### Now (New - 2 queries, trend included):
```json
{
  "days_back": 7,
  "month_start": "2025-11-01",
  "dashboard_query": "SELECT ...",      // Academy
  "documentation_query": "SELECT ..."   // Documentation + Trend (combined)
}
```

---

## 🔧 **What You Need to Do in Torq**

### ✅ **Good News: Nothing Extra to Add!**

If you already have the **documentation query step**, it now automatically includes trend data.

### **Your Torq Workflow Should Have:**

1. **Step: Parse Webhook Body**
   - Extract: `days_back`, `month_start`, `dashboard_query`, `documentation_query`

2. **Step: Run Academy Query** (BigQuery)
   - Query: `{{ $.event.dashboard_query }}`
   - Output: `enrollments_result`

3. **Step: Transform Labs Data** (JQ)
   - Process labs snapshots
   - Output: `labs_result`

4. **Step: Run Documentation Query** (BigQuery)
   - Query: `{{ $.event.documentation_query }}`
   - Output: `documentation_result`
   - ✨ **This now includes trend data automatically!**

5. **Step: Merge Results** (JQ)
   ```jq
   {
     enrollments: .enrollments_result,
     labs: (.labs_result // {}),
     documentation: .documentation_result.documentation
   }
   ```

---

## 📊 **Expected Response Structure**

The documentation object now includes **two trend arrays**:

```json
{
  "enrollments": { ... },
  "labs": { ... },
  "documentation": {
    "window": { ... },
    "support": { ... },
    "support_previous": { ... },
    "support_delta": { ... },
    "ai_agent": { ... },
    "ai_agent_previous": { ... },
    "ai_agent_delta": { ... },
    "trend": [
      {
        "month": "2024-11",
        "total_active_users": 1100,
        "total_tickets_amount": 200,
        "total_conversations": 820
      },
      {
        "month": "2024-12",
        "total_active_users": 1150,
        "total_tickets_amount": 210,
        "total_conversations": 850
      }
      // ... 11 more months (13 total)
    ],
    "engagement_trend": [
      {
        "month": "2024-11",
        "adoption_rate_percent": 25.06,
        "deflection_rate_percent": 91.56,
        "tickets_volume_percent": 18.21
      },
      {
        "month": "2024-12",
        "adoption_rate_percent": 15.86,
        "deflection_rate_percent": 93.60,
        "tickets_volume_percent": 22.90
      }
      // ... 11 more months (13 total)
    ]
  }
}
```

---

## ✅ **Benefits of This Approach**

1. **Simpler Workflow**: One less BigQuery step to maintain
2. **Faster Execution**: Fewer BigQuery calls = faster response
3. **Lower Costs**: Fewer BigQuery queries = reduced costs
4. **Consistent Data**: Trend and metrics from same query execution
5. **Atomic Operations**: Trend is always included with documentation data

---

## 🧪 **Testing**

After your workflow is running:

1. **Clear cache** in dashboard: Click the `💾` icon in footer
2. **Watch console** for:
   ```
   🌐 Fetching fresh data from webhook...
   📋 Documentation query includes 12-month trend data
   📈 Total Numbers Trend in response: 13 items ✅
   📈 Rates Trend in response: 13 items ✅
   📊 First total numbers item: {month: "2024-11", total_active_users: 1100, ...}
   📊 First rates item: {month: "2024-11", adoption_rate_percent: 25.06, ...}
   ✅ Rendering total numbers trend chart with 13 data points
   ✅ Rendering rates trend chart with 13 data points
   ```

3. **Check the charts**: You should see **two** line charts:
   - **Total Numbers Trend**: Total Active Users, Total Tickets Amount, Total Conversations (absolute numbers)
   - **Rates Trend**: Adoption Rate %, Deflection Rate %, Tickets Volume % (percentages, 0-100%)

---

## 📝 **SQL Query Details**

The documentation query now includes **two trend CTEs**:

### **1. Total Numbers Trend (trend_data)**

```sql
-- Total numbers trend: absolute counts (12 months)
trend_data AS (
  SELECT
    FORMAT_DATE('%Y-%m', fact_active_users.month_start) AS month,
    COUNT(DISTINCT fact_active_users.profile_id_config) AS total_active_users,
    -- ... total_tickets_amount calculation ...
    -- ... total_conversations calculation ...
  FROM `stackpulse-production.bi.fact_active_users` AS fact_active_users
  -- ... joins ...
  WHERE 
    (fact_active_users.is_torq) = 0 
    AND fact_active_users.month_start >= DATE_ADD(DATE_TRUNC(CURRENT_DATE('UTC'), MONTH), INTERVAL -12 MONTH)
    AND fact_active_users.month_start < DATE_ADD(DATE_TRUNC(CURRENT_DATE('UTC'), MONTH), INTERVAL 1 MONTH)
  GROUP BY 1
  ORDER BY 1 ASC
)
```

### **2. Engagement Trend (engagement_trend_data) - Percentages**

```sql
-- Engagement trend: percentages (adoption, deflection, tickets volume) - 12 months
engagement_trend_data AS (
  SELECT
    FORMAT_DATE('%Y-%m', fact_active_users.month_start) AS month,
    -- Adoption Rate: (chatbot users / total active users) * 100
    ROUND(
      CASE 
        WHEN COUNT(DISTINCT fact_active_users.profile_id_config) > 0 
        THEN (COUNT(DISTINCT fact_intercom_chatbot.profile_id) * 100.0 / COUNT(DISTINCT fact_active_users.profile_id_config))
        ELSE 0 
      END, 2
    ) AS adoption_rate_percent,
    -- Deflection Rate: (conversations without escalations / total conversations) * 100
    ROUND(...calculation..., 2) AS deflection_rate_percent,
    -- Tickets Volume: (tickets / active users) * 100
    ROUND(...calculation..., 2) AS tickets_volume_percent
  FROM `stackpulse-production.bi.fact_active_users` AS fact_active_users
  -- ... joins ...
  WHERE 
    (fact_active_users.is_torq) = 0 
    AND fact_active_users.month_start >= DATE_ADD(DATE_TRUNC(CURRENT_DATE('UTC'), MONTH), INTERVAL -12 MONTH)
    AND fact_active_users.month_start < DATE_ADD(DATE_TRUNC(CURRENT_DATE('UTC'), MONTH), INTERVAL 1 MONTH)
  GROUP BY 1
  ORDER BY 1 ASC
)
```

And the final SELECT includes **both trend arrays**:

```sql
-- Total numbers trend
ARRAY(
  SELECT AS STRUCT
    month,
    total_active_users,
    total_tickets_amount,
    total_conversations
  FROM trend_data
) AS trend,

-- Rates trend (percentages)
ARRAY(
  SELECT AS STRUCT
    month,
    adoption_rate_percent,
    deflection_rate_percent,
    tickets_volume_percent
  FROM engagement_trend_data
) AS engagement_trend
```

---

## 🔄 **Migration from Old Setup**

If you already added a separate `trend_query` step:

1. **Keep it or remove it** - it won't hurt if it stays
2. **Remove from merge step**: Delete any `trend: (.trend_result // [])` references
3. **Simplify merge**: Just use `documentation: .documentation_result.documentation`
4. **Clear cache** in dashboard to fetch fresh data

---

## 🐛 **Troubleshooting**

### "Trend is still MISSING ❌"

**Check:**
1. Is your documentation query step using `{{ $.event.documentation_query }}`?
2. Is the merge step using `.documentation_result.documentation`?
3. Clear cache in dashboard (click 💾 icon)
4. Check console for BigQuery errors

### "Query timeout"

The trend query adds 12 months of data. If it times out:
- Check BigQuery permissions on all tables
- Verify indexes exist on join columns
- Consider increasing webhook timeout in Torq

### "Seeing old trend data"

- Clear cache: Click 💾 icon or press `Cmd+Shift+R`
- Cache invalidates automatically when query changes

---

## 📚 **Related Files**

- **Query**: `electron-app/queries.js` → `DOCUMENTATION_DASHBOARD_QUERY`
- **API**: `electron-app/api.js` → `fetchDashboard()`
- **Renderer**: `electron-app/renderer.js` → `renderDocTrendChart()`
- **Original docs**: See `CACHE_AND_TREND_UPDATE.md` for old separate approach

---

**That's it!** The trend data is now seamlessly integrated into the documentation query. Just make sure your Torq workflow is using the updated query and you're all set! 🚀

