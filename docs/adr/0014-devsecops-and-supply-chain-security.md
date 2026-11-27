# 0014. DevSecOps, Supply-Chain Hardening, and Immutable Build Governance

## Status

Approved

## Context

VoltGrid is commercial critical EV charging infrastructure handling real-time charger telemetry, billing integrity, driver credentials, and operator access. As documented in the VG-200 security and architecture audit (findings INF-003, INF-004, and INF-005):

1. **Mutable Action Version Tags (INF-003)**: Prior CI workflows referenced GitHub Actions using mutable major version tags (e.g. `@v7`, `@v6`). If an upstream repository tag was compromised or moved, malicious code could execute with runner privileges.
2. **Absence of Security Scanners (INF-004)**: Prior CI lacked integrated Static Application Security Testing (SAST), Software Composition Analysis (SCA), and standardized Software Bill of Materials (SBOM) generation. Known Common Vulnerabilities and Exposures (CVEs) in open-source dependencies or source code patterns could slip into releases undetected.
3. **Permissions and Concurrency Gaps (INF-005)**: Workflows without explicit top-level permissions defaulted to repository-wide write permissions in standard environments, and missing concurrency constraints allowed redundant builds and potential race conditions on rapid pushes.
4. **Fork PR Trust Boundaries**: Workflows handling external pull requests must preserve strict trust isolation, preventing untrusted code execution from accessing deployment credentials, infrastructure secrets, or privileged APIs.

## Decision

We establish an immutable DevSecOps and software supply-chain governance framework enforced automatically across all CI pipelines:

### 1. Mandatory SHA Pinning for GitHub Actions
All GitHub Actions referenced in `.github/workflows/*.yml` must be pinned to full 40-character immutable commit SHAs with an inline version comment. Mutable tags (e.g. `@v4`, `@master`, `@latest`) are strictly prohibited in the repository.

Standard approved action pins:
- `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2`
- `actions/setup-java@3a4f6e1af504cf6a31855fa899c6aa5355ba6c12 # v4.7.0`
- `actions/setup-node@1d0ff469b7ec7b3cb9d8673fde0c81c44821de2a # v4.2.0`
- `actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.1`
- `github/codeql-action/*@74c1aea9df7c0f02e9b7bfe4a8935abf2e5e3aa6 # v3`
- `gitleaks/gitleaks-action@ff98106e4c7b2bc287b24eaf42907196329070c7 # v2.3.8`

### 2. Least-Privilege Workflow Permissions
Every workflow file must explicitly define top-level permissions:
- Read-only by default: `permissions: contents: read`.
- Explicit elevation only where required: `security-events: write` for SARIF report uploads (CodeQL, security scanning).
- Workflows triggered by `pull_request` must never use `pull_request_target` with untrusted checkout, preventing malicious PR code from accessing repository secrets.

### 3. Concurrency Groups and Cancellation
Every workflow must specify a concurrency group scoped to the workflow and git ref (`group: <workflow>-${{ github.ref }}`) with `cancel-in-progress: true`. This cancels redundant runner executions on rapid branch updates while guaranteeing final branch commits run to completion.

### 4. Multi-Layer Automated Security Scanners

1. **Secret Scanning (Gitleaks & GitGuardian)**:
   - Automated secret scanning on every push and pull request via Gitleaks and GitGuardian.
   - Global `.gitleaks.toml` configuration with allowlists for build artifacts (`target/`, `.next/`, `node_modules/`, `dist/`), preventing false positives on generated test data.
2. **Software Composition Analysis (SCA)**:
   - **Frontend**: Automated `pnpm audit --prod` gate in CI enforcing zero known vulnerabilities in production dependencies.
   - **Backend**: Automated Maven dependency vulnerability inspection and CycloneDX aggregate bill-of-materials generation across Station, Operations, and Authorization services.
3. **Static Application Security Testing (SAST - CodeQL)**:
   - Automated CodeQL analysis workflow (`codeql.yml`) covering `java-kotlin` and `javascript-typescript` codebases.
   - Executes on all pull requests to `main`, pushes to `main`, and scheduled weekly security baselines.
4. **Software Bill of Materials (SBOM)**:
   - CycloneDX 1.6 specification aggregate BOMs (`bom.json` and `bom.xml`) generated for each backend service (`station-service`, `operations-service`, `authorization-service`).
   - BOMs archived as traceable, immutable build artifacts with 14-day retention.

## Consequences

- Prevents supply-chain hijacking via mutable GitHub Action tags.
- Eliminates secret leaks and high-severity dependency vulnerabilities before code reaches `main`.
- Provides audit-ready SBOMs for commercial compliance and vulnerability disclosure programs.
- Lowers CI runner resource waste via deterministic concurrency management.
