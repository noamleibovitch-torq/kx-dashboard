-- sql/enrollments_raw.sql

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

user_segments AS (
  SELECT
    s.academy_user_id AS user_id,
    ARRAY_AGG(DISTINCT s.name IGNORE NULLS) AS segments
  FROM `torqio.workramp.academy_user_segment` AS s
  WHERE s._fivetran_deleted = FALSE
  GROUP BY s.academy_user_id
),

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
)

SELECT
  r.user_id,
  r.created_at,
  r.pass_status,
  r.title,
  r.is_completed,
  r.completed_at,
  uswp.segments,
  uswp.primary_segment
FROM `torqio.workramp.academy_registration` AS r
LEFT JOIN user_segments_with_primary AS uswp
  ON r.user_id = uswp.user_id
WHERE
  r.content_type = "guide"
  AND r.created_at > {{ int $.enrolment_from.timestamp_ms }};

