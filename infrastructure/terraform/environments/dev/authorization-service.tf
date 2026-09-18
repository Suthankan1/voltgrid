# ---------------------------------------------------------------------------
# Authorization Service
# ---------------------------------------------------------------------------

resource "aws_ecs_service" "authorization" {
  name    = "${local.name_prefix}-authorization-service"
  cluster = aws_ecs_cluster.main.id

  task_definition = aws_ecs_task_definition.authorization.arn

  desired_count = 1
  launch_type   = "FARGATE"

  platform_version = "1.4.0"

  # Cost-conscious dev deployment:
  #
  # With one desired task, this allows ECS to stop the old task before
  # starting the replacement instead of temporarily running two tasks.
  #
  # This accepts brief deployment downtime in dev in exchange for avoiding
  # temporary duplicate Fargate/public-IPv4 cost.
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

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