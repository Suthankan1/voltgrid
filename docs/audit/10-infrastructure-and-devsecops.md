# 10 — Infrastructure and DevSecOps Review

> **Audit**: VG-200 · **Commit**: `e6bf891` · **Date**: 2026-11-26

## Overview

The infrastructure foundation for VoltGrid consists of:
- **Local Dev / Testing**: Docker Compose (`compose.yaml`, `compose.operator-test.yaml`, `infrastructure/local/postgres/compose.yaml`)
- **Cloud Infrastructure as Code**: AWS Terraform (`infrastructure/terraform/`)
- **Continuous Integration**: GitHub Actions (5 workflow definitions)

---

## 1. Terraform & AWS Infrastructure Analysis

### Configuration Verification
- `terraform fmt -check`: **Passed** (clean formatting)
- `terraform init -backend=false`: **Passed** (AWS Provider `v6.62.0`)
- `terraform validate`: **Passed** (`Success! The configuration is valid.`)

### Security & Architecture Weaknesses

#### SEC-005: Public Subnets and Unrestricted Egress for Internal Services
- In `infrastructure/terraform/networking.tf` and `ecs.tf`:
  - All ECS tasks are deployed with:
    ```hcl
    network_configuration {
      subnets          = aws_subnet.public[*].id
      assign_public_ip = true
    }
    ```
  - Internal backend services (`authorization-service`, `operations-service`) and database instances are given public IP addresses.
  - Security group egress rules allow `0.0.0.0/0` across all protocols without destination filtering.
- **Impact**: Exposes internal service attack surfaces directly to the public internet without an ingress gateway or NAT boundary.

#### SEC-004: Plaintext Application Load Balancer
- In `infrastructure/terraform/alb.tf`:
  - ALB listener is configured exclusively for port 80 HTTP:
    ```hcl
    resource "aws_lb_listener" "http" {
      load_balancer_arn = aws_lb.main.arn
      port              = "80"
      protocol          = "HTTP"
    }
    ```
  - No HTTPS listener on port 443; no AWS Certificate Manager (ACM) integration.
  - No WAF (Web Application Firewall) attached to the ALB.

#### SEC-003: Missing Secret Injections in Task Definitions
- In `infrastructure/terraform/ecs.tf`:
  - Container environment blocks omit essential operational secrets, notably `HMAC_KEY` for `authorization-service`.
  - Database passwords are piped via plain environment variables rather than AWS Secrets Manager / SSM Parameter Store references (`valueFrom`).

---

## 2. Docker Compose & Local Environment Analysis

### SEC-006: Port Binding Exposure on All Interfaces (`0.0.0.0`)
- In `compose.yaml`:
  ```yaml
  ports:
    - "8080:8080" # station-service
    - "8081:8081" # operations-service
    - "9090:9090" # authorization-service
    - "5433:5432" # postgres auth
    - "5434:5432" # postgres station
    - "5435:5432" # postgres ops
    - "9092:9092" # kafka
  ```
- **Vulnerability**: Every port is published to wildcard `0.0.0.0`, exposing local dev databases, Kafka, and microservices to local networks, public Wi-Fi, and VPN interfaces.
- **Positive Note**: `compose.operator-test.yaml` correctly isolates ports using `127.0.0.1:8080:8080`.

### BUG-007: Port 9090 Conflict between Authorization Service & Prometheus
- `compose.yaml` binds `authorization-service` gRPC to `9090:9090`.
- `observability/local/compose.yaml` binds Prometheus web UI to `9090:9090`.
- **Impact**: Developers attempting to run local observability concurrently with the core services encounter port binding collisions.

---

## 3. GitHub Actions CI/CD Pipeline Audit

### Workflow Inventory
1. `.github/workflows/station-service-ci.yml`
2. `.github/workflows/authorization-service-ci.yml`
3. `.github/workflows/operations-service.yml`
4. `.github/workflows/operator-web-ci.yml`
5. `.github/workflows/authorization-flow-e2e.yml`

### Pipeline Linter (`actionlint`)
- Executed on all 5 workflows: **0 errors**.

### DevSecOps Gaps

#### INF-003: Mutable Action Version References
- Workflows reference actions using mutable major tags:
  ```yaml
  uses: actions/checkout@v4
  uses: actions/setup-java@v4
  uses: actions/setup-node@v4
  uses: pnpm/action-setup@v4
  ```
- **Risk**: Subject to supply-chain tampering if an upstream tag is moved or compromised.
- **Remediation**: Pin actions to full 40-character commit SHAs with inline version comments.

#### INF-004: Absence of Automated Security Scanners in CI
- Zero security tooling is integrated into the CI workflows:
  - No Static Application Security Testing (SAST) like CodeQL or Semgrep.
  - No Software Composition Analysis (SCA) like Trivy, Dependency-Check, or Snyk.
  - No secret scanning action (Gitleaks).
  - No container image vulnerability scanning prior to deployment.
  - No Infrastructure as Code (IaC) security scanner (Checkov or tfsec).

#### INF-005: Permissions and Concurrency Gaps
- `authorization-flow-e2e.yml` lacks top-level `permissions:` configuration (defaults to repository-wide write permissions in unhardened settings).
- Lacks `concurrency:` cancellation groups, leading to redundant runner minutes on rapid branch pushes.
