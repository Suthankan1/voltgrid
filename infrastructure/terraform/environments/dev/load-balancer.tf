# ---------------------------------------------------------------------------
# Application Load Balancer
# ---------------------------------------------------------------------------

resource "aws_lb" "main" {
  name = "${local.name_prefix}-alb"

  internal           = false
  load_balancer_type = "application"

  security_groups = [
    aws_security_group.alb.id
  ]

  subnets = [
    for subnet in aws_subnet.public :
    subnet.id
  ]

  # OCPP uses long-lived WebSocket connections.
  idle_timeout = 600

  # Dev environment.
  enable_deletion_protection = false

  # Reject malformed HTTP header names rather than forwarding them.
  drop_invalid_header_fields = true

  tags = {
    Name = "${local.name_prefix}-alb"
  }
}


# ---------------------------------------------------------------------------
# Station Service target group
# ---------------------------------------------------------------------------

resource "aws_lb_target_group" "station" {
  name = "${local.name_prefix}-station-tg"

  port        = 8080
  protocol    = "HTTP"
  target_type = "ip"

  vpc_id = aws_vpc.main.id

  deregistration_delay = 30

  health_check {
    enabled = true

    protocol = "HTTP"
    path     = "/actuator/health/readiness"

    matcher = "200"

    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name    = "${local.name_prefix}-station-tg"
    Service = "station-service"
  }
}


# ---------------------------------------------------------------------------
# Operations Service target group
# ---------------------------------------------------------------------------

resource "aws_lb_target_group" "operations" {
  name = "${local.name_prefix}-operations-tg"

  port        = 8081
  protocol    = "HTTP"
  target_type = "ip"

  vpc_id = aws_vpc.main.id

  deregistration_delay = 30

  health_check {
    enabled = true

    protocol = "HTTP"
    path     = "/operations/actuator/health/readiness"

    matcher = "200"

    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name    = "${local.name_prefix}-operations-tg"
    Service = "operations-service"
  }
}


# ---------------------------------------------------------------------------
# Public HTTPS listener
# ---------------------------------------------------------------------------

moved {
  from = aws_lb_listener.https[0]
  to   = aws_lb_listener.https
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.station.arn
  }
}

# ---------------------------------------------------------------------------
# Operations path routing
# ---------------------------------------------------------------------------

moved {
  from = aws_lb_listener_rule.operations_https[0]
  to   = aws_lb_listener_rule.operations_https
}

resource "aws_lb_listener_rule" "operations_https" {
  listener_arn = aws_lb_listener.https.arn

  priority = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.operations.arn
  }

  condition {
    path_pattern {
      values = [
        "/operations",
        "/operations/*"
      ]
    }
  }
}