# 06 — Dependency & Supply Chain

> **Audit**: VG-200 · **Commit**: `e6bf891` · **Date**: 2026-11-26

## Frontend (operator-web)

### pnpm audit results

| Scope | Vulnerabilities | Details |
|---|---|---|
| Production (`--prod`) | 0 | Clean |
| Full (incl. dev) | 1 moderate | `minimatch@10.2.6` via ESLint (dev-only, no production exposure) |

### Key dependencies

| Package | Version | Notes |
|---|---|---|
| next | 16.4.6 | Latest stable; upgraded from 16.3.5 during redesign |
| react / react-dom | 19.2.8 | Latest stable |
| typescript | 5.x | Current |
| tailwindcss | 4.x | Current |
| playwright | 1.52.x | Current |
| @axe-core/playwright | 4.x | Current |

## Backend (Java/Maven)

### Maven dependency status

All 3 services use Spring Boot 4.1.1 (latest) with Java 25.

| Service | Direct deps | Test deps | Transitive (total) |
|---|---|---|---|
| station-service | 14 | 5 | ~211 |
| authorization-service | 8 | 4 | ~156 |
| operations-service | 10 | 4 | ~228 |

### Key dependencies

| Dependency | Version | Notes |
|---|---|---|
| spring-boot-starter-parent | 4.1.1 | Latest |
| postgresql | (managed) | Runtime scope |
| flyway-database-postgresql | (managed) | Schema migration |
| grpc-spring-boot-starter | (managed via Boot) | gRPC client/server |
| spring-kafka | (managed) | Kafka producer/consumer |
| testcontainers | (managed) | Integration tests |
| opentelemetry-instrumentation-annotations | (managed) | Manual span annotations |

### Vulnerability scanning status

| Scanner | Status | Findings |
|---|---|---|
| pnpm audit (prod) | ✅ Complete | 0 |
| pnpm audit (full) | ✅ Complete | 1 moderate (dev-only) |
| Gitleaks (git history) | ✅ Complete | 0 |
| Gitleaks (directory) | ✅ Complete | 16 false positives (build artifacts) |
| Trivy FS (Java) | ❌ Failed (HTTP 429) | Incomplete |
| OWASP Dependency-Check | ⬜ Not run | Not installed |
| Container image scan | ⬜ Not run | No images built |

### Supply chain recommendations

1. **Add Trivy or OWASP Dependency-Check to CI** (VG-206) — currently zero SCA in pipeline.
2. **Pin GitHub Actions to commit SHAs** — currently using mutable `@v7`/`@v6` tags (see INF-003).
3. **Generate SBOM** for each service — required for production compliance.
4. **Retry Trivy Java scan** when Maven Central rate limits reset, or use offline NVD database.
