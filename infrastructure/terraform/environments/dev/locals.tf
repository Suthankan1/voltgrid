locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = "VoltGrid"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}