resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Controls traffic for the VoltGrid application load balancer."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-alb-sg"
  }
}

resource "aws_security_group" "station" {
  name        = "${local.name_prefix}-station-sg"
  description = "Controls traffic for the VoltGrid Station Service."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-station-sg"
  }
}

resource "aws_security_group" "authorization" {
  name        = "${local.name_prefix}-authorization-sg"
  description = "Controls traffic for the VoltGrid Authorization Service."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-authorization-sg"
  }
}

resource "aws_security_group" "operations" {
  name        = "${local.name_prefix}-operations-sg"
  description = "Controls traffic for the VoltGrid Operations Service."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-operations-sg"
  }
}


# ---------------------------------------------------------------------------
# Application Load Balancer
# ---------------------------------------------------------------------------

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id

  description = "Allow public HTTP traffic."

  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 80
  to_port     = 80
  ip_protocol = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_station" {
  security_group_id = aws_security_group.alb.id

  description = "Allow ALB traffic to Station Service."

  referenced_security_group_id = aws_security_group.station.id
  from_port                    = 8080
  to_port                      = 8080
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_operations" {
  security_group_id = aws_security_group.alb.id

  description = "Allow ALB traffic to Operations Service."

  referenced_security_group_id = aws_security_group.operations.id
  from_port                    = 8081
  to_port                      = 8081
  ip_protocol                  = "tcp"
}


# ---------------------------------------------------------------------------
# Station Service
# ---------------------------------------------------------------------------

resource "aws_vpc_security_group_ingress_rule" "station_from_alb" {
  security_group_id = aws_security_group.station.id

  description = "Allow Station Service traffic only from the ALB."

  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 8080
  to_port                      = 8080
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "station_all" {
  security_group_id = aws_security_group.station.id

  description = "Allow outbound traffic from Station Service."

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}


# ---------------------------------------------------------------------------
# Authorization Service
# ---------------------------------------------------------------------------

resource "aws_vpc_security_group_ingress_rule" "authorization_from_station" {
  security_group_id = aws_security_group.authorization.id

  description = "Allow gRPC authorization requests only from Station Service."

  referenced_security_group_id = aws_security_group.station.id
  from_port                    = 9090
  to_port                      = 9090
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "authorization_all" {
  security_group_id = aws_security_group.authorization.id

  description = "Allow outbound traffic from Authorization Service."

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}


# ---------------------------------------------------------------------------
# Operations Service
# ---------------------------------------------------------------------------

resource "aws_vpc_security_group_ingress_rule" "operations_from_alb" {
  security_group_id = aws_security_group.operations.id

  description = "Allow Operations Service traffic only from the ALB."

  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 8081
  to_port                      = 8081
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "operations_all" {
  security_group_id = aws_security_group.operations.id

  description = "Allow outbound traffic from Operations Service."

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}