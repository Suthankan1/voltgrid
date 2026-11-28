# Development ingress and ECR verification

The public development load balancer accepts TLS on port 443. Its listener sends the default route to Station and `/operations` and `/operations/*` to Operations. Both ECS services wait for their corresponding HTTPS routing resources. The prior configuration forwarded Operations over HTTP even when a certificate was configured, forwarded the default HTTP route when a certificate was absent, and opened only port 80 in the load balancer security group.

## Migration and access

Set `acm_certificate_arn` to an issued ACM certificate for the intended hostname in the configured region. Use HTTPS and WSS on that hostname. Update HTTP-only clients before a future cutover. A missing or invalid ARN prevents a plan. Terraform's moved blocks carry forward existing HTTPS listener and rule addresses. Review the planned removal of the port 80 listener, rule and ingress permission. An owner-approved rollback should use a reviewed configuration that keeps TLS at the public boundary.

Each service ECR repository requests a scan on push. Before accepting a deployment, verify the regional registry's effective scan frequency and a finding report for the pushed image digest. AWS also supports registry-wide scanning policy. Changing the account's policy can affect other repositories. [Amazon ECR basic scanning](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning-basic-enabling.html)

## Local results

Terraform 1.16.3, AWS provider 6.62.0. Formatting, validation and three full mock-provider plans passed. The plans exercise certificate-backed routing and repository settings, an empty certificate and a certificate from another region. The mock uses synthetic AZs and policy documents. These checks made no AWS calls.

Trivy 0.76.2, using the same embedded checks on both trees, reported the following Terraform matches. The baseline is main `88584e07f636666152d88b76e3098e60ca570b9a`.

| Scope | Critical | High | Medium | Low |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 4 | 4 | 4 | 11 |
| Proposed configuration | 3 | 1 | 4 | 11 |

The Critical plaintext-listener finding AWS-0054 and three High ECR scan findings AWS-0030 clear on the proposed configuration. Three Critical AWS-0104 findings remain on the service egress rules. One High AWS-0053 finding remains on the public load balancer. Internal HTTP target groups, deployed certificate identity and rotation, end-to-end WSS, network reachability, registry scan evidence and disposition of residual findings remain open in #5 and #8.
