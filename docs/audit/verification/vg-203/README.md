# VG-203 Verification Evidence

This directory contains verification evidence for **[VG-203][P0] Transport encryption and network boundary hardening** (issue [#5](https://github.com/Suthankan1/voltgrid/issues/5)).

## Artifacts

1. [01-local-observability-boundary.md](./01-local-observability-boundary.md): SEC-006 loopback binding on host ports for local observability stack (Jaeger, Prometheus, OTel Collector).
2. [02-transport-encryption-and-network-boundaries.md](./02-transport-encryption-and-network-boundaries.md): Detailed verification evidence covering:
   - Threat and trust boundaries (WSS, HTTPS, gRPC TLS, Kafka SSL, PostgreSQL verify-full).
   - Terraform edge hardening (ALB HTTP->HTTPS 301 redirect, `/operations*` routing, JDBC sslmode enforcement).
   - Backend transport security guards in Station, Operations, and Authorization services.
   - Complete positive and negative test results (plaintext rejection, wrong CA, missing service key, rogue forwarded headers).
   - Certificate and secret lifecycle / rotation runbook.

- [03-ocpp-proxy-trust.md](03-ocpp-proxy-trust.md) — Native request and explicit proxy peer checks for OCPP transport.
