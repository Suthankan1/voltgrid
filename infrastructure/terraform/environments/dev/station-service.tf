# ---------------------------------------------------------------------------
# Station Service
# ---------------------------------------------------------------------------

resource "aws_ecs_service" "station" {
  name    = "${local.name_prefix}-station-service"
  cluster = aws_ecs_cluster.main.id

  task_definition = aws_ecs_task_definition.station.arn

  desired_count = 1
  launch_type   = "FARGATE"

  platform_version = "1.4.0"

  # Cost-conscious dev deployment:
  # allow ECS to stop the old task before starting its replacement.
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
      aws_security_group.station.id
    ]

    assign_public_ip = true
  }

  enable_ecs_managed_tags = true
  propagate_tags          = "SERVICE"

  tags = {
    Name    = "${local.name_prefix}-station-service"
    Service = "station-service"
  }

  depends_on = [
    aws_iam_role_policy.station_task_execution_secrets,
    aws_ecs_service.authorization
  ]
}