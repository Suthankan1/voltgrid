# ---------------------------------------------------------------------------
# Authorization Service
# ---------------------------------------------------------------------------

resource "aws_ecs_service" "authorization" {
  name    = "${local.name_prefix}-authorization-service"
  cluster = aws_ecs_cluster.main.id

  task_definition = aws_ecs_task_definition.authorization.arn

  desired_count = var.services_desired_count
  launch_type   = "FARGATE"

  platform_version = "1.4.0"

  # Keep the existing Authorization task running while its replacement starts.
  # For desired_count = 1, ECS may temporarily run two tasks during rollout.
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets = [
      for subnet in aws_subnet.public :
      subnet.id
    ]

    security_groups = [
      aws_security_group.authorization.id
    ]

    assign_public_ip = true
  }

  service_registries {
    registry_arn = aws_service_discovery_service.authorization.arn
  }

  enable_ecs_managed_tags = true
  propagate_tags          = "SERVICE"

  tags = {
    Name    = "${local.name_prefix}-authorization-service"
    Service = "authorization-service"
  }

  # GitHub Actions manages new task-definition revisions.
  # Terraform continues to own the ECS service infrastructure itself.
  lifecycle {
    ignore_changes = [
      task_definition
    ]
  }

  depends_on = [
    aws_iam_role_policy.authorization_task_execution_secrets
  ]
}