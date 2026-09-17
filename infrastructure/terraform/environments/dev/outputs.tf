output "vpc_id" {
  description = "ID of the VoltGrid VPC."
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs keyed by availability zone."
  value = {
    for az, subnet in aws_subnet.public :
    az => subnet.id
  }
}

output "private_subnet_ids" {
  description = "Private subnet IDs keyed by availability zone."
  value = {
    for az, subnet in aws_subnet.private :
    az => subnet.id
  }
}