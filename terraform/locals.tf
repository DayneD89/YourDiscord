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
    },
    "East Midlands" = {
      towns = [
        "Nottingham",
        "Leicester",
        "Derby",
        "Lincoln",
        "Northampton",
        "Mansfield",
        "Chesterfield",
        "Kettering",
        "Wellingborough",
        "Corby"
      ]
    },
    "West Midlands" = {
      towns = [
        "Birmingham",
        "Coventry",
        "Wolverhampton",
        "Stoke-on-Trent",
        "Dudley",
        "Walsall",
        "West Bromwich",
        "Solihull",
        "Worcester",
        "Hereford"
      ]
    },
    "East of England" = {
      towns = [
        "Norwich",
        "Cambridge",
        "Luton",
        "Southend-on-Sea",
        "Peterborough",
        "Ipswich",
        "Colchester",
        "Chelmsford",
        "Watford",
        "St Albans"
      ]
    },
    "London" = {
      towns = [
        "Central London",
        "North London",
        "South London",
        "East London",
        "West London",
        "Croydon",
        "Bromley",
        "Barnet",
        "Ealing",
        "Enfield"
      ]
    },
    "South East" = {
      towns = [
        "Brighton",
        "Reading",
        "Oxford",
        "Canterbury",
        "Guildford",
        "Maidstone",
        "Basingstoke",
        "Crawley",
        "Slough",
        "High Wycombe"
      ]
    },
    "South West" = {
      towns = [
        "Bristol",
        "Plymouth",
        "Exeter",
        "Bath",
        "Gloucester",
        "Cheltenham",
        "Swindon",
        "Bournemouth",
        "Poole",
        "Taunton"
      ]
    },
    "Wales" = {
      towns = [
        "Cardiff",
        "Swansea",
        "Newport",
        "Wrexham",
        "Merthyr Tydfil",
        "Barry",
        "Caerphilly",
        "Neath",
        "Port Talbot",
        "Rhondda"
      ]
    },
    "Scotland" = {
      towns = [
        "Glasgow",
        "Edinburgh",
        "Aberdeen",
        "Dundee",
        "Stirling",
        "Perth",
        "Inverness",
        "Kirkcaldy",
        "Ayr",
        "Greenock"
      ]
    },
    "Northern Ireland" = {
      towns = [
        "Belfast",
        "Derry/Londonderry",
        "Lisburn",
        "Newry",
        "Carrickfergus",
        "Coleraine",
        "Ballymena",
        "Newtownabbey",
        "Bangor",
        "Craigavon"
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
    "1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟",
    "🅰️","🅱️","✅","❌","⭕","❎","✳️","✴️","❇️",
    "🔺","🔻","🔸","🔹","🔷","🔶",
    "🔴","🟠","🟡","🟢","🔵","🟣","🟤","⚪","⚫",
    "⬜","⬛","🟥","🟧","🟨","🟩","🟦","🟪","🟫",
    "◀️","▶️","⏹️","⏺️","⏯️","⏸️","⏭️","⏮️",
    "⏫","⏬","⏪","⏩"
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
