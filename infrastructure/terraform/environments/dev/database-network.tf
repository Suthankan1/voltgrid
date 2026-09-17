resource "aws_db_subnet_group" "postgres" {
  name        = "${local.name_prefix}-postgres"
  description = "Private subnets available to VoltGrid PostgreSQL databases."

  subnet_ids = [
    for subnet in aws_subnet.private :
    subnet.id
  ]

  tags = {
    Name = "${local.name_prefix}-postgres"
  }
}


# ---------------------------------------------------------------------------
# Station database
# ---------------------------------------------------------------------------

resource "aws_security_group" "station_db" {
  name        = "${local.name_prefix}-station-db-sg"
  description = "Controls access to the Station Service PostgreSQL database."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-station-db-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "station_to_station_db" {
  security_group_id = aws_security_group.station_db.id

  description = "Allow PostgreSQL only from Station Service."

  referenced_security_group_id = aws_security_group.station.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}


# ---------------------------------------------------------------------------
# Authorization database
# ---------------------------------------------------------------------------

resource "aws_security_group" "authorization_db" {
  name        = "${local.name_prefix}-authorization-db-sg"
  description = "Controls access to the Authorization Service PostgreSQL database."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-authorization-db-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "authorization_to_authorization_db" {
  security_group_id = aws_security_group.authorization_db.id

  description = "Allow PostgreSQL only from Authorization Service."

  referenced_security_group_id = aws_security_group.authorization.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}


# ---------------------------------------------------------------------------
# Operations database
# ---------------------------------------------------------------------------

resource "aws_security_group" "operations_db" {
  name        = "${local.name_prefix}-operations-db-sg"
  description = "Controls access to the Operations Service PostgreSQL database."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-operations-db-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "operations_to_operations_db" {
  security_group_id = aws_security_group.operations_db.id

  description = "Allow PostgreSQL only from Operations Service."

  referenced_security_group_id = aws_security_group.operations.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}