# VG-202: 07 - Test Execution Results

> Historical VG-202 evidence. Current remediation and readiness are tracked in [VG-202R remediation status](remediation-status.md).

## 1. Complete Test Execution Inventory

All tests were executed directly in the local development environment against isolated Docker Testcontainers (PostgreSQL 18.6, Apache Kafka 4.2.1) and real browser contexts.

### A. Backend Services

```text
========================================================================
Service                   Tests Run   Failures   Errors   Skipped   Time
========================================================================
station-service                 190          0        0         0    30s
operations-service               33          0        0         0    70s
authorization-service            30          0        0         0     6s
------------------------------------------------------------------------
Total Backend Tests             253          0        0         0   106s
========================================================================
```

### B. Frontend Operator Web (`apps/operator-web`)

```text
========================================================================
Test Suite                Tests Run   Pass   Fail   Skipped   Duration
========================================================================
Node Unit Tests (34 files)      175    175      0         0       1.6s
Automated WCAG AA Audit           1      1      0         0      14.3s
Playwright E2E Tests             36     36      0         0     108.0s
TypeScript Typecheck (tsc)        —      ✓      0         —       1.0s
ESLint                            —      ✓      0         —       0.5s
Next.js Production Build          —      ✓      0         —       3.6s
------------------------------------------------------------------------
Total Frontend Verifications    212    212      0         0     129.0s
========================================================================
```

### C. Cross-Service Black-Box Integration Tests

```text
========================================================================
Test Class                               Tests Run   Failures   Duration
========================================================================
AuthorizationFlowHarnessTests                    1          0       3.1s
AuthorizationFlowE2ETests                        1          0      13.6s
AuthorizationServiceProcessTests                 1          0       4.9s
StationServiceProcessTests                       1          0      10.3s
------------------------------------------------------------------------
Total Cross-Service Integration Tests            4          0      31.9s
========================================================================
```

**Combined Total: 469 automated tests passing with 0 failures.**
