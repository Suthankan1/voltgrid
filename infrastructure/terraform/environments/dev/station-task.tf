# ---------------------------------------------------------------------------
# Station Service task execution role
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "station_task_execution_assume_role" {
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

resource "aws_iam_role" "station_task_execution" {
  name = "${local.name_prefix}-station-task-execution"

  assume_role_policy = data.aws_iam_policy_document.station_task_execution_assume_role.json

  tags = {
    Name    = "${local.name_prefix}-station-task-execution"
    Service = "station-service"
  }
}

resource "aws_iam_role_policy_attachment" "station_task_execution" {
  role       = aws_iam_role.station_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "station_task_execution_secrets" {
  statement {
    sid = "ReadStationDatabaseSecret"

    actions = [
      "secretsmanager:GetSecretValue"
    ]

    resources = [
      aws_secretsmanager_secret.database_service["station"].arn
    ]
  }
}

resource "aws_iam_role_policy" "station_task_execution_secrets" {
  name = "${local.name_prefix}-station-task-execution-secrets"

  role   = aws_iam_role.station_task_execution.id
  policy = data.aws_iam_policy_document.station_task_execution_secrets.json
}


# ---------------------------------------------------------------------------
# Station Service task definition
# ---------------------------------------------------------------------------

resource "aws_ecs_task_definition" "station" {
  family = "${local.name_prefix}-station-service"

  requires_compatibilities = [
    "FARGATE"
  ]

  network_mode = "awsvpc"

  cpu    = "256"
  memory = "512"

  execution_role_arn = aws_iam_role.station_task_execution.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name = "station-service"

      image = "${aws_ecr_repository.service["station-service"].repository_url}:${var.station_image_tag}"

      essential = true

      portMappings = [
        {
          containerPort = 8080
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "STATION_DB_URL"
          value = "jdbc:postgresql://${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/voltgrid_station"
        },
        {
          name  = "AUTHORIZATION_GRPC_HOST"
          value = "authorization.${aws_service_discovery_private_dns_namespace.internal.name}"
        },
        {
          name  = "AUTHORIZATION_GRPC_PORT"
          value = "9090"
        },
        {
          name  = "OUTBOX_RELAY_ENABLED"
          value = "false"
        }
      ]

      secrets = [
        {
          name      = "STATION_DB_USER"
          valueFrom = "${aws_secretsmanager_secret.database_service["station"].arn}:username::"
        },
        {
          name      = "STATION_DB_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.database_service["station"].arn}:password::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"

        options = {
          awslogs-group         = aws_cloudwatch_log_group.service["station-service"].name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = {
    Name    = "${local.name_prefix}-station-service"
    Service = "station-service"
  }
}