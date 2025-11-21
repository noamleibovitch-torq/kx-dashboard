# Webhook Setup Instructions

## Overview

The KX Dashboard app now sends the SQL query as a parameter in the webhook request. This allows you to update the query from the app without modifying the Torq workflow.

## Changes Required in Torq

The webhook now receives **BOTH** Academy and Documentation queries:
```json
{
  "days_back": 7,
  "month_start": "2025-11-01",
  "dashboard_query": "WITH raw_priority AS (SELECT ...) ... AS enrollments",
  "documentation_query": "WITH params AS (SELECT ...) ... AS documentation"
}
```

**Important:** 
- Both `dashboard_query` and `documentation_query` are pre-processed with actual values
- `dashboard_query` returns Academy metrics (enrollments, labs)
- `documentation_query` returns Documentation metrics (support, AI agent)
- Both are ready to execute directly in BigQuery

### Update Your Torq Workflow

1. **Accept both query parameters** in your webhook trigger
2. **Execute both queries in BigQuery** (two separate BigQuery steps)
3. **Merge the results** and return as JSON

### Example Torq Workflow Structure

```
Webhook Trigger
  ↓ (receives days_back, month_start, dashboard_query, documentation_query)
  ↓
BigQuery Step 1: Academy Data
  ↓ (query: {{ $.trigger.dashboard_query }})
  ↓ (returns enrollments and labs)
  ↓
BigQuery Step 2: Documentation Data
  ↓ (query: {{ $.trigger.documentation_query }})
  ↓ (returns documentation metrics)
  ↓
Merge Results (JQ or JSON Transform)
  ↓ (combine both outputs)
  ↓
Return Results
  ↓ { enrollments: {...}, labs: {...}, documentation: {...} }
```

### BigQuery Step Configuration

**Step 1 - Academy Data:**
- **Query**: `{{ $.trigger.dashboard_query }}`
- Returns: `enrollments` and `labs` data

**Step 2 - Documentation Data:**
- **Query**: `{{ $.trigger.documentation_query }}`  
- Returns: `documentation` data with `support` and `ai_agent` metrics

### What the App Does

The app automatically:
1. Gets the current timestamp
2. Substitutes `{{ $.now.result }}` → actual ISO timestamp
3. Substitutes `{{ $.days_back.result }}` → the selected days_back value
4. Substitutes `{{ $.segments.result }}` → default segment priority array
5. Sends the ready-to-execute query to your webhook

### Benefits

1. **No need to update Torq** when changing the SQL query - just edit `electron-app/queries.js`
2. **Version control** - SQL changes are tracked in Git
3. **Easier deployment** - Same workflow works for different dashboard versions

## Testing

1. Start the app: `cd electron-app && npm start`
2. The app will send the query in the webhook request
3. Check Torq logs to verify the query is received
4. Verify the response matches the expected structure

## SQL Query Location

The SQL query is stored in:
- **JavaScript**: `electron-app/queries.js` (used by the app)
- **Reference**: `sql/enrollments_dashboard.sql` (original SQL file for reference)

When updating the query, edit both files to keep them in sync.

