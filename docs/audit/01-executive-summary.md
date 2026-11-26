# 01 — Executive Summary

> **Audit**: VG-200 · **Commit**: `e6bf891` · **Date**: 2026-11-26

## Overview

VoltGrid is a distributed EV Charging Station Management System (CSMS) implementing OCPP 2.0.1 over WebSocket, with a 3-service Java/Spring Boot backend, Kafka event bus, PostgreSQL persistence, and a Next.js operator dashboard. The recently merged redesign (PR #1) delivered a complete, accessible frontend experience.

This audit identified **37 findings** across security, correctness, reliability, infrastructure, and product completeness.

## Severity Distribution

| Severity | Count | Category breakdown |
|---|---|---|
| **Critical** | 4 | 2 security (SEC-001, SEC-002), 2 bugs (BUG-001, BUG-002) |
| **High** | 6 | 2 security (SEC-003, SEC-004), 4 bugs (BUG-003 through BUG-006) |
| **Moderate** | 19 | 2 security, 5 bugs, 5 infra/DevSecOps, 4 data, 3 protocol |
| **Low / Info** | 8 | Documentation drift, missing features, test gaps |

## Top 5 Risks

### 1. No OCPP WebSocket station authentication (SEC-001 · Critical)

Any client knowing a registered `stationId` can connect to `ws://host/ocpp/{stationId}` and impersonate the station. The handshake interceptor validates existence but requires no credentials (no Basic Auth, no mTLS, no token).

**Impact**: Complete station identity spoofing in any network-accessible deployment.

### 2. Zero backend access control (SEC-002 · Critical)

All GraphQL endpoints (port 8080/8081) and gRPC services (port 9090) are fully unauthenticated. No Spring Security dependency, no `@PreAuthorize`, no JWT/OIDC validation. The frontend's local-write guard is a UX constraint only.

**Impact**: Any network client can register/query/mutate stations, transactions, and authorization tokens.

### 3. Integer overflow infinite loop (BUG-001 · Critical)

`TransactionCompletenessService.findMissingSequenceNumbers()` iterates from 0 to `lastSequenceNumber` with `sequenceNumber++`. If `lastSequenceNumber == Integer.MAX_VALUE`, the loop wraps to `Integer.MIN_VALUE` and runs indefinitely, causing JVM OOM/CPU exhaustion. A single crafted `TransactionEvent` with large `seqNo` triggers this.

**Impact**: Denial of service on any GraphQL query touching transaction completeness.

### 4. Liveness monitor skips outbox events (BUG-002 · Critical)

`StationLivenessService.markStaleStationsOffline()` updates station status to `OFFLINE` but does **not** write outbox events, causing permanent divergence between station-service (correct `OFFLINE`) and operations-service projection (stuck on stale `ONLINE`).

**Impact**: Operator dashboard shows phantom-online stations indefinitely.

### 5. All transport plaintext (SEC-004 · High)

HTTP (not HTTPS) on ALB, `ws://` WebSocket, `ssl.enabled=false` for gRPC, `PLAINTEXT` Kafka security, JDBC without `sslmode`. No encryption in transit anywhere.

**Impact**: Complete credential and data exposure on any shared or public network.

## Recommendations

1. **Immediately** (VG-201): Fix BUG-001 (seqNo bounds check) and BUG-002 (liveness outbox write) — correctness-critical, small patches.
2. **Before shared-network deployment** (VG-202, VG-203): Add OCPP station auth, operator OIDC, Spring Security, TLS everywhere.
3. **Before production** (VG-204, VG-205): Fix distributed-system race conditions, add pagination/query limits, database indexes and retention.
4. **Operational readiness** (VG-206, VG-207): SHA-pin CI actions, add dependency scanning, unify observability, define SLOs.
5. **Product expansion** (VG-208): Remote commands, token admin UI, MeterValues, smart charging profiles.

## Assessment by deployment context

| Environment | Ready? | Blockers |
|---|---|---|
| Local development (single developer) | ✅ Usable | Awareness of BUG-001 trigger |
| Shared local network | ⚠️ Conditional | SEC-001, SEC-002 exposure on LAN |
| Private cloud (VPN) | ❌ Not ready | SEC-001–004, BUG-001–002 |
| Public internet | ❌ Not ready | All critical/high findings |
| Commercial production | ❌ Not ready | All findings + VG-208 features + human testing |
