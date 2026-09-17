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

output "ecs_cluster_name" {
  description = "Name of the VoltGrid ECS cluster."
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "ARN of the VoltGrid ECS cluster."
  value       = aws_ecs_cluster.main.arn
}

output "ecs_task_execution_role_arn" {
  description = "IAM role used by ECS to pull images and publish container logs."
  value       = aws_iam_role.ecs_task_execution.arn
}

output "database_service_secret_arns" {
  description = "Secrets Manager ARNs containing service PostgreSQL credentials."

  value = {
    for service, secret in aws_secretsmanager_secret.database_service :
    service => secret.arn
  }
}

output "authorization_task_definition_arn" {
  description = "Authorization Service ECS task definition ARN."
  value       = aws_ecs_task_definition.authorization.arn
}

output "service_discovery_namespace_id" {
  description = "AWS Cloud Map private DNS namespace ID."
  value       = aws_service_discovery_private_dns_namespace.internal.id
}

output "authorization_discovery_service_arn" {
  description = "AWS Cloud Map service ARN for Authorization Service."
  value       = aws_service_discovery_service.authorization.arn
}

output "authorization_discovery_dns_name" {
  description = "Internal DNS name for Authorization Service."
  value       = "authorization.${aws_service_discovery_private_dns_namespace.internal.name}"
}

output "authorization_ecs_service_name" {
  description = "Authorization Service ECS service name."
  value       = aws_ecs_service.authorization.name
}

output "authorization_ecs_service_id" {
  description = "Authorization Service ECS service ID."
  value       = aws_ecs_service.authorization.id
}