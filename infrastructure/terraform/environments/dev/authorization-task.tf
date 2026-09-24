# ---------------------------------------------------------------------------
# Authorization Service task execution role
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "authorization_task_execution_assume_role" {
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

resource "aws_iam_role" "authorization_task_execution" {
  name = "${local.name_prefix}-authorization-task-execution"

  assume_role_policy = data.aws_iam_policy_document.authorization_task_execution_assume_role.json

  tags = {
    Name    = "${local.name_prefix}-authorization-task-execution"
    Service = "authorization-service"
  }
}

resource "aws_iam_role_policy_attachment" "authorization_task_execution" {
  role       = aws_iam_role.authorization_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "authorization_task_execution_secrets" {
  statement {
    sid = "ReadAuthorizationDatabaseSecret"

    actions = [
      "secretsmanager:GetSecretValue"
    ]

    resources = [
      aws_secretsmanager_secret.database_service["authorization"].arn
    ]
  }
}

resource "aws_iam_role_policy" "authorization_task_execution_secrets" {
  name = "${local.name_prefix}-authorization-task-execution-secrets"

  role   = aws_iam_role.authorization_task_execution.id
  policy = data.aws_iam_policy_document.authorization_task_execution_secrets.json
}


# ---------------------------------------------------------------------------
# Authorization Service task definition
# ---------------------------------------------------------------------------

resource "aws_ecs_task_definition" "authorization" {
  family = "${local.name_prefix}-authorization-service"

  requires_compatibilities = [
    "FARGATE"
  ]

  network_mode = "awsvpc"

  cpu    = "256"
  memory = "512"

  execution_role_arn = aws_iam_role.authorization_task_execution.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name = "authorization-service"

      image = "${aws_ecr_repository.service["authorization-service"].repository_url}:${var.authorization_image_tag}"

      essential = true

      portMappings = [
        {
          containerPort = 9090
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "AUTHORIZATION_DB_URL"
          value = "jdbc:postgresql://${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/voltgrid_authorization"
        }
      ]

      secrets = [
        {
          name      = "AUTHORIZATION_DB_USER"
          valueFrom = "${aws_secretsmanager_secret.database_service["authorization"].arn}:username::"
        },
        {
          name      = "AUTHORIZATION_DB_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.database_service["authorization"].arn}:password::"
        }
      ]

      healthCheck = {
        command = [
          "CMD",
          "/usr/local/bin/grpc_health_probe",
          "-addr=127.0.0.1:9090",
          "-connect-timeout=2s",
          "-rpc-timeout=2s"
        ]

        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      logConfiguration = {
        logDriver = "awslogs"

        options = {
          awslogs-group         = aws_cloudwatch_log_group.service["authorization-service"].name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = {
    Name    = "${local.name_prefix}-authorization-service"
    Service = "authorization-service"
  }
}
