output "vpc_id" {
  description = "ID of the VoltGrid VPC."
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs keyed by availability zone."
  value = {
    for az, subnet in aws_subnet.public :
    az => subnet.id
  }
}

output "private_subnet_ids" {
  description = "Private subnet IDs keyed by availability zone."
  value = {
    for az, subnet in aws_subnet.private :
    az => subnet.id
  }
}

output "postgres_endpoint" {
  description = "Private endpoint of the VoltGrid development PostgreSQL instance."
  value       = aws_db_instance.postgres.address
}

output "postgres_port" {
  description = "Port of the VoltGrid development PostgreSQL instance."
  value       = aws_db_instance.postgres.port
}

output "postgres_master_secret_arn" {
  description = "Secrets Manager ARN containing the RDS master credentials."
  value       = aws_db_instance.postgres.master_user_secret[0].secret_arn
  sensitive   = true
}

output "ecr_repository_urls" {
  description = "ECR repository URLs for VoltGrid services."

  value = {
    for service, repository in aws_ecr_repository.service :
    service => repository.repository_url
  }
}

output "github_actions_ecr_role_arn" {
  description = "IAM role assumed by GitHub Actions when publishing VoltGrid images to ECR."
  value       = aws_iam_role.github_actions_ecr.arn
}