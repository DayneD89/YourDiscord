variable "discord_token" {
  type      = string
  sensitive = true
}
variable "env" {
  default = "dev"
}