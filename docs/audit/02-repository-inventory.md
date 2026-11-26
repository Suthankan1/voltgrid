# 02 — Repository Inventory

> **Audit**: VG-200 · **Commit**: `e6bf891` · **Date**: 2026-11-26

## File counts by area

| Area | Files | Lines (approx) | Review depth |
|---|---|---|---|
| `services/station-service/src/main/` | 55 | ~4,500 | Full source-level |
| `services/authorization-service/src/main/` | 10 | ~600 | Full source-level |
| `services/operations-service/src/main/` | 18 | ~1,200 | Full source-level |
| `services/*/src/test/` | 32 | ~3,500 | Full source-level |
| `apps/operator-web/src/` | 85 | ~7,500 | Full source-level |
| `apps/operator-web/e2e/` | 15 | ~3,200 | Full source-level |
| `infrastructure/` | 5 | ~400 | Full source-level |
| `.github/workflows/` | 5 | ~500 | Full source-level |
| `docs/` | 20 | ~3,000 | Reviewed for drift |
| Docker/Compose configs | 6 | ~300 | Full source-level |
| Terraform (`infrastructure/terraform/`) | 8 | ~600 | Full source-level |
| Flyway migrations | 11 | ~200 | Full source-level |
| Observability configs | 4 | ~200 | Full source-level |
| Build configs (pom.xml, package.json, etc.) | 8 | ~800 | Full |
| **Total tracked** | **489** | **~26,500** | — |

## Review methodology

1. **Automated scanners**: Gitleaks (git + directory), pnpm audit, actionlint, Terraform validate/fmt, Trivy FS (partial), Maven verify (all 3 services).
2. **5 specialist subagent deep audits**: Security/Auth, OCPP Protocol, Distributed Systems/DB, Infrastructure/DevSecOps/SRE, Quality/Test/Feature-Gap.
3. **Manual cross-verification**: All critical/high findings independently verified by reading source code.
4. **Frontend test execution**: 168 unit tests, production build, ESLint, TypeScript type-check all verified passing.
5. **Backend test execution**: 185 Maven tests (136 + 20 + 29) all verified passing.

## Unreviewed areas

- Node modules (`node_modules/`) — covered by pnpm audit
- Maven dependencies (`target/`) — partially covered by Maven dep trees
- Generated protobuf code — reviewed for correctness of `.proto` schema
- `.next/` build artifacts — excluded, covered by build verification
