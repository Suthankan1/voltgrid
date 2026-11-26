# 12 — Observability and SRE Review

> **Audit**: VG-200 · **Commit**: `e6bf891` · **Date**: 2026-11-26

## Overview

Operational observability was audited across metrics, distributed tracing, structured logging, health checks, and alerting readiness for all three microservices and the operator web frontend.

---

## 1. OpenTelemetry Distributed Tracing (OBS-001)

### station-service
- Uses `@WithSpan` annotations on key methods:
  - `OcppMessageProcessor.process(...)`
  - `StationTransactionService.handleTransactionEvent(...)`
- Injects correlation IDs into log output:
  ```properties
  logging.pattern.correlation=[trace_id=%X{trace_id:-} span_id=%X{span_id:-}]
  ```
- **Major Gap**: The OpenTelemetry Java Agent (`observability/agent/opentelemetry-javaagent.jar`) is ignored in Git (`.gitignore`) and is **not packaged or referenced in the production Dockerfiles**.
- As a result, in Dockerized or ECS deployments, auto-instrumentation for HTTP, JDBC, and gRPC is completely absent, and trace contexts are not propagated across service boundaries unless manually passed.

### authorization-service & operations-service
- `authorization-service` has **zero** OpenTelemetry dependencies or annotations. Distributed traces terminating at the gRPC boundary are lost.
- `operations-service` has no OpenTelemetry collector exporter configured.

---

## 2. Metrics & Prometheus Instrumentation (OBS-002)

### Actuator Endpoint Configuration
| Service | Actuator Exposure | Prometheus Metrics | Health Endpoints |
|---|---|---|---|
| `station-service` | `health,prometheus` | Port 8080 `/actuator/prometheus` | `/actuator/health/readiness` (db) |
| `authorization-service` | Defaults only (`health`) | **Disabled** (no Micrometer Prometheus starter) | Basic `/actuator/health` |
| `operations-service` | `health,prometheus` | Port 8081 `/actuator/prometheus` | `/actuator/health/readiness` (db) |

### Missing Core Business & Operational Metrics
The following critical domain metrics are completely unmetered:
1. `ocpp.messages.received_total` (counter by action and status)
2. `ocpp.active_connections` (gauge of live WebSocket sessions)
3. `ocpp.handshake_failures_total` (counter by reason)
4. `outbox.events.lag` (gauge of pending outbox events)
5. `outbox.relay.duration_seconds` (histogram of Kafka publish latency)
6. `authorization.decisions_total` (counter by outcome: `Accepted`, `Invalid`, `Blocked`, `Expired`)
7. `transaction.duration_seconds` (histogram from start to end)

---

## 3. Health Checks & Container Lifecycle

### Liveness and Readiness
- `station-service` and `operations-service` configure:
  ```properties
  management.endpoint.health.show-details=never
  management.endpoint.health.group.readiness.include=readinessState,db
  ```
- Good separation of readiness (dependent on DB availability) vs liveness.
- `authorization-service` lacks a dedicated readiness probe configuration.
- Docker Compose health checks are present for PostgreSQL and Kafka, but absent for the application containers in `compose.yaml`.

---

## 4. SRE & Alerting Posture (OBS-003)

### Alert Definitions
- In `observability/local/prometheus.yml`, Prometheus scrapes `otel-collector` and services, but **zero alerting rules** (`alerting:` block or alertmanager configs) are defined.

### Proposed Service Level Indicators (SLIs) and Objectives (SLOs)

| Service | Indicator (SLI) | Target (SLO) | Alert Condition |
|---|---|---|---|
| **station-service** | OCPP WebSocket Handshake Success Rate | 99.9% over 30d | Handshake error rate > 0.5% for 5m |
| **station-service** | Outbox Relay Lag | < 5 seconds | Pending outbox events > 100 for 3m |
| **authorization-service**| gRPC Authorization Response Latency (p99) | < 50ms | p99 latency > 200ms for 2m |
| **authorization-service**| Authorization Availability | 99.99% over 30d | 5xx error rate > 0.01% for 1m |
| **operations-service** | Projection Consumer Delay | < 2 seconds | Kafka consumer lag > 50 for 5m |
| **operator-web** | GraphQL Query Latency (p95) | < 300ms | p95 latency > 1000ms for 5m |
