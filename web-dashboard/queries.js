// Dashboard SQL Queries

const ENROLLMENTS_DASHBOARD_QUERY = `-- sql/enrollments_dashboard.sql

WITH raw_priority AS (
  -- {{ $.segments.result }} should be a JSON array string, e.g.:
  -- ["Channel Partner","Torq App User","Torq employees"]
  SELECT JSON_QUERY_ARRAY('{{ $.segments.result }}') AS arr
),
priority AS (
  SELECT
    ARRAY(
      SELECT JSON_VALUE(x)
      FROM UNNEST(arr) AS x
    ) AS priority_array
  FROM raw_priority
),

params AS (
  SELECT
    TIMESTAMP("{{ $.now.result }}") AS now_ts,
    CAST("{{ $.days_back.result }}" AS INT64) AS days_back
),

windows AS (
  SELECT
    now_ts,
    days_back,
    TIMESTAMP_SUB(now_ts, INTERVAL days_back DAY) AS current_start,
    TIMESTAMP_SUB(now_ts, INTERVAL 2 * days_back DAY) AS previous_start
  FROM params
),

-- canonical user segments from academy_user_segment
user_segments AS (
  SELECT
    s.academy_user_id AS user_id,
    ARRAY_AGG(DISTINCT s.name IGNORE NULLS) AS segments
  FROM \`torqio.workramp.academy_user_segment\` AS s
  WHERE s._fivetran_deleted = FALSE
  GROUP BY s.academy_user_id
),

-- apply dynamic priority to get primary_segment per user
user_segments_with_primary AS (
  SELECT
    us.user_id,
    us.segments,
    CASE
      WHEN ARRAY_LENGTH(us.segments) = 0 THEN "(none)"
      ELSE COALESCE(
        (
          -- pick the FIRST matching segment based on priority ordering
          SELECT seg
          FROM priority p,
               UNNEST(p.priority_array) WITH OFFSET pos,
               UNNEST(us.segments) AS seg
          WHERE seg = p.priority_array[pos]
          ORDER BY pos
          LIMIT 1
        ),
        -- if no match in priority list, fallback to first segment
        us.segments[SAFE_OFFSET(0)]
      )
    END AS primary_segment
  FROM user_segments AS us, priority
),

-- base registrations in the 2×days_back window
-- NOTE: created_at is INT64 (epoch ms) → convert to TIMESTAMP
base AS (
  SELECT
    r.user_id,
    r.created_at,
    TIMESTAMP_MILLIS(r.created_at) AS created_ts,
    r.pass_status,
    r.title,
    r.is_completed,
    r.completed_at,
    uswp.segments,
    uswp.primary_segment
  FROM \`torqio.workramp.academy_registration\` AS r
  JOIN windows w ON TRUE
  LEFT JOIN user_segments_with_primary AS uswp
    ON r.user_id = uswp.user_id
  WHERE
    r.content_type = "guide"
    AND TIMESTAMP_MILLIS(r.created_at) >= w.previous_start
    AND TIMESTAMP_MILLIS(r.created_at) <  w.now_ts
),

-- current window = last N days
current_reg AS (
  SELECT b.*
  FROM base b, windows w
  WHERE b.created_ts >= w.current_start
    AND b.created_ts <  w.now_ts
),

-- previous window = N days before that
previous_reg AS (
  SELECT b.*
  FROM base b, windows w
  WHERE b.created_ts >= w.previous_start
    AND b.created_ts <  w.current_start
),

-- aggregate metrics: current
current_agg AS (
  SELECT
    COUNT(*) AS total_enrollments,
    COUNT(DISTINCT user_id) AS unique_users,
    SUM(IF(is_completed AND pass_status = 'passed', 1, 0)) AS completed_passed,
    SUM(IF(is_completed AND pass_status = 'failed', 1, 0)) AS completed_failed,
    SUM(IF(pass_status = 'in_progress', 1, 0)) AS in_progress,
    SUM(IF(pass_status = 'not_started', 1, 0)) AS not_started
  FROM current_reg
),

-- aggregate metrics: previous
previous_agg AS (
  SELECT
    COUNT(*) AS total_enrollments,
    COUNT(DISTINCT user_id) AS unique_users,
    SUM(IF(is_completed AND pass_status = 'passed', 1, 0)) AS completed_passed,
    SUM(IF(is_completed AND pass_status = 'failed', 1, 0)) AS completed_failed,
    SUM(IF(pass_status = 'in_progress', 1, 0)) AS in_progress,
    SUM(IF(pass_status = 'not_started', 1, 0)) AS not_started
  FROM previous_reg
),

-- guides distribution (current)
guides_current AS (
  SELECT
    title,
    COUNT(*) AS cnt,
    SUM(IF(is_completed AND pass_status = 'passed', 1, 0)) AS completed_passed,
    SUM(IF(pass_status = 'in_progress', 1, 0)) AS in_progress,
    SUM(IF(pass_status = 'not_started', 1, 0)) AS not_started
  FROM current_reg
  GROUP BY title
),

guides_top AS (
  SELECT
    ARRAY_AGG(
      STRUCT(
        gc.title,
        gc.cnt AS count,
        gc.completed_passed,
        gc.in_progress,
        gc.not_started,
        ROUND(gc.cnt * 100.0 / NULLIF(ca.total_enrollments, 0)) AS percent
      )
      ORDER BY gc.cnt DESC
      LIMIT 6
    ) AS top,
    ANY_VALUE(ca.total_enrollments) AS total_enrollments
  FROM guides_current gc
  CROSS JOIN current_agg ca
),

guides_others AS (
  SELECT
    GREATEST(
      ca.total_enrollments - (
        SELECT IFNULL(SUM(t.count), 0)
        FROM guides_top gt, UNNEST(gt.top) AS t
      ),
      0
    ) AS others_count,
    -- Calculate status breakdown for "others"
    GREATEST(
      (SELECT completed_passed FROM current_agg) - (
        SELECT IFNULL(SUM(t.completed_passed), 0)
        FROM guides_top gt, UNNEST(gt.top) AS t
      ),
      0
    ) AS others_completed_passed,
    GREATEST(
      (SELECT in_progress FROM current_agg) - (
        SELECT IFNULL(SUM(t.in_progress), 0)
        FROM guides_top gt, UNNEST(gt.top) AS t
      ),
      0
    ) AS others_in_progress,
    GREATEST(
      (SELECT not_started FROM current_agg) - (
        SELECT IFNULL(SUM(t.not_started), 0)
        FROM guides_top gt, UNNEST(gt.top) AS t
      ),
      0
    ) AS others_not_started,
    CASE
      WHEN ca.total_enrollments > 0 THEN
        100 - (
          SELECT IFNULL(SUM(t.percent), 0)
          FROM guides_top gt, UNNEST(gt.top) AS t
        )
      ELSE 0
    END AS others_percent
  FROM current_agg ca
),

-- segments: current & previous, by primary_segment
segments_current AS (
  SELECT
    primary_segment AS segment,
    COUNT(DISTINCT user_id) AS cnt
  FROM current_reg
  GROUP BY primary_segment
),

segments_previous AS (
  SELECT
    primary_segment AS segment,
    COUNT(DISTINCT user_id) AS cnt
  FROM previous_reg
  GROUP BY primary_segment
),

segments_current_agg AS (
  SELECT
    ARRAY_AGG(
      STRUCT(
        segment,
        cnt AS count,
        ROUND(cnt * 100.0 / NULLIF(ca.unique_users, 0)) AS percent
      )
      ORDER BY cnt DESC
    ) AS segments
  FROM segments_current sc
  CROSS JOIN current_agg ca
),

segments_previous_agg AS (
  SELECT
    ARRAY_AGG(
      STRUCT(
        segment,
        cnt AS count,
        ROUND(cnt * 100.0 / NULLIF(pa.unique_users, 0)) AS percent
      )
      ORDER BY cnt DESC
    ) AS segments
  FROM segments_previous sp
  CROSS JOIN previous_agg pa
),

-- daily enrollment trend for current period
enrollments_daily AS (
  SELECT
    DATE(created_ts) AS enrollment_date,
    COUNT(*) AS total_enrollments,
    SUM(IF(is_completed AND pass_status = 'passed', 1, 0)) AS completed_passed,
    SUM(IF(is_completed AND pass_status = 'failed', 1, 0)) AS completed_failed,
    SUM(IF(pass_status = 'in_progress', 1, 0)) AS in_progress,
    SUM(IF(pass_status = 'not_started', 1, 0)) AS not_started
  FROM current_reg
  GROUP BY enrollment_date
  ORDER BY enrollment_date
),

enrollments_trend AS (
  SELECT
    ARRAY_AGG(
      STRUCT(
        FORMAT_TIMESTAMP('%Y-%m-%d', TIMESTAMP(enrollment_date)) AS date,
        total_enrollments,
        completed_passed,
        completed_failed,
        in_progress,
        not_started
      )
      ORDER BY enrollment_date
    ) AS trend
  FROM enrollments_daily
),

-- raw enrollments for client-side filtering
raw_enrollments AS (
  SELECT
    ARRAY_AGG(
      STRUCT(
        user_id,
        FORMAT_TIMESTAMP('%Y-%m-%d', created_ts) AS created_date,
        pass_status,
        title,
        is_completed,
        primary_segment
      )
      ORDER BY created_ts
    ) AS raw_data
  FROM current_reg
)

SELECT
  STRUCT(
    -- window: days_back + current/previous ISO timestamps
    STRUCT(
      (SELECT days_back FROM windows) AS days_back,
      STRUCT(
        (SELECT FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', current_start) FROM windows) AS start_iso,
        (SELECT FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', now_ts)         FROM windows) AS end_iso
      ) AS \`current\`,
      STRUCT(
        (SELECT FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', previous_start) FROM windows) AS start_iso,
        (SELECT FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', current_start)  FROM windows) AS end_iso
      ) AS \`previous\`
    ) AS \`window\`,

    -- current metrics
    (SELECT AS STRUCT * FROM current_agg) AS \`current\`,

    -- previous metrics
    (SELECT AS STRUCT * FROM previous_agg) AS \`previous\`,

    -- deltas
    STRUCT(
      STRUCT(
        ca.total_enrollments - pa.total_enrollments AS abs,
        CASE WHEN pa.total_enrollments > 0
             THEN ROUND((ca.total_enrollments - pa.total_enrollments) * 100.0 / pa.total_enrollments)
             ELSE NULL END AS percent
      ) AS total_enrollments,
      STRUCT(
        ca.completed_passed - pa.completed_passed AS abs,
        CASE WHEN pa.completed_passed > 0
             THEN ROUND((ca.completed_passed - pa.completed_passed) * 100.0 / pa.completed_passed)
             ELSE NULL END AS percent
      ) AS completed_passed,
      STRUCT(
        ca.completed_failed - pa.completed_failed AS abs,
        CASE WHEN pa.completed_failed > 0
             THEN ROUND((ca.completed_failed - pa.completed_failed) * 100.0 / pa.completed_failed)
             ELSE NULL END AS percent
      ) AS completed_failed,
      STRUCT(
        ca.in_progress - pa.in_progress AS abs,
        CASE WHEN pa.in_progress > 0
             THEN ROUND((ca.in_progress - pa.in_progress) * 100.0 / pa.in_progress)
             ELSE NULL END AS percent
      ) AS in_progress,
      STRUCT(
        ca.not_started - pa.not_started AS abs,
        CASE WHEN pa.not_started > 0
             THEN ROUND((ca.not_started - pa.not_started) * 100.0 / pa.not_started)
             ELSE NULL END AS percent
      ) AS not_started,
      STRUCT(
        ca.unique_users - pa.unique_users AS abs,
        CASE WHEN pa.unique_users > 0
             THEN ROUND((ca.unique_users - pa.unique_users) * 100.0 / pa.unique_users)
             ELSE NULL END AS percent
      ) AS unique_users
    ) AS delta,

    -- guides: top + others
    STRUCT(
      (SELECT top FROM guides_top) AS top,
      STRUCT(
        (SELECT others_count FROM guides_others) AS count,
        (SELECT others_completed_passed FROM guides_others) AS completed_passed,
        (SELECT others_in_progress FROM guides_others) AS in_progress,
        (SELECT others_not_started FROM guides_others) AS not_started,
        (SELECT others_percent FROM guides_others) AS percent
      ) AS others
    ) AS guides,

    -- segments: current & previous distributions
    STRUCT(
      (SELECT segments FROM segments_current_agg)  AS \`current\`,
      (SELECT segments FROM segments_previous_agg) AS \`previous\`
    ) AS segments,

    -- daily trend for current period
    (SELECT trend FROM enrollments_trend) AS trend,

    -- raw enrollment data for client-side filtering
    (SELECT raw_data FROM raw_enrollments) AS raw_data

  ) AS enrollments
FROM current_agg ca, previous_agg pa;
`;

const DOCUMENTATION_DASHBOARD_QUERY = `-- sql/documentation_dashboard.sql
-- Unified query for Documentation metrics (Support Volume + AI Agent Utilization)

WITH params AS (
  SELECT
    DATE('{{ $.month_start.result }}') AS target_month_start,
    DATE_ADD(DATE('{{ $.month_start.result }}'), INTERVAL 1 MONTH) AS target_month_end,
    DATE_SUB(DATE('{{ $.month_start.result }}'), INTERVAL 1 MONTH) AS prev_month_start,
    DATE('{{ $.month_start.result }}') AS prev_month_end
),

-- Active Users within timeframe
active_users AS (
  SELECT
    COUNT(DISTINCT fact_active_users.profile_id_config) AS total_active_users
  FROM \`stackpulse-production.bi.fact_active_users\` AS fact_active_users
  CROSS JOIN params
  WHERE 
    fact_active_users.is_torq = 0 
    AND fact_active_users.month_start >= params.target_month_start
    AND fact_active_users.month_start < params.target_month_end
),

-- Tickets Amount from Zendesk
tickets_data AS (
  SELECT
    ROUND(COALESCE(CAST(
      (SUM(DISTINCT 
        (CAST(ROUND(COALESCE(agg_monthly_zendesk_tickets.total_tickets, 0) * (1/1000*1.0), 9) AS NUMERIC) + 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) - 
      SUM(DISTINCT 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) / (1/1000*1.0) AS NUMERIC), 0), 0) AS tickets_amount
  FROM \`stackpulse-production.bi.fact_active_users\` AS fact_active_users
  CROSS JOIN params
  LEFT JOIN \`stackpulse-production.kx_dataset.agg_monthly_zendesk_tickets\` AS agg_monthly_zendesk_tickets 
    ON agg_monthly_zendesk_tickets.month_start = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  WHERE 
    fact_active_users.month_start >= params.target_month_start
    AND fact_active_users.month_start < params.target_month_end
),

-- Total Intercom Conversations
intercom_conversations AS (
  SELECT
    ROUND(COALESCE(CAST(
      (SUM(DISTINCT 
        (CAST(ROUND(COALESCE(agg_deflection_rate.deflection_rate_total_distinct_conversations, 0) * (1/1000*1.0), 9) AS NUMERIC) + 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) - 
      SUM(DISTINCT 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) / (1/1000*1.0) AS NUMERIC), 0), 0) AS total_conversations
  FROM \`stackpulse-production.bi.fact_active_users\` AS fact_active_users
  CROSS JOIN params
  LEFT JOIN \`stackpulse-production.kx_dataset.agg_deflection_rate\` AS agg_deflection_rate 
    ON agg_deflection_rate.deflection_rate_month = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  WHERE 
    fact_active_users.month_start >= params.target_month_start
    AND fact_active_users.month_start < params.target_month_end
),

-- Adoption Rate (chatbot users vs total active users)
adoption_data AS (
  SELECT
    COUNT(DISTINCT fact_intercom_chatbot.profile_id) AS chatbot_users,
    COUNT(DISTINCT fact_active_users.profile_id_config) AS active_users_for_adoption
  FROM \`stackpulse-production.bi.fact_active_users\` AS fact_active_users
  CROSS JOIN params
  LEFT JOIN \`stackpulse-production.kx_dataset.fact_intercom_chatbot\` AS fact_intercom_chatbot 
    ON fact_intercom_chatbot.profile_id = fact_active_users.profile_id_config 
    AND fact_intercom_chatbot.calc_month = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  LEFT JOIN \`stackpulse-production.kx_dataset.agg_deflection_rate\` AS agg_deflection_rate 
    ON agg_deflection_rate.deflection_rate_month = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  WHERE 
    fact_active_users.is_torq = 0 
    AND fact_active_users.month_start >= params.target_month_start
    AND fact_active_users.month_start < params.target_month_end
    AND agg_deflection_rate.deflection_rate_month IS NOT NULL
),

-- Deflection Rate (conversations without escalations vs total conversations)
deflection_data AS (
  SELECT
    ROUND(COALESCE(CAST(
      (SUM(DISTINCT 
        (CAST(ROUND(COALESCE(agg_deflection_rate.deflection_rate_conversations_no_tickets, 0) * (1/1000*1.0), 9) AS NUMERIC) + 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) - 
      SUM(DISTINCT 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) / (1/1000*1.0) AS NUMERIC), 0), 0) AS conversations_no_tickets,
    ROUND(COALESCE(CAST(
      (SUM(DISTINCT 
        (CAST(ROUND(COALESCE(agg_deflection_rate.deflection_rate_total_distinct_conversations, 0) * (1/1000*1.0), 9) AS NUMERIC) + 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) - 
      SUM(DISTINCT 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) / (1/1000*1.0) AS NUMERIC), 0), 0) AS total_conversations_deflection
  FROM \`stackpulse-production.bi.fact_active_users\` AS fact_active_users
  CROSS JOIN params
  LEFT JOIN \`stackpulse-production.kx_dataset.agg_deflection_rate\` AS agg_deflection_rate 
    ON agg_deflection_rate.deflection_rate_month = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  WHERE 
    fact_active_users.month_start >= params.target_month_start
    AND fact_active_users.month_start < params.target_month_end
    AND agg_deflection_rate.deflection_rate_month IS NOT NULL
),

-- PREVIOUS PERIOD DATA --

-- Previous Active Users
active_users_prev AS (
  SELECT
    COUNT(DISTINCT fact_active_users.profile_id_config) AS total_active_users
  FROM \`stackpulse-production.bi.fact_active_users\` AS fact_active_users
  CROSS JOIN params
  WHERE 
    fact_active_users.is_torq = 0 
    AND fact_active_users.month_start >= params.prev_month_start
    AND fact_active_users.month_start < params.prev_month_end
),

-- Previous Tickets Amount
tickets_data_prev AS (
  SELECT
    ROUND(COALESCE(CAST(
      (SUM(DISTINCT 
        (CAST(ROUND(COALESCE(agg_monthly_zendesk_tickets.total_tickets, 0) * (1/1000*1.0), 9) AS NUMERIC) + 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) - 
      SUM(DISTINCT 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) / (1/1000*1.0) AS NUMERIC), 0), 0) AS tickets_amount
  FROM \`stackpulse-production.bi.fact_active_users\` AS fact_active_users
  CROSS JOIN params
  LEFT JOIN \`stackpulse-production.kx_dataset.agg_monthly_zendesk_tickets\` AS agg_monthly_zendesk_tickets 
    ON agg_monthly_zendesk_tickets.month_start = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  WHERE 
    fact_active_users.month_start >= params.prev_month_start
    AND fact_active_users.month_start < params.prev_month_end
),

-- Previous Intercom Conversations
intercom_conversations_prev AS (
  SELECT
    ROUND(COALESCE(CAST(
      (SUM(DISTINCT 
        (CAST(ROUND(COALESCE(agg_deflection_rate.deflection_rate_total_distinct_conversations, 0) * (1/1000*1.0), 9) AS NUMERIC) + 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) - 
      SUM(DISTINCT 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) / (1/1000*1.0) AS NUMERIC), 0), 0) AS total_conversations
  FROM \`stackpulse-production.bi.fact_active_users\` AS fact_active_users
  CROSS JOIN params
  LEFT JOIN \`stackpulse-production.kx_dataset.agg_deflection_rate\` AS agg_deflection_rate 
    ON agg_deflection_rate.deflection_rate_month = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  WHERE 
    fact_active_users.month_start >= params.prev_month_start
    AND fact_active_users.month_start < params.prev_month_end
),

-- Previous Adoption Rate
adoption_data_prev AS (
  SELECT
    COUNT(DISTINCT fact_intercom_chatbot.profile_id) AS chatbot_users,
    COUNT(DISTINCT fact_active_users.profile_id_config) AS active_users_for_adoption
  FROM \`stackpulse-production.bi.fact_active_users\` AS fact_active_users
  CROSS JOIN params
  LEFT JOIN \`stackpulse-production.kx_dataset.fact_intercom_chatbot\` AS fact_intercom_chatbot 
    ON fact_intercom_chatbot.profile_id = fact_active_users.profile_id_config 
    AND fact_intercom_chatbot.calc_month = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  LEFT JOIN \`stackpulse-production.kx_dataset.agg_deflection_rate\` AS agg_deflection_rate 
    ON agg_deflection_rate.deflection_rate_month = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  WHERE 
    fact_active_users.is_torq = 0 
    AND fact_active_users.month_start >= params.prev_month_start
    AND fact_active_users.month_start < params.prev_month_end
    AND agg_deflection_rate.deflection_rate_month IS NOT NULL
),

-- Previous Deflection Rate
deflection_data_prev AS (
  SELECT
    ROUND(COALESCE(CAST(
      (SUM(DISTINCT 
        (CAST(ROUND(COALESCE(agg_deflection_rate.deflection_rate_conversations_no_tickets, 0) * (1/1000*1.0), 9) AS NUMERIC) + 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) - 
      SUM(DISTINCT 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) / (1/1000*1.0) AS NUMERIC), 0), 0) AS conversations_no_tickets,
    ROUND(COALESCE(CAST(
      (SUM(DISTINCT 
        (CAST(ROUND(COALESCE(agg_deflection_rate.deflection_rate_total_distinct_conversations, 0) * (1/1000*1.0), 9) AS NUMERIC) + 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) - 
      SUM(DISTINCT 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) / (1/1000*1.0) AS NUMERIC), 0), 0) AS total_conversations_deflection
  FROM \`stackpulse-production.bi.fact_active_users\` AS fact_active_users
  CROSS JOIN params
  LEFT JOIN \`stackpulse-production.kx_dataset.agg_deflection_rate\` AS agg_deflection_rate 
    ON agg_deflection_rate.deflection_rate_month = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  WHERE 
    fact_active_users.month_start >= params.prev_month_start
    AND fact_active_users.month_start < params.prev_month_end
    AND agg_deflection_rate.deflection_rate_month IS NOT NULL
),

-- Total numbers trend: absolute counts (12 months)
trend_data AS (
  SELECT
    FORMAT_DATE('%Y-%m', fact_active_users.month_start) AS month,
    COUNT(DISTINCT fact_active_users.profile_id_config) AS total_active_users,
    ROUND(COALESCE(CAST(
      (SUM(DISTINCT 
        (CAST(ROUND(COALESCE(agg_monthly_zendesk_tickets.total_tickets, 0) * (1/1000*1.0), 9) AS NUMERIC) + 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) - 
      SUM(DISTINCT 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) / (1/1000*1.0) AS NUMERIC), 0), 0) AS total_tickets_amount,
    ROUND(COALESCE(CAST(
      (SUM(DISTINCT 
        (CAST(ROUND(COALESCE(agg_deflection_rate.deflection_rate_total_distinct_conversations, 0) * (1/1000*1.0), 9) AS NUMERIC) + 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) - 
      SUM(DISTINCT 
        (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
        CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
      ) / (1/1000*1.0) AS NUMERIC), 0), 0) AS total_conversations
  FROM \`stackpulse-production.bi.fact_active_users\` AS fact_active_users
  LEFT JOIN \`stackpulse-production.kx_dataset.fact_intercom_chatbot\` AS fact_intercom_chatbot 
    ON fact_intercom_chatbot.profile_id = fact_active_users.profile_id_config 
    AND fact_intercom_chatbot.calc_month = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  LEFT JOIN \`stackpulse-production.kx_dataset.agg_deflection_rate\` AS agg_deflection_rate 
    ON agg_deflection_rate.deflection_rate_month = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  LEFT JOIN \`stackpulse-production.kx_dataset.agg_monthly_zendesk_tickets\` AS agg_monthly_zendesk_tickets 
    ON agg_monthly_zendesk_tickets.month_start = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  WHERE 
    (fact_active_users.is_torq) = 0 
    AND ((fact_active_users.month_start) >= ((DATE_ADD(DATE_TRUNC(CURRENT_DATE('UTC'), MONTH), INTERVAL -12 MONTH))) 
    AND (fact_active_users.month_start) < ((DATE_ADD(DATE_ADD(DATE_TRUNC(CURRENT_DATE('UTC'), MONTH), INTERVAL -12 MONTH), INTERVAL 13 MONTH))))
  GROUP BY 1
  ORDER BY 1 ASC
),

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
    CAST(
      ROUND(
        CASE 
          WHEN ROUND(COALESCE(CAST(
            (SUM(DISTINCT 
              (CAST(ROUND(COALESCE(agg_deflection_rate.deflection_rate_total_distinct_conversations, 0) * (1/1000*1.0), 9) AS NUMERIC) + 
              (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
              CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
            ) - 
            SUM(DISTINCT 
              (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
              CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
            ) / (1/1000*1.0) AS NUMERIC), 0), 0) > 0
          THEN (
            ROUND(COALESCE(CAST(
              (SUM(DISTINCT 
                (CAST(ROUND(COALESCE(agg_deflection_rate.deflection_rate_conversations_no_tickets, 0) * (1/1000*1.0), 9) AS NUMERIC) + 
                (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
                CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
              ) - 
              SUM(DISTINCT 
                (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
                CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
              ) / (1/1000*1.0) AS NUMERIC), 0), 0) * 100.0 / 
            ROUND(COALESCE(CAST(
              (SUM(DISTINCT 
                (CAST(ROUND(COALESCE(agg_deflection_rate.deflection_rate_total_distinct_conversations, 0) * (1/1000*1.0), 9) AS NUMERIC) + 
                (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
                CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
              ) - 
              SUM(DISTINCT 
                (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
                CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
              ) / (1/1000*1.0) AS NUMERIC), 0), 0)
          )
          ELSE 0 
        END, 2
      ) AS FLOAT64
    ) AS deflection_rate_percent,
    -- Tickets Volume: (tickets / active users) * 100
    CAST(
      ROUND(
        CASE 
          WHEN COUNT(DISTINCT fact_active_users.profile_id_config) > 0 
          THEN (
            ROUND(COALESCE(CAST(
              (SUM(DISTINCT 
                (CAST(ROUND(COALESCE(agg_monthly_zendesk_tickets.total_tickets, 0) * (1/1000*1.0), 9) AS NUMERIC) + 
                (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
                CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
              ) - 
              SUM(DISTINCT 
                (CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 1, 15)) AS INT64) AS NUMERIC) * 4294967296 + 
                CAST(CAST(CONCAT('0x', SUBSTR(TO_HEX(MD5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 16, 8)) AS INT64) AS NUMERIC)) * 0.000000001)
              ) / (1/1000*1.0) AS NUMERIC), 0), 0) * 100.0 / COUNT(DISTINCT fact_active_users.profile_id_config)
          )
          ELSE 0 
        END, 2
      ) AS FLOAT64
    ) AS tickets_volume_percent
  FROM \`stackpulse-production.bi.fact_active_users\` AS fact_active_users
  LEFT JOIN \`stackpulse-production.kx_dataset.fact_intercom_chatbot\` AS fact_intercom_chatbot 
    ON fact_intercom_chatbot.profile_id = fact_active_users.profile_id_config 
    AND fact_intercom_chatbot.calc_month = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  LEFT JOIN \`stackpulse-production.kx_dataset.agg_deflection_rate\` AS agg_deflection_rate 
    ON agg_deflection_rate.deflection_rate_month = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  LEFT JOIN \`stackpulse-production.kx_dataset.agg_monthly_zendesk_tickets\` AS agg_monthly_zendesk_tickets 
    ON agg_monthly_zendesk_tickets.month_start = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  WHERE 
    (fact_active_users.is_torq) = 0 
    AND ((fact_active_users.month_start) >= ((DATE_ADD(DATE_TRUNC(CURRENT_DATE('UTC'), MONTH), INTERVAL -12 MONTH))) 
    AND (fact_active_users.month_start) < ((DATE_ADD(DATE_ADD(DATE_TRUNC(CURRENT_DATE('UTC'), MONTH), INTERVAL -12 MONTH), INTERVAL 13 MONTH))))
  GROUP BY 1
  ORDER BY 1 ASC
)

-- Final structured output with current, previous, delta, and trends
SELECT
  STRUCT(
    STRUCT(
      (SELECT target_month_start FROM params) AS start_date,
      (SELECT target_month_end FROM params) AS end_date,
      FORMAT_DATE('%Y-%m', (SELECT target_month_start FROM params)) AS month,
      FORMAT_DATE('%Y-%m', (SELECT prev_month_start FROM params)) AS prev_month
    ) AS \`window\`,
    
    -- Current period support metrics
    STRUCT(
      (SELECT total_active_users FROM active_users) AS active_users,
      (SELECT tickets_amount FROM tickets_data) AS tickets_amount,
      ROUND(
        CASE 
          WHEN (SELECT total_active_users FROM active_users) > 0 
          THEN ((SELECT tickets_amount FROM tickets_data) * 100.0 / (SELECT total_active_users FROM active_users))
          ELSE 0 
        END, 2
      ) AS tickets_volume_percent,
      (SELECT total_conversations FROM intercom_conversations) AS total_conversations
    ) AS support,
    
    -- Previous period support metrics
    STRUCT(
      (SELECT total_active_users FROM active_users_prev) AS active_users,
      (SELECT tickets_amount FROM tickets_data_prev) AS tickets_amount,
      ROUND(
        CASE 
          WHEN (SELECT total_active_users FROM active_users_prev) > 0 
          THEN ((SELECT tickets_amount FROM tickets_data_prev) * 100.0 / (SELECT total_active_users FROM active_users_prev))
          ELSE 0 
        END, 2
      ) AS tickets_volume_percent,
      (SELECT total_conversations FROM intercom_conversations_prev) AS total_conversations
    ) AS support_previous,
    
    -- Support deltas
    STRUCT(
      STRUCT(
        ((SELECT total_active_users FROM active_users) - (SELECT total_active_users FROM active_users_prev)) AS absolute,
        ROUND(CASE 
          WHEN (SELECT total_active_users FROM active_users_prev) > 0 
          THEN (((SELECT total_active_users FROM active_users) - (SELECT total_active_users FROM active_users_prev)) * 100.0 / (SELECT total_active_users FROM active_users_prev))
          ELSE 0 
        END, 1) AS percent
      ) AS active_users,
      STRUCT(
        ((SELECT tickets_amount FROM tickets_data) - (SELECT tickets_amount FROM tickets_data_prev)) AS absolute,
        ROUND(CASE 
          WHEN (SELECT tickets_amount FROM tickets_data_prev) > 0 
          THEN (((SELECT tickets_amount FROM tickets_data) - (SELECT tickets_amount FROM tickets_data_prev)) * 100.0 / (SELECT tickets_amount FROM tickets_data_prev))
          ELSE 0 
        END, 1) AS percent
      ) AS tickets_amount,
      STRUCT(
        (ROUND(CASE WHEN (SELECT total_active_users FROM active_users) > 0 THEN ((SELECT tickets_amount FROM tickets_data) * 100.0 / (SELECT total_active_users FROM active_users)) ELSE 0 END, 2) - 
         ROUND(CASE WHEN (SELECT total_active_users FROM active_users_prev) > 0 THEN ((SELECT tickets_amount FROM tickets_data_prev) * 100.0 / (SELECT total_active_users FROM active_users_prev)) ELSE 0 END, 2)) AS absolute,
        ROUND(CASE 
          WHEN (ROUND(CASE WHEN (SELECT total_active_users FROM active_users_prev) > 0 THEN ((SELECT tickets_amount FROM tickets_data_prev) * 100.0 / (SELECT total_active_users FROM active_users_prev)) ELSE 0 END, 2)) > 0
          THEN ((ROUND(CASE WHEN (SELECT total_active_users FROM active_users) > 0 THEN ((SELECT tickets_amount FROM tickets_data) * 100.0 / (SELECT total_active_users FROM active_users)) ELSE 0 END, 2) - 
                 ROUND(CASE WHEN (SELECT total_active_users FROM active_users_prev) > 0 THEN ((SELECT tickets_amount FROM tickets_data_prev) * 100.0 / (SELECT total_active_users FROM active_users_prev)) ELSE 0 END, 2)) * 100.0 / 
                 ROUND(CASE WHEN (SELECT total_active_users FROM active_users_prev) > 0 THEN ((SELECT tickets_amount FROM tickets_data_prev) * 100.0 / (SELECT total_active_users FROM active_users_prev)) ELSE 0 END, 2))
          ELSE 0 
        END, 1) AS percent
      ) AS tickets_volume_percent,
      STRUCT(
        ((SELECT total_conversations FROM intercom_conversations) - (SELECT total_conversations FROM intercom_conversations_prev)) AS absolute,
        ROUND(CASE 
          WHEN (SELECT total_conversations FROM intercom_conversations_prev) > 0 
          THEN (((SELECT total_conversations FROM intercom_conversations) - (SELECT total_conversations FROM intercom_conversations_prev)) * 100.0 / (SELECT total_conversations FROM intercom_conversations_prev))
          ELSE 0 
        END, 1) AS percent
      ) AS total_conversations
    ) AS support_delta,
    
    -- Current period AI agent metrics
    STRUCT(
      ROUND(
        CASE 
          WHEN (SELECT active_users_for_adoption FROM adoption_data) > 0 
          THEN ((SELECT chatbot_users FROM adoption_data) * 100.0 / (SELECT active_users_for_adoption FROM adoption_data))
          ELSE 0 
        END, 2
      ) AS adoption_rate_percent,
      ROUND(
        CASE 
          WHEN (SELECT total_conversations_deflection FROM deflection_data) > 0 
          THEN ((SELECT conversations_no_tickets FROM deflection_data) * 100.0 / (SELECT total_conversations_deflection FROM deflection_data))
          ELSE 0 
        END, 2
      ) AS deflection_rate_percent,
      (SELECT chatbot_users FROM adoption_data) AS chatbot_users,
      (SELECT conversations_no_tickets FROM deflection_data) AS conversations_no_escalations,
      (SELECT total_conversations_deflection FROM deflection_data) AS total_conversations_for_deflection
    ) AS ai_agent,
    
    -- Previous period AI agent metrics
    STRUCT(
      ROUND(
        CASE 
          WHEN (SELECT active_users_for_adoption FROM adoption_data_prev) > 0 
          THEN ((SELECT chatbot_users FROM adoption_data_prev) * 100.0 / (SELECT active_users_for_adoption FROM adoption_data_prev))
          ELSE 0 
        END, 2
      ) AS adoption_rate_percent,
      ROUND(
        CASE 
          WHEN (SELECT total_conversations_deflection FROM deflection_data_prev) > 0 
          THEN ((SELECT conversations_no_tickets FROM deflection_data_prev) * 100.0 / (SELECT total_conversations_deflection FROM deflection_data_prev))
          ELSE 0 
        END, 2
      ) AS deflection_rate_percent
    ) AS ai_agent_previous,
    
    -- AI agent deltas
    STRUCT(
      STRUCT(
        (ROUND(CASE WHEN (SELECT active_users_for_adoption FROM adoption_data) > 0 THEN ((SELECT chatbot_users FROM adoption_data) * 100.0 / (SELECT active_users_for_adoption FROM adoption_data)) ELSE 0 END, 2) - 
         ROUND(CASE WHEN (SELECT active_users_for_adoption FROM adoption_data_prev) > 0 THEN ((SELECT chatbot_users FROM adoption_data_prev) * 100.0 / (SELECT active_users_for_adoption FROM adoption_data_prev)) ELSE 0 END, 2)) AS absolute,
        ROUND(CASE 
          WHEN (ROUND(CASE WHEN (SELECT active_users_for_adoption FROM adoption_data_prev) > 0 THEN ((SELECT chatbot_users FROM adoption_data_prev) * 100.0 / (SELECT active_users_for_adoption FROM adoption_data_prev)) ELSE 0 END, 2)) > 0
          THEN ((ROUND(CASE WHEN (SELECT active_users_for_adoption FROM adoption_data) > 0 THEN ((SELECT chatbot_users FROM adoption_data) * 100.0 / (SELECT active_users_for_adoption FROM adoption_data)) ELSE 0 END, 2) - 
                 ROUND(CASE WHEN (SELECT active_users_for_adoption FROM adoption_data_prev) > 0 THEN ((SELECT chatbot_users FROM adoption_data_prev) * 100.0 / (SELECT active_users_for_adoption FROM adoption_data_prev)) ELSE 0 END, 2)) * 100.0 / 
                 ROUND(CASE WHEN (SELECT active_users_for_adoption FROM adoption_data_prev) > 0 THEN ((SELECT chatbot_users FROM adoption_data_prev) * 100.0 / (SELECT active_users_for_adoption FROM adoption_data_prev)) ELSE 0 END, 2))
          ELSE 0 
        END, 1) AS percent
      ) AS adoption_rate_percent,
      STRUCT(
        (ROUND(CASE WHEN (SELECT total_conversations_deflection FROM deflection_data) > 0 THEN ((SELECT conversations_no_tickets FROM deflection_data) * 100.0 / (SELECT total_conversations_deflection FROM deflection_data)) ELSE 0 END, 2) - 
         ROUND(CASE WHEN (SELECT total_conversations_deflection FROM deflection_data_prev) > 0 THEN ((SELECT conversations_no_tickets FROM deflection_data_prev) * 100.0 / (SELECT total_conversations_deflection FROM deflection_data_prev)) ELSE 0 END, 2)) AS absolute,
        ROUND(CASE 
          WHEN (ROUND(CASE WHEN (SELECT total_conversations_deflection FROM deflection_data_prev) > 0 THEN ((SELECT conversations_no_tickets FROM deflection_data_prev) * 100.0 / (SELECT total_conversations_deflection FROM deflection_data_prev)) ELSE 0 END, 2)) > 0
          THEN ((ROUND(CASE WHEN (SELECT total_conversations_deflection FROM deflection_data) > 0 THEN ((SELECT conversations_no_tickets FROM deflection_data) * 100.0 / (SELECT total_conversations_deflection FROM deflection_data)) ELSE 0 END, 2) - 
                 ROUND(CASE WHEN (SELECT total_conversations_deflection FROM deflection_data_prev) > 0 THEN ((SELECT conversations_no_tickets FROM deflection_data_prev) * 100.0 / (SELECT total_conversations_deflection FROM deflection_data_prev)) ELSE 0 END, 2)) * 100.0 / 
                 ROUND(CASE WHEN (SELECT total_conversations_deflection FROM deflection_data_prev) > 0 THEN ((SELECT conversations_no_tickets FROM deflection_data_prev) * 100.0 / (SELECT total_conversations_deflection FROM deflection_data_prev)) ELSE 0 END, 2))
          ELSE 0 
        END, 1) AS percent
      ) AS deflection_rate_percent
    ) AS ai_agent_delta,
    
    -- 12-month total numbers trend
    ARRAY(
      SELECT AS STRUCT
        month,
        total_active_users,
        total_tickets_amount,
        total_conversations
      FROM trend_data
    ) AS trend,
    
    -- 12-month engagement trend (percentages)
    ARRAY(
      SELECT AS STRUCT
        month,
        adoption_rate_percent,
        deflection_rate_percent,
        tickets_volume_percent
      FROM engagement_trend_data
    ) AS engagement_trend
  ) AS documentation;
`;

// NOTE: This query is no longer sent separately - trend data is now included in DOCUMENTATION_DASHBOARD_QUERY
// Kept for reference only
const DOCUMENTATION_TREND_QUERY = `-- Documentation Trend Query (Last 12 months) - DEPRECATED
SELECT
    (FORMAT_DATE('%Y-%m', fact_active_users.month_start)) AS month,
    COUNT(DISTINCT fact_active_users.profile_id_config) AS active_users,
    ROUND(COALESCE(CAST((SUM(DISTINCT (CAST(ROUND(COALESCE(agg_monthly_zendesk_tickets.total_tickets, 0)*(1/1000*1.0), 9) AS NUMERIC) + (cast(cast(concat('0x', substr(to_hex(md5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 1, 15)) as int64) as numeric) * 4294967296 + cast(cast(concat('0x', substr(to_hex(md5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 16, 8)) as int64) as numeric)) * 0.000000001)) - SUM(DISTINCT (cast(cast(concat('0x', substr(to_hex(md5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 1, 15)) as int64) as numeric) * 4294967296 + cast(cast(concat('0x', substr(to_hex(md5(CAST(agg_monthly_zendesk_tickets.month_start AS STRING))), 16, 8)) as int64) as numeric)) * 0.000000001)) / (1/1000*1.0) AS NUMERIC), 0), 6) AS tickets_amount,
    COUNT(DISTINCT fact_intercom_chatbot.conversation_id) AS chatbot_conversations,
    ROUND(COALESCE(CAST((SUM(DISTINCT (CAST(ROUND(COALESCE(agg_deflection_rate.deflection_rate_total_distinct_conversations, 0)*(1/1000*1.0), 9) AS NUMERIC) + (cast(cast(concat('0x', substr(to_hex(md5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) as int64) as numeric) * 4294967296 + cast(cast(concat('0x', substr(to_hex(md5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) as int64) as numeric)) * 0.000000001)) - SUM(DISTINCT (cast(cast(concat('0x', substr(to_hex(md5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 1, 15)) as int64) as numeric) * 4294967296 + cast(cast(concat('0x', substr(to_hex(md5(CAST(agg_deflection_rate.deflection_rate_month AS STRING))), 16, 8)) as int64) as numeric)) * 0.000000001)) / (1/1000*1.0) AS NUMERIC), 0), 6) AS total_conversations
FROM \`stackpulse-production.bi.fact_active_users\` AS fact_active_users
LEFT JOIN \`stackpulse-production.kx_dataset.fact_intercom_chatbot\` AS fact_intercom_chatbot 
    ON fact_intercom_chatbot.profile_id = fact_active_users.profile_id_config 
    AND fact_intercom_chatbot.calc_month = (FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start))
LEFT JOIN \`stackpulse-production.kx_dataset.agg_deflection_rate\` AS agg_deflection_rate 
    ON agg_deflection_rate.deflection_rate_month = (FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start))
LEFT JOIN \`stackpulse-production.kx_dataset.agg_monthly_zendesk_tickets\` AS agg_monthly_zendesk_tickets 
    ON agg_monthly_zendesk_tickets.month_start = (FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start))
WHERE (fact_active_users.is_torq) = 0 
    AND ((fact_active_users.month_start) >= ((DATE_ADD(DATE_TRUNC(CURRENT_DATE('UTC'), MONTH), INTERVAL -12 MONTH))) 
    AND (fact_active_users.month_start) < ((DATE_ADD(DATE_ADD(DATE_TRUNC(CURRENT_DATE('UTC'), MONTH), INTERVAL -12 MONTH), INTERVAL 13 MONTH))))
GROUP BY 1
ORDER BY 1 ASC
LIMIT 500;
`;

// Export for use in renderer
// Export queries for use in API and renderer
window.DashboardQueries = {
  ENROLLMENTS_DASHBOARD_QUERY,
  DOCUMENTATION_DASHBOARD_QUERY,
  DOCUMENTATION_TREND_QUERY  // Kept for reference, not sent to webhook (trend now in DOCUMENTATION_DASHBOARD_QUERY)
};

