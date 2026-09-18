# VoltGrid

VoltGrid is a distributed EV Charging Network Platform / Charging Station Management System (CSMS) built as a learning-focused backend engineering project.

The project is developed incrementally so each distributed-systems concept is introduced because the system has a concrete need for it.

## Current Architecture

```text
                          Internet
                             |
                             v
                 +-----------------------+
                 | AWS Application       |
                 | Load Balancer         |
                 +-----------------------+
                    |                |
                    |                |
             default routes     /operations/*
                    |                |
                    v                v
          +----------------+   +-------------------+
          | Station        |   | Operations        |
          | Service        |   | Service           |
          +----------------+   +-------------------+
             |       |                 ^
             |       |                 |
             |       | gRPC            | Kafka
             |       v                 |
             |  +----------------+     |
             |  | Authorization  |     |
             |  | Service        |     |
             |  +----------------+     |
             |                         |
             +------ Outbox -----------+
```

Charging stations connect to Station Service using OCPP 2.0.1 over WebSocket.

Station Service communicates synchronously with Authorization Service using gRPC and publishes domain events through a transactional outbox to Kafka.

Operations Service consumes station-status events and maintains its own PostgreSQL-backed read projection.

Each service owns its own logical database boundary.

## Services

### Station Service

Station Service owns charging-station connectivity and transaction processing.

It currently provides:

* charging-station registration
* OCPP 2.0.1 WebSocket connectivity
* BootNotification and Heartbeat processing
* station liveness tracking
* connector StatusNotification processing
* Authorize processing through Authorization Service
* TransactionEvent Started / Updated / Ended processing
* transaction and meter-sample persistence
* retransmission and idempotency handling
* late and out-of-order transaction-event handling
* transaction completeness tracking
* concurrency-safe transaction processing
* GraphQL APIs
* PostgreSQL persistence with Flyway
* PostgreSQL/Testcontainers integration testing
* transactional outbox event publication
* OpenTelemetry tracing and metrics
* Docker and AWS ECS deployment

See:

```text
services/station-service/README.md
```

for Station Service implementation details.

### Authorization Service

Authorization Service owns charging-token authorization decisions.

It currently provides:

* gRPC authorization API
* Protocol Buffer contracts
* persisted authorization tokens
* token fingerprinting
* ACTIVE / BLOCKED / EXPIRED token handling
* unknown-token handling
* PostgreSQL persistence with Flyway
* Testcontainers integration testing
* internal AWS service discovery through Cloud Map
* Docker and AWS ECS deployment

The runtime path is:

```text
Charging Station
       |
       | OCPP Authorize
       v
Station Service
       |
       | gRPC
       v
Authorization Service
       |
       | authorization decision
       v
Station Service
       |
       | OCPP response
       v
Charging Station
```

### Operations Service

Operations Service consumes asynchronous station events and maintains operational read models.

It currently provides:

* Kafka StationStatusChanged event consumption
* consumer-owned event parsing
* PostgreSQL-backed station-status projection
* durable consumer idempotency
* processed-event receipts
* stale-event protection
* concurrent duplicate-delivery protection
* Kafka/Testcontainers integration testing
* GraphQL APIs
* readiness and health probes
* Docker and AWS ECS deployment

The asynchronous path is:

```text
Station Service
       |
       | transactional outbox
       v
Kafka
       |
       v
Operations Service
       |
       v
PostgreSQL projection
```

## Reliability and Distributed-Systems Features

VoltGrid currently includes:

* transactional outbox publishing
* idempotent Kafka consumers
* duplicate-delivery handling
* concurrent duplicate protection
* stale-event protection
* transaction retransmission handling
* out-of-order event handling
* database uniqueness boundaries
* readiness and health probes
* graceful service boundaries
* immutable container image deployment
* deployment circuit breakers

## Observability

VoltGrid includes OpenTelemetry-based observability.

Current local observability includes:

* distributed tracing
* OCPP message-processing spans
* Station → Authorization gRPC trace propagation
* Station outbox → Kafka → Operations trace propagation
* persisted W3C trace context
* trace/span log correlation
* Prometheus metrics
* Station outbox backlog metric
* Jaeger tracing
* OpenTelemetry Collector

The AWS dev environment currently does not run an OpenTelemetry Collector, so OTLP exporters that require the collector are disabled there.

## Local Infrastructure

Local development uses Docker-based infrastructure including:

* PostgreSQL
* Apache Kafka
* OpenTelemetry Collector
* Jaeger
* Prometheus

Kafka is configured with separate listeners for host applications and Docker containers.

Testcontainers is used extensively for real PostgreSQL and Kafka integration tests.

## AWS Deployment

The backend is deployed to AWS in:

```text
ap-southeast-1
```

The dev environment is managed with Terraform.

Current AWS infrastructure includes:

* VPC with public and private subnets across two availability zones
* Internet Gateway
* security-group-based service boundaries
* private encrypted PostgreSQL RDS
* AWS Secrets Manager
* Amazon ECR
* Amazon ECS with Fargate
* AWS Cloud Map private service discovery
* Application Load Balancer
* CloudWatch Logs
* GitHub Actions OIDC federation

### AWS Service Routing

The shared Application Load Balancer routes:

```text
/operations/*
        |
        v
Operations Service :8081
```

All other backend routes are forwarded to:

```text
Station Service :8080
```

This includes:

```text
/graphql
/actuator/*
/ocpp/{stationId}
```

Authorization Service is not exposed publicly.

Station Service reaches it through:

```text
authorization.voltgrid.internal:9090
```

using AWS Cloud Map and gRPC.

### Security Boundaries

The deployed environment uses the following network boundaries:

```text
Internet
   |
   | HTTP :80
   v
Application Load Balancer
   |
   +---- :8080 ----> Station Service
   |
   +---- :8081 ----> Operations Service

Station Service
   |
   +---- :9090 ----> Authorization Service

Station Service
   |
   +---- :5432 ----> Station database

Authorization Service
   |
   +---- :5432 ----> Authorization database

Operations Service
   |
   +---- :5432 ----> Operations database
```

RDS is private and encrypted.

Station, Authorization, and Operations do not allow direct public application ingress.

### Cost-Conscious Dev Architecture

The AWS environment intentionally avoids infrastructure that would add unnecessary cost for the current learning and portfolio scope.

The dev environment currently uses:

* no NAT Gateway
* no Amazon MSK
* no managed Kafka deployment
* no public Route 53 domain
* no ACM certificate
* no production-grade high-availability RDS configuration

ECS tasks use public IPs for outbound connectivity while security groups restrict inbound access.

The number of running service tasks can be controlled through:

```hcl
services_desired_count = 1
```

Set it to:

```hcl
services_desired_count = 0
```

and apply Terraform when the AWS backend does not need to be running.

### HTTPS

The current AWS dev endpoint is HTTP-only.

HTTPS is intentionally deferred until VoltGrid has a public domain that can be validated through AWS Certificate Manager.

The existing private DNS zone:

```text
voltgrid.internal
```

is used only for internal service discovery and cannot serve as the public TLS domain.

## Kafka in AWS

The full Kafka architecture is implemented and verified locally using real Kafka and Testcontainers.

Managed Kafka is intentionally deferred from the AWS dev deployment because the cost is not justified for the current project stage.

In AWS:

* Station Service keeps the outbox relay disabled
* Operations Service keeps Kafka listeners disabled

The complete event-driven flow remains exercised locally:

```text
Station Service
       |
       v
Transactional Outbox
       |
       v
Kafka
       |
       v
Operations Service
       |
       v
PostgreSQL
```

A lower-cost managed Kafka provider can be evaluated later if a fully cloud-hosted asynchronous path becomes necessary.

## CI/CD

GitHub Actions provides CI/CD for all three backend services.

For pushes to `main`, each service pipeline performs:

```text
Tests
  |
  v
ARM64 Docker build
  |
  v
Immutable image tagged with Git commit SHA
  |
  v
Amazon ECR
  |
  v
New ECS task-definition revision
  |
  v
ECS service deployment
  |
  v
Service stability verification
```

AWS authentication from GitHub Actions uses OpenID Connect rather than long-lived AWS access keys.

Terraform continues to own ECS infrastructure, while GitHub Actions owns deployment of newer task-definition revisions.

## Infrastructure as Code

Terraform configuration lives under:

```text
infrastructure/terraform/environments/dev
```

Terraform currently manages:

* networking
* routing
* security groups
* RDS networking
* PostgreSQL RDS
* Secrets Manager secret resources
* ECR repositories
* GitHub OIDC and deployment IAM
* ECS cluster
* ECS task definitions
* ECS services
* Cloud Map service discovery
* Application Load Balancer
* target groups and routing
* CloudWatch log groups

Normal infrastructure workflow:

```bash
terraform fmt -recursive
terraform validate
terraform plan
terraform apply
terraform plan
```

The final plan should return:

```text
No changes. Your infrastructure matches the configuration.
```

Terraform state and real environment-specific variable files must not be committed.

## Technology Stack

VoltGrid currently uses:

* Java 25
* Spring Boot 4
* Spring Data JPA / Hibernate
* PostgreSQL
* Flyway
* GraphQL
* gRPC
* Protocol Buffers
* OCPP 2.0.1
* WebSockets
* Apache Kafka
* Testcontainers
* OpenTelemetry
* Prometheus
* Jaeger
* Docker
* Terraform
* AWS
* GitHub Actions

## Learning Goals

VoltGrid is being used to learn and apply:

* microservices architecture
* service ownership and boundaries
* synchronous gRPC communication
* asynchronous event-driven communication
* transactional outbox patterns
* distributed idempotency
* concurrency control
* event ordering and replay handling
* PostgreSQL design
* GraphQL
* OCPP and WebSockets
* Kafka event processing
* distributed tracing
* containerization
* infrastructure as code
* AWS networking and security
* cloud deployment
* CI/CD
* cost-aware cloud architecture

## Development Approach

VoltGrid is built through small, independently understandable features.

Each feature introduces a concrete capability or solves a real system problem rather than adding technology only for its own sake.

Important architectural decisions and learning notes live under:

```text
docs/
```

The Git history is intentionally incremental so the evolution of the system and its architecture can be followed over time.

## Current Status

The backend platform currently has:

* three independently deployed microservices
* PostgreSQL persistence boundaries
* OCPP WebSocket connectivity
* synchronous gRPC service communication
* Kafka-based asynchronous communication
* transactional outbox publishing
* durable consumer idempotency
* GraphQL APIs
* distributed tracing
* production-style container images
* Terraform-managed AWS infrastructure
* automated GitHub Actions → ECR → ECS deployment

The AWS/Terraform backend deployment milestone is complete.

The next major project phase is the VoltGrid frontend and operator experience.
