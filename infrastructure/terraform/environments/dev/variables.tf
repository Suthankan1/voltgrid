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

variable "authorization_token_hmac_key" {
  description = "HMAC secret key for authorization token hashing."
  type        = string
  default     = ""
  sensitive   = true
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for the public HTTPS listener, issued in aws_region."
  type        = string
  nullable    = false

  validation {
    condition = (
      can(regex("^arn:[a-z0-9-]+:acm:[a-z0-9-]+:[0-9]{12}:certificate/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$", var.acm_certificate_arn)) &&
      try(split(":", var.acm_certificate_arn)[3], "") == var.aws_region
    )
    error_message = "Provide an ACM certificate ARN for the configured AWS region."
  }
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

variable "services_desired_count" {
  description = "Desired ECS task count for each VoltGrid backend service in the dev environment."
  type        = number
  default     = 1

  validation {
    condition     = contains([0, 1], var.services_desired_count)
    error_message = "services_desired_count must be either 0 or 1 in the dev environment."
  }
}

variable "postgres_ssl_mode" {
  description = "PostgreSQL SSL mode for backend database connectivity with certificate and hostname verification."
  type        = string
  default     = "verify-full"

  validation {
    condition     = var.postgres_ssl_mode == "verify-full"
    error_message = "PostgreSQL connections must use verify-full."
  }
}