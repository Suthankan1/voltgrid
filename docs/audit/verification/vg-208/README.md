# VG-208 Verification

This directory contains verification evidence for Milestone **VG-208: OCPP 2.0.1 core charging operations and metering** ([Issue #10](https://github.com/Suthankan1/voltgrid/issues/10)).

## Reports

- [02-ocpp-meter-values-and-command-lifecycle.md](02-ocpp-meter-values-and-command-lifecycle.md) — Standalone MeterValues ingestion with EVSE/connector provenance, RFC3339 timezone offset handling, decimal unit normalization, duplicate deduplication, outbound CALL correlation, and command state machine (`REQUESTED`, `PENDING`, `ACCEPTED`, `REJECTED`, `TIMED_OUT`, `UNCERTAIN`, `OBSERVED`).
- [03-remediation-command-and-meter-lifecycle.md](03-remediation-command-and-meter-lifecycle.md) — Comprehensive remediation of confirmed command correlation, uncommitted dispatch, idToken redaction, terminal protection, multiplier bounds, distinct location deduplication, and bounded tenant pagination defects.

- [04-transaction-event-correlation.md](04-transaction-event-correlation.md) — Command observation, equipment and transaction checks, and OCPP Edition 4 event variants.
