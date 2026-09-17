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

variable "authorization_image_tag" {
  description = "Immutable ECR image tag deployed by the Authorization Service task definition."
  type        = string

  default = "bd698ad89cb3e92c81b4308f296af1662eab08a9"
}

variable "station_image_tag" {
  description = "Immutable ECR image tag deployed by the Station Service task definition."
  type        = string

  default = "289000de57ff695af034fc10e278a545e3587569"
}

variable "operations_image_tag" {
  description = "Immutable ECR image tag deployed by the Operations Service task definition."
  type        = string

  default = "bd698ad89cb3e92c81b4308f296af1662eab08a9"
}