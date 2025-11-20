-- sql/enrollments_dashboard.sql

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
  FROM `torqio.workramp.academy_user_segment` AS s
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
  FROM `torqio.workramp.academy_registration` AS r
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
    COUNT(*) AS cnt
  FROM current_reg
  GROUP BY title
),

guides_top AS (
  SELECT
    ARRAY_AGG(
      STRUCT(
        title,
        cnt AS count,
        ROUND(cnt * 100.0 / NULLIF(ca.total_enrollments, 0)) AS percent
      )
      ORDER BY cnt DESC
      LIMIT 5
    ) AS top,
    ca.total_enrollments
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
    COUNT(*) AS cnt
  FROM current_reg
  GROUP BY primary_segment
),

segments_previous AS (
  SELECT
    primary_segment AS segment,
    COUNT(*) AS cnt
  FROM previous_reg
  GROUP BY primary_segment
),

segments_current_agg AS (
  SELECT
    ARRAY_AGG(
      STRUCT(
        segment,
        cnt AS count,
        ROUND(cnt * 100.0 / NULLIF(ca.total_enrollments, 0)) AS percent
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
        ROUND(cnt * 100.0 / NULLIF(pa.total_enrollments, 0)) AS percent
      )
      ORDER BY cnt DESC
    ) AS segments
  FROM segments_previous sp
  CROSS JOIN previous_agg pa
)

SELECT
  STRUCT(
    -- window: days_back + current/previous ISO timestamps
    STRUCT(
      (SELECT days_back FROM windows) AS days_back,
      STRUCT(
        (SELECT FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', current_start) FROM windows) AS start_iso,
        (SELECT FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', now_ts)         FROM windows) AS end_iso
      ) AS `current`,
      STRUCT(
        (SELECT FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', previous_start) FROM windows) AS start_iso,
        (SELECT FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', current_start)  FROM windows) AS end_iso
      ) AS `previous`
    ) AS `window`,

    -- current metrics
    (SELECT AS STRUCT * FROM current_agg) AS `current`,

    -- previous metrics
    (SELECT AS STRUCT * FROM previous_agg) AS `previous`,

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
        (SELECT others_count   FROM guides_others) AS count,
        (SELECT others_percent FROM guides_others) AS percent
      ) AS others
    ) AS guides,

    -- segments: current & previous distributions
    STRUCT(
      (SELECT segments FROM segments_current_agg)  AS `current`,
      (SELECT segments FROM segments_previous_agg) AS `previous`
    ) AS segments

  ) AS enrollments
FROM current_agg ca, previous_agg pa;

