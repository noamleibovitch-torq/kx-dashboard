# Webhook Setup Instructions

## Overview

The KX Dashboard app now sends the SQL query as a parameter in the webhook request. This allows you to update the query from the app without modifying the Torq workflow.

## Changes Required in Torq

The webhook now receives:
```json
{
  "days_back": 7,
  "dashboard_query": "WITH raw_priority AS (SELECT JSON_QUERY_ARRAY('[\"Torq App User\",\"Channel Partner\",\"Torq employees\"]') AS arr) ..."
}
```

**Important:** The `dashboard_query` is pre-processed and contains actual values (timestamps, days_back, segment priorities) - NOT Torq template variables. It's ready to execute directly in BigQuery.

### Update Your Torq Workflow

1. **Accept the `dashboard_query` parameter** in your webhook trigger
2. **Execute it directly in BigQuery** - no template substitution needed
3. **Return the results as JSON**

### Example Torq Workflow Structure

```
Webhook Trigger
  ↓ (receives days_back and dashboard_query)
  ↓
BigQuery Step - Execute Query
  ↓ (query: {{ $.trigger.dashboard_query }})
  ↓ (the query is ready to run - contains actual values)
  ↓
Return Results
  ↓ (return the query results as-is)
```

### BigQuery Step Configuration

In your BigQuery integration step:
- **Query**: `{{ $.trigger.dashboard_query }}`
- **No parameters needed** - the app already substituted all values
- **Just execute and return** the results

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

