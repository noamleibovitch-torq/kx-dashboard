# Accept either the wrapped structure (with api_object) or a raw array
(.api_object // .) as $rows

# ===== TIME SETUP (seconds, UTC) =====
# now in epoch seconds
| ("{{ $.now.result }}" | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime) as $now_s

# days_back (configurable, default 7)
| (( "{{ $.days_back.result }}" // "7" ) | tonumber) as $days_back

# period length in seconds
| ($days_back * 86400) as $period_s

# current period: [current_start, now)
| ($now_s - $period_s) as $current_start_s

# previous period: [previous_start, current_start)
| ($current_start_s - $period_s) as $previous_start_s

# start-of-today (UTC midnight for "today")
| (($now_s / 86400 | floor) * 86400) as $today_start_s

# ===== NORMALIZE SNAPSHOTS =====
# Extract parsed snapshot + timestamp + global metrics
| ($rows
   | map(
       (.snapshot | fromjson) as $s
       | {
           snapshot_at: $s.snapshot_at,
           time_s:      ($s.snapshot_at | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime),
           global:      $s.global
         }
     )
  ) as $snaps

# Sort by time ascending
| ($snaps | sort_by(.time_s)) as $snaps_sorted

# Latest snapshot overall (for labs_running_now)
| ($snaps_sorted
   | if length > 0 then .[length - 1] else null end
  ) as $latest

# Slices for today / current period / previous period
| ($snaps_sorted
   | map(select(.time_s >= $today_start_s and .time_s <= $now_s))
  ) as $today_snaps

| ($snaps_sorted
   | map(select(.time_s >= $current_start_s and .time_s <= $now_s))
  ) as $current_snaps

| ($snaps_sorted
   | map(select(.time_s >= $previous_start_s and .time_s < $current_start_s))
  ) as $previous_snaps


# ===== TODAY METRICS =====
| ($today_snaps | map(.global)) as $g_today

| ($g_today | map(.created_labs   // 0) | add? // 0) as $today_created
| ($g_today | map(.resolved_labs  // 0) | add? // 0) as $today_resolved
| ($g_today | map(.total_attempts // 0) | add? // 0) as $today_attempts
| ($g_today | map(.passed_checks  // 0) | add? // 0) as $today_passed
| ($g_today | map(.failed_checks  // 0) | add? // 0) as $today_failed

# weight for avg (how many labs resolved today)
| ($g_today | map(.resolved_labs  // 0) | add? // 0) as $today_res_weight

| (if $today_attempts > 0
   then ((100 * $today_passed / $today_attempts) | round)
   else 0 end
  ) as $today_pass_pct

| (if $today_attempts > 0
   then 100 - $today_pass_pct
   else 0 end
  ) as $today_fail_pct

| (if $today_res_weight > 0
   then ($g_today
         | map((.avg_resolve_seconds // 0) * (.resolved_labs // 0))
         | add / $today_res_weight)
   else 0 end
  ) as $today_avg_seconds


# ===== CURRENT PERIOD (Last N days) =====
| ($current_snaps | map(.global)) as $g_curr

| ($g_curr | map(.created_labs   // 0) | add? // 0) as $curr_created
| ($g_curr | map(.resolved_labs  // 0) | add? // 0) as $curr_resolved
| ($g_curr | map(.total_attempts // 0) | add? // 0) as $curr_attempts
| ($g_curr | map(.passed_checks  // 0) | add? // 0) as $curr_passed
| ($g_curr | map(.failed_checks  // 0) | add? // 0) as $curr_failed

| ($g_curr | map(.resolved_labs  // 0) | add? // 0) as $curr_res_weight

| (if $curr_attempts > 0
   then ((100 * $curr_passed / $curr_attempts) | round)
   else 0 end
  ) as $curr_pass_pct

| (if $curr_attempts > 0
   then 100 - $curr_pass_pct
   else 0 end
  ) as $curr_fail_pct

| (if $curr_res_weight > 0
   then ($g_curr
         | map((.avg_resolve_seconds // 0) * (.resolved_labs // 0))
         | add / $curr_res_weight)
   else 0 end
  ) as $curr_avg_seconds

# Average labs running during current period
| (if ($g_curr | length) > 0
   then ($g_curr | map(.labs_running // 0) | add / length | round)
   else 0 end
  ) as $curr_avg_labs_running


# ===== PREVIOUS PERIOD (Previous N days) =====
| ($previous_snaps | map(.global)) as $g_prev

| ($g_prev | map(.created_labs   // 0) | add? // 0) as $prev_created
| ($g_prev | map(.resolved_labs  // 0) | add? // 0) as $prev_resolved
| ($g_prev | map(.total_attempts // 0) | add? // 0) as $prev_attempts
| ($g_prev | map(.passed_checks  // 0) | add? // 0) as $prev_passed
| ($g_prev | map(.failed_checks  // 0) | add? // 0) as $prev_failed

| ($g_prev | map(.resolved_labs  // 0) | add? // 0) as $prev_res_weight

| (if $prev_attempts > 0
   then ((100 * $prev_passed / $prev_attempts) | round)
   else 0 end
  ) as $prev_pass_pct

| (if $prev_attempts > 0
   then 100 - $prev_pass_pct
   else 0 end
  ) as $prev_fail_pct

| (if $prev_res_weight > 0
   then ($g_prev
         | map((.avg_resolve_seconds // 0) * (.resolved_labs // 0))
         | add / $prev_res_weight)
   else 0 end
  ) as $prev_avg_seconds


# ===== DAILY AGGREGATION FOR TREND =====
# Group current period snapshots by day and aggregate metrics
| ($current_snaps
   | group_by(.time_s / 86400 | floor)
   | map({
       date: (.[0].snapshot_at | split("T")[0]),
       created_labs: (map(.global.created_labs // 0) | add),
       resolved_labs: (map(.global.resolved_labs // 0) | add),
       failed_checks: (map(.global.failed_checks // 0) | add),
       passed_checks: (map(.global.passed_checks // 0) | add),
       total_attempts: (map(.global.total_attempts // 0) | add),
       labs_running: (map(.global.labs_running // 0) | add / length | round)
     })
   | sort_by(.date)
  ) as $daily_trend

# Find busiest day
| ($daily_trend 
   | if length > 0 
     then (max_by(.total_attempts) | {date: .date, attempts: .total_attempts})
     else null 
     end
  ) as $busiest_day


# ===== FINAL LABS OBJECT =====
| {
    labs: {
      window: {
        days_back: $days_back,
        current: {
          start_iso: ($current_start_s  | todate),
          end_iso:   ($now_s            | todate)
        },
        previous: {
          start_iso: ($previous_start_s | todate),
          end_iso:   ($current_start_s  | todate)
        }
      },

      today: {
        labs_running_now: ($latest.global.labs_running // null),
        created_labs:     $today_created,
        resolved_labs:    $today_resolved,
        total_attempts:   $today_attempts,
        passed_checks:    $today_passed,
        failed_checks:    $today_failed,
        passed_checks_percent: $today_pass_pct,
        failed_checks_percent: $today_fail_pct,
        avg_resolve_seconds: $today_avg_seconds,
        avg_resolve_hours:   ($today_avg_seconds / 3600)
      },

      current: {
        labs_running_now: ($latest.global.labs_running // null),
        created_labs:     $curr_created,
        resolved_labs:    $curr_resolved,
        total_attempts:   $curr_attempts,
        passed_checks:    $curr_passed,
        failed_checks:    $curr_failed,
        passed_checks_percent: $curr_pass_pct,
        failed_checks_percent: $curr_fail_pct,
        avg_resolve_seconds: $curr_avg_seconds,
        avg_resolve_hours:   ($curr_avg_seconds / 3600),
        avg_labs_running: $curr_avg_labs_running
      },

      previous: {
        created_labs:     $prev_created,
        resolved_labs:    $prev_resolved,
        total_attempts:   $prev_attempts,
        passed_checks:    $prev_passed,
        failed_checks:    $prev_failed,
        passed_checks_percent: $prev_pass_pct,
        failed_checks_percent: $prev_fail_pct,
        avg_resolve_seconds: $prev_avg_seconds,
        avg_resolve_hours:   ($prev_avg_seconds / 3600)
      },

      delta: {
        total_attempts: {
          abs:     ($curr_attempts - $prev_attempts),
          percent: (
            if $prev_attempts > 0
            then (100.0 * ($curr_attempts - $prev_attempts) / $prev_attempts) | round
            else null end
          )
        },
        avg_resolve_hours: {
          abs:     ($curr_avg_seconds / 3600 - $prev_avg_seconds / 3600),
          percent: (
            if $prev_avg_seconds > 0
            then (100.0 * (($curr_avg_seconds - $prev_avg_seconds) / $prev_avg_seconds)) | round
            else null end
          )
        },
        passed_checks_percent: {
          abs:     ($curr_pass_pct - $prev_pass_pct),
          percent: (
            if $prev_pass_pct > 0
            then (100.0 * ($curr_pass_pct - $prev_pass_pct) / $prev_pass_pct) | round
            else null end
          )
        }
      },

      metrics: {
        success_rate: $curr_pass_pct,
        resolution_rate: (
          if $curr_created > 0
          then (100.0 * $curr_resolved / $curr_created) | round
          else null end
        ),
        labs_backlog: ($curr_created - $curr_resolved),
        busiest_day: $busiest_day
      },

      trend: $daily_trend
    }
  }

