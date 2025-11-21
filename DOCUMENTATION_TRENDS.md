# Documentation Trend Charts

## Overview

The Documentation view includes **two 12-month trend charts** that provide different perspectives on the data:

---

## 📊 Chart 1: Total Numbers Trend

**Purpose**: Shows absolute counts and volumes over time

**Metrics:**
1. **Total Active Users** (green line) - `#00FF88`
   - Total number of active users per month
   
2. **Total Tickets Amount** (red line) - `#FF6B6B`
   - Total number of support tickets per month
   
3. **Total Conversations** (cyan line) - `#00D9FF`
   - Total number of Intercom conversations per month

**Y-Axis**: Absolute numbers (e.g., 1190, 800, 200)

**Use Case**: Track overall volume trends and growth

---

## 📈 Chart 2: Rates Trend (Percentages)

**Purpose**: Shows performance metrics as percentages

**Metrics:**
1. **Intercom Adoption Rate** (magenta/pink line) - `#FF006E`
   - Formula: `(chatbot users / total active users) × 100`
   - Typical range: 15-30%
   
2. **Deflection Rate** (cyan line) - `#00D9FF`
   - Formula: `(conversations without escalations / total conversations) × 100`
   - Typical range: 91-97%
   
3. **Tickets Volume** (dark blue line) - `#3D5A80`
   - Formula: `(tickets / active users) × 100`
   - Typical range: 15-25%

**Y-Axis**: Percentages from 0% to 100%

**Use Case**: Monitor efficiency, adoption, and support load relative to user base

---

## 📋 Data Structure

### SQL Query Returns:

```sql
SELECT
  STRUCT(
    -- ... other documentation fields ...
    
    -- Chart 1: Total Numbers
    ARRAY(
      SELECT AS STRUCT
        month,                    -- '2024-11'
        total_active_users,       -- 1190
        total_tickets_amount,     -- 190
        total_conversations       -- 801
      FROM trend_data
    ) AS trend,
    
    -- Chart 2: Rates
    ARRAY(
      SELECT AS STRUCT
        month,                    -- '2024-11'
        adoption_rate_percent,    -- 22.44
        deflection_rate_percent,  -- 97.00
        tickets_volume_percent    -- 15.97
      FROM engagement_trend_data
    ) AS engagement_trend
  ) AS documentation;
```

### JSON Response Format:

```json
{
  "documentation": {
    "window": { ... },
    "support": { ... },
    "ai_agent": { ... },
    "trend": [
      {
        "month": "2024-11",
        "total_active_users": 1100,
        "total_tickets_amount": 200,
        "total_conversations": 820
      }
      // ... 12 more months
    ],
    "engagement_trend": [
      {
        "month": "2024-11",
        "adoption_rate_percent": 25.06,
        "deflection_rate_percent": 91.56,
        "tickets_volume_percent": 18.21
      }
      // ... 12 more months
    ]
  }
}
```

---

## 🎨 Visual Design

### Chart 1: Total Numbers
- **Chart Type**: Line chart
- **Border Width**: 2px
- **Tension**: 0.4 (smooth curves)
- **Y-Axis**: Dynamic scale based on data
- **Tooltip**: "Total Active Users: 1,190"

### Chart 2: Rates
- **Chart Type**: Line chart
- **Border Width**: 2px
- **Tension**: 0.4 (smooth curves)
- **Y-Axis**: Fixed 0-100% scale
- **Tooltip**: "Intercom Adoption Rate: 25.06%"

Both charts:
- Dark mode compatible
- Interactive hover tooltips
- Legend at top
- 12 months of data (rolling)

---

## 📊 Key Insights from Each Chart

### Total Numbers Chart Shows:
- ✅ Growth or decline in user base
- ✅ Volume trends in support requests
- ✅ Overall engagement levels
- ✅ Seasonal patterns in usage

### Rates Chart Shows:
- ✅ Chatbot adoption effectiveness
- ✅ Support deflection efficiency
- ✅ Support load per user
- ✅ Quality of self-service experience

---

## 🔧 Implementation Details

### Files:
- **SQL Query**: `electron-app/queries.js`
  - `trend_data` CTE (total numbers)
  - `engagement_trend_data` CTE (rates)
  
- **Rendering**: `electron-app/renderer.js`
  - `renderDocTrendChart()` (total numbers)
  - `renderDocEngagementChart()` (rates)
  
- **HTML**: `electron-app/index.html`
  - `<canvas id="docTrendChart">`
  - `<canvas id="docEngagementChart">`

### Data Flow:
1. App sends `documentation_query` to Torq webhook
2. BigQuery executes both CTEs
3. Returns arrays in `trend` and `engagement_trend` fields
4. Renderer creates two Chart.js instances
5. Charts display side-by-side in Documentation view

---

## 🧪 Testing

**To verify both charts:**
1. Clear cache (click 💾 icon in footer)
2. Switch to Documentation tab
3. Scroll to bottom
4. Check console for:
   ```
   📈 Total Numbers Trend in response: 13 items ✅
   📈 Rates Trend in response: 13 items ✅
   ✅ Rendering total numbers trend chart with 13 data points
   ✅ Rendering rates trend chart with 13 data points
   ```

**Expected Output:**
- First chart: Absolute numbers (hundreds to thousands)
- Second chart: Percentages (0-100%)
- Both charts: 13 data points (12 months + current month)

---

## 💡 Usage Tips

**Compare both charts to:**
- Identify if growth in users correlates with support needs
- See if adoption rate improvements affect deflection rate
- Understand if ticket volume is growing faster than user base
- Spot trends that absolute numbers alone don't reveal

**Example Analysis:**
- Total users increased 20%, but tickets only increased 5%
- → Indicates improved self-service or better documentation
- Deflection rate improved from 92% to 97%
- → Confirms chatbot is handling more queries successfully

---

## 📝 Summary

**Chart 1**: Absolute volumes - "How many?"
**Chart 2**: Relative metrics - "How well?"

Together, these charts provide a complete picture of documentation and support trends over the past 12 months.

