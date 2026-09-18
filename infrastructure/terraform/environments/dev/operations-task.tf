# ---------------------------------------------------------------------------
# Operations Service task execution role
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "operations_task_execution_assume_role" {
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

resource "aws_iam_role" "operations_task_execution" {
  name = "${local.name_prefix}-operations-task-execution"

  assume_role_policy = data.aws_iam_policy_document.operations_task_execution_assume_role.json

  tags = {
    Name    = "${local.name_prefix}-operations-task-execution"
    Service = "operations-service"
  }
}

resource "aws_iam_role_policy_attachment" "operations_task_execution" {
  role       = aws_iam_role.operations_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "operations_task_execution_secrets" {
  statement {
    sid = "ReadOperationsDatabaseSecret"

    actions = [
      "secretsmanager:GetSecretValue"
    ]

    resources = [
      aws_secretsmanager_secret.database_service["operations"].arn
    ]
  }
}

resource "aws_iam_role_policy" "operations_task_execution_secrets" {
  name = "${local.name_prefix}-operations-task-execution-secrets"

  role   = aws_iam_role.operations_task_execution.id
  policy = data.aws_iam_policy_document.operations_task_execution_secrets.json
}


# ---------------------------------------------------------------------------
# Operations Service task definition
# ---------------------------------------------------------------------------

resource "aws_ecs_task_definition" "operations" {
  family = "${local.name_prefix}-operations-service"

  requires_compatibilities = [
    "FARGATE"
  ]

  network_mode = "awsvpc"

  cpu    = "256"
  memory = "512"

  execution_role_arn = aws_iam_role.operations_task_execution.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name = "operations-service"

      image = "${aws_ecr_repository.service["operations-service"].repository_url}:${var.operations_image_tag}"

      essential = true

      portMappings = [
        {
          containerPort = 8081
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "SERVER_PORT"
          value = "8081"
        },
        {
          # Namespace Operations behind the shared ALB so its /graphql route
          # does not collide with Station Service's /graphql route.
          name  = "SERVER_SERVLET_CONTEXT_PATH"
          value = "/operations"
        },
        {
          name  = "OPERATIONS_DB_URL"
          value = "jdbc:postgresql://${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/voltgrid_operations"
        },

        # Managed Kafka is intentionally deferred in the AWS dev environment.
        # Keep @KafkaListener containers stopped while HTTP/GraphQL and
        # PostgreSQL functionality remain available.
        {
          name  = "SPRING_KAFKA_LISTENER_AUTO_STARTUP"
          value = "false"
        },

        # AWS dev currently has no OpenTelemetry Collector.
        # Keep instrumentation in the application, but disable OTLP exporters
        # so the service does not repeatedly try localhost:4318.
        {
          name  = "MANAGEMENT_OTLP_METRICS_EXPORT_ENABLED"
          value = "false"
        },
        {
          name  = "MANAGEMENT_TRACING_EXPORT_OTLP_ENABLED"
          value = "false"
        },
        {
          name  = "MANAGEMENT_LOGGING_EXPORT_OTLP_ENABLED"
          value = "false"
        }
      ]

      secrets = [
        {
          name      = "OPERATIONS_DB_USER"
          valueFrom = "${aws_secretsmanager_secret.database_service["operations"].arn}:username::"
        },
        {
          name      = "OPERATIONS_DB_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.database_service["operations"].arn}:password::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"

        options = {
          awslogs-group         = aws_cloudwatch_log_group.service["operations-service"].name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = {
    Name    = "${local.name_prefix}-operations-service"
    Service = "operations-service"
  }
}