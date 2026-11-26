# VoltGrid — VG-201 Core Hardening Verification Deliverables

> **Milestone**: VG-201 (Core Hardening Verification, Regression Testing and Audit Reconciliation)  
> **Baseline Planning Commit**: `71307b68477505de9f536ed579b6344d2158b80b`  
> **Historical Hardening Commits**: `e1db18a1d50717f297b17b98b222323447b83b5e`, `18d4ddc` (merged in `d353778`, `1fbd6cd`)  
> **Verification Branch**: `verification/vg-201-core-hardening`  
> **Primary Tracking Issue**: [#3](https://github.com/Suthankan1/voltgrid/issues/3)  
> **Master Development Tracking Issue**: [#64](https://github.com/Suthankan1/voltgrid/issues/64)  
> **Verification Date**: 2026-11-26  

---

## 1. Directory Structure

```text
docs/audit/verification/vg-201/
├── README.md                                 # This document: deliverable index and overview
├── 01-verification-summary.md               # Executive summary, scope, and key conclusions
├── 02-finding-disposition.md                # Detailed reconciliation matrix of historical audit findings
├── 03-backend-test-results.md               # Service-by-service Maven test execution records
├── 04-frontend-test-results.md              # Operator Web unit, lint, tsc, build, Playwright, and a11y records
├── 05-integration-test-results.md           # Isolated Docker Compose end-to-end lifecycle verification
├── 06-database-and-concurrency-results.md   # Flyway migrations, column widths, composite indexes, and concurrency
├── 07-security-verification.md              # Port exposure, dependency audit, input validation, and secrets review
├── 08-remaining-risks-and-follow-ups.md     # Defect register, distributed/scaling risks, and milestone traceability
└── 09-vg-202-readiness.md                   # Formal readiness assessment for Milestone VG-202
```

---

## 2. Executive Status

| Assessment Area | Status | Evidence |
|---|---|---|
| **BUG-001 (Sequence Exhaustion)** | **Partially Resolved** | Integer overflow / infinite loop eliminated; sequence bounds capped at 1,000,000; range > 100k defaults to COMPLETE (semantic limitation tracked in VG-205, issue #7). |
| **BUG-002 (Liveness Outbox)** | **Partially Resolved** | Transactional outbox event created on stale offline transition; verified single-node consistency. Multi-instance fencing tracked in VG-204, issue #6. |
| **BUG-003 (Reconnect Race)** | **Partially Resolved** | Active session registry in `OcppWebSocketHandler` prevents premature offline transition during reconnects. Distributed fencing tracked in VG-204, issue #6. |
| **BUG-007 (Port 9090 Conflict)** | **Verified Resolved** | Prometheus external port mapped to `9091:9090`, resolving host collision with authorization-service gRPC (`9090:9090`). |
| **BUG-008 (Connector Monotonicity)** | **Verified Resolved** | Stale status events with older timestamps rejected. Concurrency read-modify-write without `@Version` tracked in DATA-004 (VG-205). |
| **BUG-009 (Heartbeat Recovery)** | **Verified Resolved** | `recordActivity` transitions OFFLINE stations to ONLINE and emits transactional outbox event. Unit & integration verified. |
| **BUG-010 (Equal Timestamps)** | **Partially Resolved** | Events in same millisecond no longer dropped (`isBefore` guard). Equal-timestamp causal ordering non-determinism tracked in VG-204, issue #6. |
| **BUG-011 (Registration Tx)** | **Verified Resolved** | `@Transactional` boundary added to `StationRegistrationService.register`. Duplicate ID conflict and 255-char width verified. |
| **SEC-006 (Loopback Binding)** | **Partially Resolved** | `compose.yaml` and PostgreSQL Compose explicitly bound to `127.0.0.1`. `observability/local/compose.yaml` retains wildcard `0.0.0.0` bindings (tracked in VG-203, issue #5). |
| **DATA-001 (ID Column Width)** | **Partially Resolved** | `outbox_events.aggregate_id` widened to `VARCHAR(255)` via Flyway V12. Operations service projection table retains `VARCHAR(128)` (tracked in VG-205, issue #7). |
| **DATA-003 (Meter Composite Index)**| **Verified Resolved** | Flyway V13 composite index `(station_id, transaction_id, sequence_number ASC)` created and matches query pattern. |
| **Backend Test Suite** | **PASS** | 220 tests executed across all services (16 new regression tests added), 0 failed, 0 skipped. |
| **Frontend Test Suite** | **PASS** | 168 unit tests, lint, tsc, production build, 36 Playwright Chromium E2E, 1 WCAG 2.2 AA audit all passed. |
| **Live Integration Lifecycle** | **PASS** | Complete 20-step lifecycle verified on isolated Docker Compose project `voltgrid-vg201-verification`. |
| **VG-202 Readiness Decision** | **READY WITH LIMITATIONS** | No release-blocking critical bugs remaining in core station lifecycle. Non-blocking limitations documented for VG-202, VG-203, VG-204, and VG-205. |
