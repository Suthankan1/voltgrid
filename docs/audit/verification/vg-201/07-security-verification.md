# 07 — Security Verification

> **Milestone**: VG-201
> **Scope**: Core Hardening Security Verification, Port Bindings, Secrets Exposure, and Dependency Audit
> **Execution Date**: 2026-11-26

---

## 1. Security Scope and Boundaries

This verification reviews the security posture of the core hardening implementation to confirm that no security regressions were introduced and that existing findings are accurately reconciled.

> [!IMPORTANT]
> Milestone VG-201 is **not** the identity and access management implementation (which belongs to VG-202) or transport encryption implementation (which belongs to VG-203). This review establishes the verified baseline for those milestones.

---

## 2. Local Port Exposure Verification (SEC-006)

### Analysis of Docker Compose Host Port Publishing
In local development, publishing container ports to wildcard `0.0.0.0` exposes services to any device on the host's physical network (e.g., local Wi-Fi, VPNs, coworking spaces).

| Service | File | Configured Port | Published Host Interface | Status |
|---|---|---|---|---|
| `station-service` | `compose.yaml` | `127.0.0.1:8080:8080` | Loopback only | **Verified safe** |
| `operations-service` | `compose.yaml` | `127.0.0.1:8081:8081` | Loopback only | **Verified safe** |
| `authorization-service` | `compose.yaml` | `127.0.0.1:9090:9090` | Loopback only | **Verified safe** |
| `postgres` (station) | `infrastructure/local/postgres/compose.yaml` | `127.0.0.1:5434:5432` | Loopback only | **Verified safe** |
| `authorization-postgres` | `infrastructure/local/postgres/compose.yaml` | `127.0.0.1:5435:5432` | Loopback only | **Verified safe** |
| `operations-postgres` | `infrastructure/local/postgres/compose.yaml` | `127.0.0.1:5436:5432` | Loopback only | **Verified safe** |
| `kafka` | `infrastructure/local/postgres/compose.yaml` | `127.0.0.1:9092:9092`, `127.0.0.1:29092:29092` | Loopback only | **Verified safe** |
| `jaeger` | `observability/local/compose.yaml` | `16686:16686` | Wildcard (`0.0.0.0`) | **Unresolved** |
| `otel-collector` | `observability/local/compose.yaml` | `4317:4317`, `4318:4318` | Wildcard (`0.0.0.0`) | **Unresolved** |
| `prometheus` | `observability/local/compose.yaml` | `9091:9090` | Wildcard (`0.0.0.0`) | **Unresolved** |

### SEC-006 Disposition
- **Main Compose & PostgreSQL Compose**: Bound explicitly to `127.0.0.1`.
- **Observability Compose**: Retains wildcard bindings.
- **Traceability**: Observability port prefixing is reconciled under **VG-203 (Issue #5)**.

---

## 3. Input Validation and Resource Exhaustion

### Protocol Ingress Validation
- `OcppMessageProcessor` validates `seqNo` bounds:
  - Negative values (`seqNo < 0`) rejected with OCPP `FormatViolation`.
  - Excessive values (`seqNo > 1,000,000`) rejected with OCPP `FormatViolation`.
  - Non-numeric or null values rejected.
- String fields in `RegisterStationInput`:
  - Enforces `@NotBlank` and `@Size(max = 255)`.
- Timestamp Parsing:
  - RFC 3339 timestamps with non-zero timezone offsets (e.g. `+02:00`, `+05:30`) are supported without exception.

### Denial-of-Service Mitigations
- In `TransactionCompletenessService`:
  - Sequence ranges `(lastSequenceNumber - firstSequenceNumber) > 100_000` abort missing enumeration to prevent JVM OutOfMemoryError.
  - `generate_series` in PostgreSQL view capped at 10,000 rows.

---

## 4. Secrets and Sensitive Logging Review

- **Git Secret Scan**: Checked all source files for hardcoded secrets, API tokens, and private keys.
- **Frontend Error Sanitization**:
  - `apps/operator-web` tests verify that database exception messages and connection strings are sanitized and never displayed to operators in the UI (`Alert` and `ErrorState` components display generic user-facing explanations).
- **Hardcoded Development Secret (SEC-003)**:
  - `TokenFingerprintService.java` still falls back to default `voltgrid-local-development-hmac-key-change-me` when `AUTHORIZATION_TOKEN_HMAC_KEY` is not provided.
  - This remains open and tracked as an essential gate for **VG-202 (Issue #4)**.

---

## 5. Dependency Vulnerability Audit

### Node.js Frontend (`apps/operator-web`)
- **Scanner**: `pnpm audit`
- **Result**: 1 advisory detected in development dependencies:
  - Package: `minimatch` (via `eslint-config-next > @typescript-eslint/parser`)
  - Severity: Moderate
  - Advisory: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) (ReDoS via globparts amplification)
  - Impact: Development/linting toolchain only; not included in production client bundle.
- **Action**: Preserved without indiscriminate dependency churn; upgrade to be handled in VG-206.

### Automated CI Scanners
- GitHub Actions workflow `.github/workflows/security-scan.yml` runs Gitleaks secret scanning across pull requests.
- Full SAST (CodeQL) and dependency scanning (Trivy / OWASP Dependency-Check) are scheduled for **VG-206 (Issue #8)**.
