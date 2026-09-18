# ---------------------------------------------------------------------------
# Station Service
# ---------------------------------------------------------------------------

resource "aws_ecs_service" "station" {
  name    = "${local.name_prefix}-station-service"
  cluster = aws_ecs_cluster.main.id

  task_definition = aws_ecs_task_definition.station.arn

  desired_count = var.services_desired_count
  launch_type   = "FARGATE"

  platform_version = "1.4.0"

  # Cost-conscious dev deployment:
  # allow ECS to stop the old task before starting its replacement.
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  # Station takes around a minute to finish Spring Boot startup.
  # Ignore ALB health-check failures during this startup window.
  health_check_grace_period_seconds = 120

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

  load_balancer {
    target_group_arn = aws_lb_target_group.station.arn
    container_name   = "station-service"
    container_port   = 8080
  }

  enable_ecs_managed_tags = true
  propagate_tags          = "SERVICE"

  tags = {
    Name    = "${local.name_prefix}-station-service"
    Service = "station-service"
  }

  # GitHub Actions will register and deploy new immutable task-definition
  # revisions. Terraform continues to own the ECS service infrastructure,
  # but should not revert task-definition revisions deployed by CI/CD.
  lifecycle {
    ignore_changes = [
      task_definition
    ]
  }

  depends_on = [
    aws_iam_role_policy.station_task_execution_secrets,
    aws_ecs_service.authorization,
    aws_lb_listener.http
  ]
}