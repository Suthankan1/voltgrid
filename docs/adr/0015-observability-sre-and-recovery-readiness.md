# 0015. Observability, SRE Baseline, Metrics Cardinality, and Alerting Topology

## Status

Approved

## Context

VoltGrid operates commercial EV charging networks with real-time OCPP WebSocket connections, Kafka distributed events, multi-tenant GraphQL APIs, and transactional billing ledgers. Under the VG-200 platform audit, three critical observability and resilience vulnerabilities were identified:

1. **OBS-001 (Trace Propagation and PII Redaction)**: Incomplete trace correlation across OCPP, HTTP, gRPC, and transactional outbox events, risking log fragmentation during incident triage. Additionally, high sensitivity requires that credentials, bearer tokens, RFID tags, and meter payloads never leak into trace spans or logs.
2. **OBS-002 (Metrics Cardinality and SLI/SLO Baseline)**: Absence of standardized Prometheus meters for key charging workflows, or risk of high-cardinality label explosion (e.g., tagging metrics with dynamic tokens, transaction IDs, or station identifiers).
3. **OBS-003 (Observability Network Exposure and SRE Readiness)**: Local observability telemetry exporters and UI consoles (Prometheus, Alertmanager, Grafana) previously exposed across all network interfaces (`0.0.0.0`) without loopback isolation or structured alerting rules for critical failure modes.

## Decision

We establish an end-to-end Observability and SRE architecture across all VoltGrid components:

### 1. Low-Cardinality Metric Conventions
All Prometheus metrics across Station, Operations, and Authorization services must adhere strictly to bounded label sets:
- **Authorization Service**:
  - `voltgrid.authorization.decisions`: Counter tagged by `status` (`ALLOWED`, `UNKNOWN_TOKEN`, `BLOCKED`, `EXPIRED`, `UNSUPPORTED_TYPE`). Never tagged with raw token values or hashed secrets.
  - `voltgrid.authorization.duration`: Timer recording token evaluation latency.
- **Operations Service**:
  - `voltgrid.operations.projection.applied`: Counter tagged by `status` (`inserted`, `updated`, `duplicate`, `out_of_order`).
  - `voltgrid.operations.projection.lag_seconds`: Gauge reporting elapsed time between event generation and read-model materialization.
- **Station Service**:
  - `voltgrid.ocpp.active_connections`: Gauge tracking currently connected WebSocket station sessions.
  - `voltgrid.ocpp.messages.received`: Counter tagged by `status` (`success`, `invalid_frame`).
  - `voltgrid.ocpp.handshake_failures`: Counter tagged by `reason` (`unauthorized`, `rate_limited`, `bad_subprotocol`).
  - `voltgrid.transaction.duration`: Timer tracking completed charging sessions.
  - `voltgrid.outbox.unpublished` and `voltgrid.outbox.quarantined`: Gauges tracking transaction outbox queue depth and poison message dead-letters.

### 2. Standardized Prometheus Scrape Targets
- All services expose Prometheus metrics via Spring Boot Actuator at `/actuator/prometheus`.
- `authorization-service` exposes Actuator over dedicated HTTP port `8082` alongside gRPC port `9090`.
- Scrape targets configured in `observability/local/prometheus.yml` under local loopback / docker internal network.

### 3. Trace Context Propagation and MDC Redaction
- Logback correlation format standardized across all services:
  `logging.pattern.correlation=[trace_id=%X{trace_id:-} span_id=%X{span_id:-}]`
- Strict exclusion of raw authentication headers, OAuth refresh tokens, and driver identifiers from trace tags and log lines.

### 4. Alerting Rules and SLI/SLO Error Budgets
Configured in `observability/local/alerts.yml`:
- `ServiceDown`: Critical alert firing when `up == 0` for > 1 minute.
- `StationRelayLagHigh`: Warning alert firing when outbox relay pending events > 50 for > 3 minutes.
- `StationQuarantinedEventsDetected`: Critical alert firing when quarantined poison events > 0 for > 1 minute.
- `OcppHandshakeFailureRateHigh`: Warning alert firing when handshake failure rate exceeds 0.1/s over 5 minutes.
- `OperationsProjectionLagHigh`: Warning alert firing when status projection lag exceeds 10 seconds for > 3 minutes.

### 5. Loopback Observability Isolation (OBS-003)
- All local observability stack ports (Prometheus 9090, Alertmanager 9093, Grafana 3001) are strictly bound to `127.0.0.1` on the host, validated continuously by `tests/infrastructure/verify-local-observability-ports.py`.

## Consequences

- Prevents metrics memory exhaustion caused by high-cardinality station or token identifiers.
- Enables operational alerting and SLI/SLO tracking across charging operations.
- Eliminates risk of sensitive credential leakage in telemetry feeds.
- Protects development and CI hosts from unauthenticated observability console access.
