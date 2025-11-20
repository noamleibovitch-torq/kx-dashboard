# jq/dashboard_merge.jq
# INPUT shape (from Torq context):
# {
#   "enrollments_bq": { "api_object": [ { "enrollments": { ... } } ] },
#   "labs_step":      { "api_object": { ... } }
# }

{
  body: {
    enrollments: .enrollments_bq.api_object[0].enrollments,
    labs:        .labs_step.api_object
  }
}

