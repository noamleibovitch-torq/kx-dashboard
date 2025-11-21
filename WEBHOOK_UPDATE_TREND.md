# Webhook Update: Adding Documentation Trend Chart

## Overview

The dashboard now sends a **third query** (`trend_query`) to fetch 12-month trend data for the Documentation view.

## Webhook Body Structure

The webhook now receives **3 queries**:

```json
{
  "days_back": 7,
  "month_start": "2025-11-01",
  "dashboard_query": "SELECT ...",      // Academy query
  "documentation_query": "SELECT ...",   // Documentation metrics
  "trend_query": "SELECT ..."            // NEW: 12-month trend
}
```

## Torq Workflow Updates

### Step 1: Add BigQuery Step for Trend Query

**Step Name:** `run_trend_query`  
**Step Type:** Google BigQuery > Run Query  
**Query:** Use `{{ $.event.trend_query }}` (passed from webhook body)  
**Output Variable:** `trend_result`

### Step 2: Update Merge Step

The final merge step should now combine **3 BigQuery results**:

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
    trend: (.trend_result // [])
  }
}
```

## Expected Trend Query Output

The trend query returns an array of monthly data:

```json
[
  {
    "month": "2024-12",
    "active_users": 1190,
    "tickets_amount": 190,
    "chatbot_conversations": 224,
    "total_conversations": 801
  },
  {
    "month": "2025-01",
    "active_users": 1250,
    "tickets_amount": 200,
    "chatbot_conversations": 240,
    "total_conversations": 850
  }
  // ... more months
]
```

## Workflow Order

1. **Parse Webhook Body** - Extract `days_back`, `month_start`, `dashboard_query`, `documentation_query`, `trend_query`
2. **Run Academy Query** - BigQuery step using `dashboard_query` → `enrollments_result`
3. **Run Labs Transform** - JQ step to process labs data → `labs_result`
4. **Run Documentation Query** - BigQuery step using `documentation_query` → `documentation_result`
5. **Run Trend Query** - BigQuery step using `trend_query` → `trend_result` (NEW)
6. **Merge Results** - JQ step combining all 4 results into final response

## Testing

Test the webhook with:

```bash
curl -X POST https://hooks.torq.io/v1/webhooks/.../sync \
  -H "Content-Type: text/plain" \
  -H "auth: YOUR_SECRET" \
  -d '{
    "days_back": 7,
    "month_start": "2025-11-01",
    "dashboard_query": "...",
    "documentation_query": "...",
    "trend_query": "SELECT (FORMAT_DATE(...)) AS month, ..."
  }'
```

Expected response should include `documentation.trend` array.

## Chart Display

The trend chart shows:
- **Active Users** (green line)
- **Tickets Amount** (red line)
- **Chatbot Conversations** (cyan line)
- **Total Conversations** (yellow line)

All metrics are displayed over the last 12 months.

