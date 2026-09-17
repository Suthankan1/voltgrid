# ---------------------------------------------------------------------------
# Internal service discovery
# ---------------------------------------------------------------------------

resource "aws_service_discovery_private_dns_namespace" "internal" {
  name        = "voltgrid.internal"
  description = "Private service discovery namespace for VoltGrid."
  vpc         = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-internal"
  }
}


# ---------------------------------------------------------------------------
# Authorization Service discovery
# ---------------------------------------------------------------------------

resource "aws_service_discovery_service" "authorization" {
  name        = "authorization"
  description = "Internal discovery service for Authorization Service."

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.internal.id

    routing_policy = "MULTIVALUE"

    dns_records {
      ttl  = 10
      type = "A"
    }
  }

  # ECS-managed custom health is required for private service discovery.
  #
  # AWS now fixes FailureThreshold at 1, so the configuration object is
  # intentionally empty. The AWS Terraform provider currently does not
  # round-trip this empty block correctly and otherwise proposes perpetual
  # replacement of the Cloud Map service.
  health_check_custom_config {}

  lifecycle {
    ignore_changes = [
      health_check_custom_config
    ]
  }

  tags = {
    Name    = "${local.name_prefix}-authorization-discovery"
    Service = "authorization-service"
  }
}