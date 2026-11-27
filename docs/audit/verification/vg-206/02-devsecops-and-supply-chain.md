# VG-206 DevSecOps and Supply-Chain Security Gates

On 2026-11-27, the DevSecOps controls, supply-chain protections, and automated security scanners specified in issue [#8](https://github.com/Suthankan1/voltgrid/issues/8) and [ADR 0014](../../adr/0014-devsecops-and-supply-chain-security.md) were implemented and verified.

## Architectural Mechanisms Delivered

| Finding / Scope | Mechanism | Security Guarantee |
| --- | --- | --- |
| **INF-003** (Mutable Action Tags) | Pinned all GitHub Actions across all 7 workflows to 40-character immutable commit SHAs with inline version comments. | Eliminates supply-chain tampering and unexpected behavior from moved or compromised upstream tags. |
| **INF-004** (Security Scanners) | Integrated Gitleaks secret scanning, frontend `pnpm audit --prod`, CycloneDX aggregate SBOM generation, and CodeQL SAST. | Detects credential leaks, known dependency CVEs, and code vulnerability regressions automatically on PRs and pushes. |
| **INF-005** (Permissions & Concurrency) | Enforced top-level least privilege `permissions: contents: read` on all workflows; added `concurrency` cancellation groups across all workflows including `local-observability-ci.yml`. | Prevents unauthorized runner write access and eliminates redundant runner resource usage on rapid pushes. |
| **Supply Chain Compliance** | Automated CycloneDX 1.6 BOM generation (`bom.json`, `bom.xml`) for Station Service, Operations Service, and Authorization Service with artifact archiving. | Provides verifiable software bill-of-materials and dependency traceability for production compliance. |

## Pinned Actions Matrix

| Action | Pinned Commit SHA | Version |
| --- | --- | --- |
| `actions/checkout` | `11bd71901bbe5b1630ceea73d27597364c9af683` | v4.2.2 |
| `actions/setup-java` | `3a4f6e1af504cf6a31855fa899c6aa5355ba6c12` | v4.7.0 |
| `actions/setup-node` | `1d0ff469b7ec7b3cb9d8673fde0c81c44821de2a` | v4.2.0 |
| `actions/upload-artifact` | `ea165f8d65b6e75b540449e92b4886f43607fa02` | v4.6.1 |
| `gitleaks/gitleaks-action` | `ff98106e4c7b2bc287b24eaf42907196329070c7` | v2.3.8 |
| `github/codeql-action` | `74c1aea9df7c0f02e9b7bfe4a8935abf2e5e3aa6` | v3 |

## Local Verification Matrix

1. **Frontend SCA (`pnpm audit --prod`)**:
   - Result: `No known vulnerabilities found` (0 vulnerabilities).
2. **Backend SBOM Generation (CycloneDX 1.6)**:
   - `services/station-service`: 165 components resolved, `bom.json` and `bom.xml` generated.
   - `services/operations-service`: 139 components resolved, `bom.json` and `bom.xml` generated.
   - `services/authorization-service`: 117 components resolved, `bom.json` and `bom.xml` generated.
3. **Workflow Syntax & Concurrency Validation**:
   - All 7 workflows verified: valid YAML, strict least-privilege permissions, concurrency cancellation groups configured.
