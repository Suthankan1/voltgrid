# VG-208 Verification

This directory contains verification evidence for Milestone **VG-208: OCPP 2.0.1 core charging operations and metering** ([Issue #10](https://github.com/Suthankan1/voltgrid/issues/10)).

## Reports

- [02-ocpp-meter-values-and-command-lifecycle.md](02-ocpp-meter-values-and-command-lifecycle.md) — Standalone MeterValues ingestion with EVSE/connector provenance, RFC3339 timezone offset handling, decimal unit normalization, duplicate deduplication, outbound CALL correlation, and command state machine (`REQUESTED`, `PENDING`, `ACCEPTED`, `REJECTED`, `TIMED_OUT`, `UNCERTAIN`, `OBSERVED`).
