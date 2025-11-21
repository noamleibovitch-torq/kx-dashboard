-- sql/documentation_dashboard.sql
-- Unified query for Documentation metrics (Support Volume + AI Agent Utilization)

WITH params AS (
  SELECT
    DATE('{{ $.month_start.result }}') AS target_month_start,
    DATE_ADD(DATE('{{ $.month_start.result }}'), INTERVAL 1 MONTH) AS target_month_end
),

-- Active Users within timeframe
active_users AS (
  SELECT
    COUNT(DISTINCT fact_active_users.profile_id_config) AS total_active_users
  FROM `stackpulse-production.bi.fact_active_users` AS fact_active_users
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
  FROM `stackpulse-production.bi.fact_active_users` AS fact_active_users
  CROSS JOIN params
  LEFT JOIN `stackpulse-production.kx_dataset.agg_monthly_zendesk_tickets` AS agg_monthly_zendesk_tickets 
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
  FROM `stackpulse-production.bi.fact_active_users` AS fact_active_users
  CROSS JOIN params
  LEFT JOIN `stackpulse-production.kx_dataset.agg_deflection_rate` AS agg_deflection_rate 
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
  FROM `stackpulse-production.bi.fact_active_users` AS fact_active_users
  CROSS JOIN params
  LEFT JOIN `stackpulse-production.kx_dataset.fact_intercom_chatbot` AS fact_intercom_chatbot 
    ON fact_intercom_chatbot.profile_id = fact_active_users.profile_id_config 
    AND fact_intercom_chatbot.calc_month = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  LEFT JOIN `stackpulse-production.kx_dataset.agg_deflection_rate` AS agg_deflection_rate 
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
  FROM `stackpulse-production.bi.fact_active_users` AS fact_active_users
  CROSS JOIN params
  LEFT JOIN `stackpulse-production.kx_dataset.agg_deflection_rate` AS agg_deflection_rate 
    ON agg_deflection_rate.deflection_rate_month = FORMAT_DATE('%Y-%m-%d', fact_active_users.month_start)
  WHERE 
    fact_active_users.month_start >= params.target_month_start
    AND fact_active_users.month_start < params.target_month_end
    AND agg_deflection_rate.deflection_rate_month IS NOT NULL
)

-- Final structured output
SELECT
  STRUCT(
    STRUCT(
      (SELECT target_month_start FROM params) AS start_date,
      (SELECT target_month_end FROM params) AS end_date,
      FORMAT_DATE('%Y-%m', (SELECT target_month_start FROM params)) AS month
    ) AS `window`,
    
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
    ) AS ai_agent
  ) AS documentation;

