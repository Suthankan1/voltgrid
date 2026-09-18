# ---------------------------------------------------------------------------
# Operations Service
# ---------------------------------------------------------------------------

resource "aws_ecs_service" "operations" {
  name    = "${local.name_prefix}-operations-service"
  cluster = aws_ecs_cluster.main.id

  task_definition = aws_ecs_task_definition.operations.arn

  desired_count = 1
  launch_type   = "FARGATE"

  platform_version = "1.4.0"

  # Cost-conscious dev deployment:
  # avoid temporarily running two tasks during replacement deployments.
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
      aws_security_group.operations.id
    ]

    assign_public_ip = true
  }

  enable_ecs_managed_tags = true
  propagate_tags          = "SERVICE"

  tags = {
    Name    = "${local.name_prefix}-operations-service"
    Service = "operations-service"
  }

  depends_on = [
    aws_iam_role_policy.operations_task_execution_secrets
  ]
}