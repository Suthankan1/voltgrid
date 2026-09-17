locals {
  database_service_credentials = {
    station = {
      username = "station_service"
      database = "voltgrid_station"
    }

    authorization = {
      username = "authorization_service"
      database = "voltgrid_authorization"
    }

    operations = {
      username = "operations_service"
      database = "voltgrid_operations"
    }
  }
}

resource "aws_secretsmanager_secret" "database_service" {
  for_each = local.database_service_credentials

  name = "/voltgrid/${var.environment}/database/${each.key}"

  description = "PostgreSQL credentials for the VoltGrid ${each.key} service."

  # Appropriate for disposable development infrastructure.
  recovery_window_in_days = 0

  tags = {
    Name    = "${local.name_prefix}-${each.key}-database-credentials"
    Service = each.key
  }
}