# VG-207 Verification Report: Observability, SRE and Recovery Readiness

- **Issue**: [Issue #9: [VG-207][P0] Observability, SRE and recovery readiness](https://github.com/Suthankan1/voltgrid/issues/9)
- **Branch**: `feat/vg-207-observability-and-sre`
- **Scope**: Audit findings OBS-001, OBS-002, OBS-003.

---

## 1. Summary of Changes

1. **Actuator & Prometheus Exposure**:
   - `services/authorization-service`: Added `spring-boot-starter-webmvc` and exposed `/actuator/prometheus` on HTTP port `8082` alongside gRPC port `9090`. Updated Dockerfile to `EXPOSE 9090 8082`.
   - `services/operations-service`: Added `micrometer-registry-prometheus` dependency and exposed `/actuator/prometheus` on HTTP port `8081`.
   - `services/station-service`: Configured low-cardinality Prometheus meters and exposed `/actuator/prometheus` on HTTP port `8080`.
   - `observability/local/prometheus.yml`: Added scrape configuration for `voltgrid-authorization` (`host.docker.internal:8082`).

2. **Low-Cardinality Domain Metrics**:
   - **Authorization**:
     - `voltgrid.authorization.decisions` counter tagged by bounded `status` enum (`ALLOWED`, `UNKNOWN_TOKEN`, `BLOCKED`, `EXPIRED`, `UNSUPPORTED_TYPE`).
     - `voltgrid.authorization.duration` timer recording decision latency.
   - **Operations**:
     - `voltgrid.operations.projection.applied` counter tagged by `status` (`inserted`, `updated`, `duplicate`, `out_of_order`).
     - `voltgrid.operations.projection.lag_seconds` gauge recording projection freshness.
   - **Station**:
     - `voltgrid.ocpp.active_connections` gauge recording active WebSocket client sessions.
     - `voltgrid.ocpp.messages.received` counter tagged by `status` (`success`, `invalid_frame`).
     - `voltgrid.ocpp.handshake_failures` counter tagged by `reason` (`unauthorized`, `rate_limited`, `bad_subprotocol`).
     - `voltgrid.transaction.duration` timer recording charging session duration.

3. **Trace Context Propagation & Logback Correlation**:
   - Standardized `logging.pattern.correlation=[trace_id=%X{trace_id:-} span_id=%X{span_id:-}]` across all services.
   - Strict avoidance of PII, RFID tokens, or credentials in log MDC and metric dimensions.

4. **Alerting Rules & SLI/SLO Coverage**:
   - Updated `observability/local/alerts.yml` with actionable rules:
     - `ServiceDown` (`up == 0` for 1m)
     - `StationRelayLagHigh` (`voltgrid_outbox_unpublished > 50` for 3m)
     - `StationQuarantinedEventsDetected` (`voltgrid_outbox_quarantined > 0` for 1m)
     - `OcppHandshakeFailureRateHigh` (`rate(voltgrid_ocpp_handshake_failures_total[5m]) > 0.1` for 5m)
     - `OperationsProjectionLagHigh` (`voltgrid_operations_projection_lag_seconds > 10` for 3m)

5. **Loopback Port Isolation (OBS-003)**:
   - Verified that all local observability stack ports (Prometheus 9090, Alertmanager 9093, Grafana 3001) are strictly bound to `127.0.0.1`.

---

## 2. Automated Verification Evidence

### Authorization Service Metrics Integration Test
- **Test**: `AuthorizationMetricsIntegrationTests.java`
- **Output**:
  ```
  Tests run: 48, Failures: 0, Errors: 0, Skipped: 0
  BUILD SUCCESS
  ```
- **Verified**: Counter `voltgrid.authorization.decisions` increments on authorization calls and appears in `/actuator/prometheus` with `status="UNKNOWN_TOKEN"`.

### Operations Service Metrics Integration Test
- **Test**: `OperationsMetricsIntegrationTests.java`
- **Output**:
  ```
  Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
  BUILD SUCCESS
  ```
- **Verified**: Counter `voltgrid.operations.projection.applied` increments with `status="inserted"` and gauge `voltgrid.operations.projection.lag_seconds` is published in `/actuator/prometheus`.

### Station Service Metrics Integration Test
- **Test**: `StationMetricsIntegrationTests.java`
- **Output**:
  ```
  Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
  BUILD SUCCESS
  ```
- **Verified**: Active connections gauge, handshake failure counters, and transaction duration timer are exported correctly via `/actuator/prometheus`.

### Local Observability Port Isolation Script
- **Script**: `tests/infrastructure/verify-local-observability-ports.py`
- **Output**:
  ```
  All four local observability endpoints publish on IPv4 loopback.
  ```
