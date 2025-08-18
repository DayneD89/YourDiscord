locals {
  regions = {
    "North East" = {
      towns = [
        "Newcastle",
        "Gateshead",
        "Sunderland",
        "Durham",
        "Darlington",
        "Middlesbrough",
        "Hartlepool",
        "Stockton-on-Tees",
        "South Shields/Tynemouth",
        "Berwick-upon-Tweed",
        "Blyth/Ashington/Morpeth"
      ]
    },
    "North West" = {
      towns = [
        "Manchester",
        "Liverpool",
        "Preston",
        "Blackpool",
        "Bolton",
        "Oldham",
        "Stockport",
        "Warrington",
        "Blackburn",
        "Burnley"
      ]
    },
    "Yorkshire and Humber" = {
      towns = [
        "Leeds",
        "Sheffield",
        "Bradford",
        "Hull",
        "York",
        "Wakefield",
        "Huddersfield",
        "Doncaster",
        "Rotherham",
        "Barnsley"
      ]
    }
  }

  region_names_sorted = sort(keys(local.regions))

  region_objs = [
    for rn in local.region_names_sorted : {
      name  = rn
      key   = lower(replace(replace(rn, " ", "-"), "/", "-"))
      towns = local.regions[rn].towns
    }
  ]

  town_objs = flatten([
    for rn in local.region_names_sorted : [
      for t in local.regions[rn].towns : {
        region_name = rn
        region_key  = lower(replace(replace(rn, " ", "-"), "/", "-"))
        town_name   = t
        town_key    = lower(replace(replace(t, " ", "-"), "/", "-"))
      }
    ]
  ])

  emoji_pool = [
    "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟",
    "🅰️", "🅱️", "✅", "❌", "⭕", "❎", "✳️", "✴️", "❇️",
    "🔺", "🔻", "🔸", "🔹", "🔷", "🔶",
    "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚪", "⚫",
    "⬜", "⬛", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫",
    "◀️", "▶️", "⏹️", "⏺️", "⏯️", "⏸️", "⏭️", "⏮️",
    "⏫", "⏬", "⏪", "⏩"
  ]

  region_picker_header = [
    "**Choose your region**",
    "React with the emoji shown next to your region:",
    ""
  ]

  region_picker_lines = [
    for i, r in local.region_objs :
    format("%s  **%s**", local.emoji_pool[i], r.name)
    if i < length(local.emoji_pool)
  ]

  region_picker_content = join("\n", concat(
    local.region_picker_header,
    local.region_picker_lines
  ))

  per_region_town_content = {
    for r in local.region_objs :
    r.key => join("\n", concat(
      [
        format("**%s — Towns**", r.name),
        "React with the emoji next to any towns you want to subscribe to:",
        ""
      ],
      [
        for j, t in r.towns :
        format("%s  %s", local.emoji_pool[j], t)
        if j < length(local.emoji_pool)
      ],
      length(r.towns) > length(local.emoji_pool)
      ? ["", "_(Truncated — add more emojis to the pool or split across messages.)_"]
      : []
    ))
  }
}

# =============================================================================
# INFRASTRUCTURE LOCALS
# =============================================================================

locals {
  # Environment-based naming
  name = "yourdiscord-${var.env}"

  # Network configuration - references networking.tf
  # vpc_id and subnet_id are now defined in networking.tf

  # Environment-specific private subnet CIDR blocks to avoid conflicts
  private_subnet_cidr = var.env == "main" ? "172.31.240.0/24" : "172.31.245.0/24"
  
  # Environment-specific event reminder intervals
  # Production: 7 days and 24 hours before events
  # Development: 5 minutes and 2 minutes before event (for fast testing)
  reminder_intervals = var.env == "main" ? {
    weekReminder = 7 * 24 * 60 * 60 * 1000    # 7 days in milliseconds
    dayReminder = 24 * 60 * 60 * 1000          # 24 hours in milliseconds
  } : {
    weekReminder = 5 * 60 * 1000               # 5 minutes before event
    dayReminder = 2 * 60 * 1000                # 2 minutes before event
  }
}
