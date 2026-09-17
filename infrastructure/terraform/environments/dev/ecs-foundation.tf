locals {
  ecs_services = toset([
    "station-service",
    "authorization-service",
    "operations-service"
  ])
}


# ---------------------------------------------------------------------------
# ECS cluster
# ---------------------------------------------------------------------------

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  tags = {
    Name = "${local.name_prefix}-cluster"
  }
}


# ---------------------------------------------------------------------------
# ECS task execution role
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "ecs_task_execution_assume_role" {
  statement {
    effect = "Allow"

    actions = [
      "sts:AssumeRole"
    ]

    principals {
      type = "Service"

      identifiers = [
        "ecs-tasks.amazonaws.com"
      ]
    }
  }
}

resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name_prefix}-ecs-task-execution"

  assume_role_policy = data.aws_iam_policy_document.ecs_task_execution_assume_role.json

  tags = {
    Name = "${local.name_prefix}-ecs-task-execution"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role = aws_iam_role.ecs_task_execution.name

  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}


# ---------------------------------------------------------------------------
# CloudWatch logs
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "service" {
  for_each = local.ecs_services

  name              = "/voltgrid/${var.environment}/${each.value}"
  retention_in_days = 7

  tags = {
    Name    = "${local.name_prefix}-${each.value}-logs"
    Service = each.value
  }
}