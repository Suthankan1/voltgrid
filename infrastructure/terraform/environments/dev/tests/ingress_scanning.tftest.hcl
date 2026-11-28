# The provider is mocked. These plans make no AWS calls.
mock_provider "aws" {
  mock_data "aws_iam_policy_document" {
    defaults = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }

  mock_data "aws_availability_zones" {
    defaults = { names = ["ap-southeast-1a", "ap-southeast-1b"] }
  }
}

override_resource {
  target          = aws_lb_target_group.station
  override_during = plan
  values          = { arn = "arn:aws:elasticloadbalancing:ap-southeast-1:123456789012:targetgroup/station/0000000000000001" }
}

override_resource {
  target          = aws_lb_target_group.operations
  override_during = plan
  values          = { arn = "arn:aws:elasticloadbalancing:ap-southeast-1:123456789012:targetgroup/operations/0000000000000002" }
}

variables {
  acm_certificate_arn = "arn:aws:acm:ap-southeast-1:123456789012:certificate/00000000-0000-4000-8000-000000000000"
}

run "public_ingress_and_image_scanning" {
  command = plan

  assert {
    condition = (
      aws_lb_listener.https.protocol == "HTTPS" &&
      aws_lb_listener.https.port == 443 &&
      aws_lb_listener.https.certificate_arn == var.acm_certificate_arn &&
      aws_lb_listener.https.default_action[0].type == "forward" &&
      aws_lb_listener.https.default_action[0].target_group_arn == aws_lb_target_group.station.arn &&
      aws_lb_listener_rule.operations_https.action[0].target_group_arn == aws_lb_target_group.operations.arn &&
      one(one(aws_lb_listener_rule.operations_https.condition).path_pattern).values == toset(["/operations", "/operations/*"]) &&
      aws_lb_listener_rule.operations_https.action[0].type == "forward" &&
      aws_vpc_security_group_ingress_rule.alb_https.from_port == 443 &&
      aws_vpc_security_group_ingress_rule.alb_https.to_port == 443
    )
    error_message = "Station and Operations must use the certificate-backed HTTPS ingress."
  }

  assert {
    condition = alltrue([
      for repo in aws_ecr_repository.service : repo.image_scanning_configuration[0].scan_on_push
    ])
    error_message = "Every service repository must request a scan on image push."
  }
}

run "empty_certificate" {
  command = plan
  variables { acm_certificate_arn = "" }
  expect_failures = [var.acm_certificate_arn]
}

run "certificate_from_another_region" {
  command = plan
  variables { acm_certificate_arn = "arn:aws:acm:eu-west-1:123456789012:certificate/00000000-0000-4000-8000-000000000000" }
  expect_failures = [var.acm_certificate_arn]
}
