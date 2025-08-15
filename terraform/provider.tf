terraform {
  backend "s3" {
    bucket  = "yourdiscord-terraform-state"
    region  = "us-west-2"
    encrypt = true
  }
  required_providers {
    discord = {
      source = "Lucky3028/discord"
      version = "2.1.0"
    }
  }
}

provider discord {
    token = var.discord_token
}