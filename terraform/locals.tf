locals {
  regions = {
    "North East" = {
      towns = [
        "Newcastle",
        "Gateshead",
        "Sunderland",
        "Blyth/Ashington/Morpeth"
      ]
    }
  }

  region_objs = [
    for region_name, r in local.regions : {
      name = region_name
      key  = lower(replace(replace(region_name, " ", "-"), "/", "-"))
      towns = r.towns
    }
  ]

  town_objs = flatten([
    for region_name, r in local.regions : [
      for t in r.towns : {
        region_name = region_name
        region_key  = lower(replace(replace(region_name, " ", "-"), "/", "-"))
        town_name   = t
        town_key    = lower(replace(replace(t, " ", "-"), "/", "-"))
      }
    ]
  ])
}