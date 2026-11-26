# 15 — Test Coverage and Evidence

> **Audit**: VG-200 · **Commit**: `e6bf891` · **Date**: 2026-11-26

## Overview

A comprehensive regression and test suite execution was performed across all modules on audited commit `e6bf89173746ebfdb59d74fe5acb71d9f32b21f8` (branch `audit/vg-200-full-project-review`).

---

## 1. Test Suite Execution Results

### Backend Test Execution (Maven Verify)
| Service | Test Count | Failures | Errors | Skipped | Duration | Outcome |
|---|---|---|---|---|---|---|
| `station-service` | 136 | 0 | 0 | 0 | 40.3s | **PASSED** (BUILD SUCCESS) |
| `authorization-service` | 20 | 0 | 0 | 0 | 8.6s | **PASSED** (BUILD SUCCESS) |
| `operations-service` | 29 | 0 | 0 | 0 | 47.4s | **PASSED** (BUILD SUCCESS) |
| **Backend Total** | **185** | **0** | **0** | **0** | **96.3s** | **100% Passing** |

### Frontend Test Execution (`apps/operator-web`)
| Suite | Command | Tests | Passing | Outcome |
|---|---|---|---|---|
| Component & Unit | `pnpm test` | 168 | 168 | **PASSED** (1452ms) |
| ESLint | `pnpm lint` | 85 files | Clean | **PASSED** (0 warnings) |
| TypeScript | `pnpm exec tsc --noEmit`| Full project | Clean | **PASSED** (0 errors) |
| Production Build | `pnpm build` | All routes | Clean | **PASSED** (Next.js 16.4.6) |
| WCAG 2.2 AA A11y | `pnpm test:a11y` | 8 routes | 8 | **PASSED** (axe-core) |
| E2E Fixtures | `pnpm test:e2e` | 36 scenarios | 36 | **PASSED** (Playwright) |

---

## 2. Automated Scanner Verification Evidence

| Scanner / Tool | Target | Result | Evidence File / Output |
|---|---|---|---|
| **actionlint** | 5 GitHub Actions workflows | **0 errors** | Clean exit |
| **Terraform fmt** | `infrastructure/terraform/` | **0 errors** | `terraform fmt -check` clean |
| **Terraform validate** | `infrastructure/terraform/` | **Success** | Configuration valid |
| **Gitleaks (history)**| Tracked Git commits | **0 leaks** | `gitleaks.json` clean |
| **Gitleaks (dir)** | Untracked filesystem | 16 findings | All false positives in `.next/cache` and protobuf hashes |
| **pnpm audit (--prod)**| `apps/operator-web` | **0 vulnerabilities** | Production clean |
| **pnpm audit (full)** | `apps/operator-web` | 1 moderate | Dev-only `minimatch@10.2.6` in ESLint |
| **Trivy FS (Java)** | Maven dependencies | **Blocked (HTTP 429)**| Maven Central rate limit |

---

## 3. Test Suite Gap Analysis

While unit and happy-path integration coverage is solid, critical verification gaps exist in distributed resilience and protocol stress testing:

### 1. Concurrency & Race Condition Tests (TEST-001)
- No tests verify `OcppWebSocketHandler` when an existing connection is superseded by a new connection with identical station ID (BUG-003).
- No tests execute concurrent outbox relay instances against PostgreSQL to verify aggregate event ordering (BUG-006).

### 2. Protocol Fuzzing & Malformed Frame Ingestion (TEST-002)
- Zero tests send truncated, oversized (>1MB), or structurally corrupted JSON to the WebSocket endpoint.
- No tests send extreme integer values (`Integer.MAX_VALUE`, negative numbers) in `seqNo` to verify bounds protection.

### 3. Chaos & Fault-Tolerance Tests (TEST-003)
- No tests simulate Kafka broker unavailability during outbox relay execution to observe poison-pill behavior (BUG-004).
- No tests simulate database connection pool starvation during concurrent GraphQL load.

### 4. Security & Access Control Tests (TEST-004)
- Because authentication is completely absent (SEC-001, SEC-002), no automated tests currently verify authorization rejection, token expiration enforcement on API calls, or role-based access denial.
