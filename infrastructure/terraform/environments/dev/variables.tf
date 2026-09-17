variable "aws_region" {
  description = "AWS region used for the VoltGrid development environment."
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "dev"

  validation {
    condition = contains(
      [
        "dev",
        "staging",
        "prod"
      ],
      var.environment
    )

    error_message = "environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Project name used when naming AWS resources."
  type        = string
  default     = "voltgrid"
}

variable "vpc_cidr" {
  description = "IPv4 CIDR block for the VoltGrid VPC."
  type        = string
  default     = "10.20.0.0/16"
}