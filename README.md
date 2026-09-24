# VoltGrid

VoltGrid is a distributed EV Charging Network Platform / Charging Station Management System (CSMS) built as a learning-focused backend engineering project.

The project is developed incrementally so each distributed-systems concept is introduced because the system has a concrete need for it.

## Current Architecture

VoltGrid currently runs as a reproducible local distributed system using Docker Compose.

```text
Charging Station
       |
       | OCPP 2.0.1 / WebSocket
       v
+-------------------+
| Station Service   |
| :8080             |
+-------------------+
       |        |
       | gRPC   | transactional outbox
       v        v
+-------------------+       +---------+
| Authorization     |       | Kafka   |
| Service :9090     |       +---------+
+-------------------+            |
                                 v
                         +-------------------+
                         | Operations        |
                         | Service :8081     |
                         +-------------------+
                                 |
                                 v
                         PostgreSQL projection
```

Charging stations communicate with Station Service using OCPP 2.0.1 over WebSocket.

Station Service calls Authorization Service synchronously through gRPC.

Station status changes are persisted through a transactional outbox and published to Kafka.

Operations Service consumes those events and maintains its own PostgreSQL-backed operational projection.

Each service owns its own PostgreSQL database boundary.

The complete local platform can be started from the repository root with:

```bash
docker compose up -d --build
```

A reproducible walkthrough is available in:

```text
docs/local-demo.md
```
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
* Docker containerization and previously verified AWS ECS deployment

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
* gRPC health support and previously verified AWS Cloud Map service discovery
* Docker containerization and previously verified AWS ECS deployment

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
* Docker containerization and previously verified AWS ECS deployment

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

VoltGrid includes OpenTelemetry-based instrumentation across its distributed paths.

Implemented observability capabilities include:

* OCPP message-processing spans
* Station ‒ Authorization gRPC trace propagation
* Station outbox → Kafka → Operations trace propagation
* persisted W3C trace context
* trace/span log correlation
* application metrics
* Station outbox backlog metrics

The default root Docker Compose stack focuses on the executable application path and does not currently start an OpenTelemetry Collector, Jaeger, or Prometheus.

## Local Infrastructure

The default local environment is started from the repository root with:

```bash
docker compose up -d --build
```

It starts:

* Station Service
* Authorization Service
* Operations Service
* three PostgreSQL databases
* Apache Kafka
* Kafka topic initialization

Kafka is configured with separate listeners for host applications and Docker containers.

The application topics are provisioned automatically:

```text
voltgrid.station-status-changed.v1
voltgrid.station-status-changed.v1.dlt
```

Database schemas are created through Flyway on service startup.

Testcontainers is used extensively for real PostgreSQL and Kafka integration testing.

## AWS Deployment History

VoltGrid previously ran as a real AWS dev deployment in:

```text
ap-southeast-1
```

The deployment milestone exercised:

* VPC networking across multiple availability zones
* security-group-based service boundaries
* private encrypted PostgreSQL RDS
* AWS Secrets Manager
* Amazon ECR
* Amazon ECS with Fargate
* AWS Cloud Map service discovery
* Application Load Balancer routing
* CloudWatch Logs
* GitHub Actions OIDC federation
* health-aware ECS deployments

Station Service and Operations Service were exposed through an Application Load Balancer, while Authorization Service remained internal and was reached through gRPC service discovery.

The AWS runtime was successfully deployed, hardened, and verified before being intentionally retired after the cloud-deployment milestone to avoid unnecessary ongoing development cost.

There is currently no live VoltGrid AWS dev environment.

Amazon MSK was evaluated but intentionally not adopted because the AWS account required additional service activation. The full Kafka event path is exercised locally using real Kafka and Testcontainers.

## CI/CD

GitHub Actions currently provides build and test CI for all three backend services.

The former AWS ECR/ECS deployment jobs were intentionally removed after the AWS dev environment was retired.

During the AWS deployment phase, the delivery path included:

```text
Tests
  |
Docker image build
  |
Immutable Git-SHA image
  |
Amazon ECR
  |
ECS task-definition revision
  |
ECS deployment
  |
Service stability verification
```

AWS authentication used GitHub Actions OpenID Connect rather than long-lived AWS access keys.

## Infrastructure as Code

The Terraform implementation used for the verified AWS deployment remains under:

```text
infrastructure/terraform/environments/dev
```

It contains infrastructure definitions for:

* networking and routing
* security groups
* PostgreSQL RDS
* Secrets Manager
* ECR repositories
* GitHub OIDC and deployment IAM
* ECS cluster and services
* task definitions
* Cloud Map service discovery
* Application Load Balancer
* target groups and routing
* CloudWatch log groups

The AWS environment itself has been destroyed.

Running `terraform apply` in this directory would intentionally recreate cloud infrastructure and should only be done when a new AWS environment is wanted.

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

The VoltGrid backend currently includes:

* three independently owned Spring Boot microservices
* OCPP 2.0.1 WebSocket connectivity
* synchronous Station ‒ Authorization gRPC communication
* Kafka-based asynchronous communication
 * transactional outbox publishing
* durable and idempotent event consumption
* PostgreSQL persistence boundaries
 * Flyway schema management
* GraphQL operational read APIs
 * distributed tracing instrumentation
* production-style Docker images
 * health and readiness probes
 * Testcontainers integration testing
 * Terraform-based AWS infrastructure definitions
* GitHub Actions CI
 * a one-command Docker Compose local environment
 * a reproducible end-to-end local demo runbook

The full local architecture has been verified from empty Docker volumes through:

```text
OCPP
  → Station Service
  ‒ Authorization Service via gRPC

and

OCPP
  ‒ Station Service
  → transactional outbox
  → Kafka
  → Operations Service
  → PostgreSQL projection
  ‒ GraphQL
```

The AWS deployment milestone was completed and runtime-verified before the dev environment was intentionally retired.

Current closeout work focuses on documentation, demo evidence, repository higiene, and release preparation.
