# Documentation Dashboard Webhook Setup

This document outlines how to configure your Torq workflow to fetch Documentation metrics (Support Volume + AI Agent Utilization).

## Overview

The Documentation dashboard queries BigQuery for monthly metrics based on a `month_start` parameter. Unlike the Academy dashboard which uses `days_back`, this uses monthly windows.

## 1. Webhook Trigger Configuration

The webhook receives a `POST` request with `Content-Type: text/plain` containing:

```json
{
  "month_start": "2025-10-01"
}
```

And an `auth` header:
```
auth: i9HpRTZLL4sq7AJW1qmpKqZsb85qB1Su9vcyvCayidk
```

## 2. BigQuery Step Configuration

**BigQuery Step Settings:**

- **Query Type**: Standard SQL
- **Query**: Use the query from `sql/documentation_dashboard.sql` or `electron-app/queries.js` (DOCUMENTATION_DASHBOARD_QUERY)

The query expects one template variable:
- `{{ $.month_start.result }}` - The first day of the month to analyze (format: `YYYY-MM-DD`)

**Example:**
```sql
WITH params AS (
  SELECT
    DATE('{{ $.month_start.result }}') AS target_month_start,
    DATE_ADD(DATE('{{ $.month_start.result }}'), INTERVAL 1 MONTH) AS target_month_end
),
...
```

## 3. Expected Output Structure

The BigQuery query returns a single row with this structure:

```json
{
  "documentation": {
    "window": {
      "start_date": "2025-10-01",
      "end_date": "2025-11-01",
      "month": "2025-10"
    },
    "support": {
      "active_users": 896,
      "tickets_amount": 191,
      "tickets_volume_percent": 21.32,
      "total_conversations": 794
    },
    "ai_agent": {
      "adoption_rate_percent": 25.00,
      "deflection_rate_percent": 93.70,
      "chatbot_users": 224,
      "conversations_no_escalations": 744,
      "total_conversations_for_deflection": 794
    }
  }
}
```

## 4. Month Start Calculation

The app will calculate `month_start` based on the selected period:

- **7 days**: First day of current month
- **30 days**: First day of current month
- **Quarter (Q)**: First day of current quarter (Jan 1, Apr 1, Jul 1, Oct 1)
- **Year-to-Date (YTD)**: January 1 of current year

For example, if today is November 20, 2025:
- 7d/30d → `2025-11-01`
- Q → `2025-10-01` (Q4)
- YTD → `2025-01-01`

## 5. Workflow Response

Ensure your workflow returns the BigQuery result directly as JSON:

```json
{
  "documentation": {
    "window": {...},
    "support": {...},
    "ai_agent": {...}
  }
}
```

## 6. Testing

You can test the query in BigQuery console by replacing the template variable:

```sql
-- Replace this:
DATE('{{ $.month_start.result }}')

-- With a test date:
DATE('2025-10-01')
```

## 7. Data Sources

The query uses these BigQuery tables:
- `stackpulse-production.bi.fact_active_users` - Active user data
- `stackpulse-production.kx_dataset.agg_monthly_zendesk_tickets` - Zendesk ticket aggregations
- `stackpulse-production.kx_dataset.agg_deflection_rate` - Intercom chatbot deflection metrics
- `stackpulse-production.kx_dataset.fact_intercom_chatbot` - Intercom chatbot usage

## 8. Metrics Explanation

**Support Volume:**
- **Active users**: Count of distinct non-Torq users in the month
- **Tickets amount**: Total Zendesk tickets created
- **Tickets volume**: Percentage of active users who created tickets
- **Total conversations**: Total Intercom conversations

**AI Agent Utilization:**
- **Adoption rate**: Percentage of active users who interacted with chatbot
- **Deflection rate**: Percentage of conversations resolved without human escalation

---

## Integration Notes

- The Documentation view currently uses mock data in `renderer.js` (`getMockDocumentationData()`)
- To connect real data, update `api.js` to add a `fetchDocumentation()` method
- The app will need to calculate the appropriate `month_start` based on the selected period

