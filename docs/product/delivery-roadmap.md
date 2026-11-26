# Integrated delivery roadmap

This plan extends, not replaces, [VG-200 engineering milestones](../audit/16-implementation-roadmap.md). No new dates, costs or capacity assumptions. A group is complete only with evidence; merging documentation is not implementation.

## 0 — Reconcile the audit and core hardening

At planning baseline d353778, main contains the VG-200 audit and core hardening merge e1db18a. The commit message records fixes for BUG-001/002/003/007/008/009/010/011, SEC-006, DATA-001/003 and regression tests. Verify actual behavior, test/CI evidence and remaining findings against the current head; do not close findings solely from commit text. VG-204 and VG-205 are partially addressed by this merge, not automatically complete. Audit Java SCA, image scanning, load tests and human gates had limitations. Re-run or obtain evidence before relevant release.

## A — Commercial identity and security foundation

Prerequisites: verify VG-201. Next engineering milestone **VG-202**: design external OIDC, operator/API authentication, station device authentication and key management; then VG-203 transport and network boundaries. Complete outstanding VG-204 reliability, VG-205 data governance/scaling, VG-206 DevSecOps and VG-207 SRE before production feature activation. Co-design tenancy and resource-level authorization with IAM; do not assume global OPERATOR role is sufficient.

IDs: SEC-01–04, CORE-01, ADM-01/02. Gate: no unresolved exploitable Critical/High findings, verified identity/device trust, tenant isolation, audit, secrets, encrypted transport, bounded queries, backup/recovery, observable failure paths and no frontend-only authorization. Local development may use explicit isolated test fixtures, never a production bypass.

## B — Truthful charging domain and OCPP operations

IDs: CORE-02/03/04, AUTH-01, OPS-01. Coordinate with VG-208. Model organizations, physical sites, stations, EVSEs and connectors separately; migrate existing records without invented coordinates or capabilities. Add command lifecycle with authenticated, capability-gated start/stop first, correlate replies and TransactionEvent; accepted command is not proof of charging. Validate standalone metering and timestamp compatibility. Add RFID lifecycle and freshness semantics. Other remote commands are separate gated increments.

Gate: simulator and supported hardware tests for start/stop, rejection, timeout, reconnect, stale state, duplicate/out-of-order events, command ownership and bounded metering; no fake success. VG-209 core verification remains required before commercial operation.

## C — Market-parity driver and billing pilot

IDs: DRV-01/02/04/05/06/10, PAY-01/02/05/06, OPS-05. Build driver PWA shell/discovery first using verified metadata; design driver identity, tariff quote, session/payment ledger and reconciliation before enabling a real start/payment flow. Integrate licensed provider sandbox and two compliant payment options; activate only after agreements, security and financial review. Implement minimum complaint intake/reference and trilingual safety/complaint flows before any commercial pilot (OPS-02/ADM-03 minimum slice pulled forward from D). A read-only host pilot can be prepared here; full HOST-01 in D.

Gate: end-to-end discovery → quote → start → monitoring → stop → payment → receipt; reproducible tariff, no double billing, safe disconnect/reconnect, fresh status, compliant receipts, native-language review, accessible journeys and verified support process. No actual charging or payments without compatible hardware and partner/regulatory approvals.

## D — Competitive expansion

IDs: DRV-03/08, PAY-03/04/07, OPS-02/03, HOST-01/02, FLT-01/02/03, INT-01/02/03, ADM-03/04/05. Sequence: support/host controls and reporting; fleet and allowances; partner APIs; OCPI exchange and reconciliation; then optional wallet, reservations, promotions and reimbursement after demand/legal validation. LANKAQR can move into C if selected as one of the two pilot payment options. OCPI target 2.3.0 with 2.2.1 compatibility as required by partner contracts. Do not activate roaming billing before settlement is verified.

Gate: two independently operated partner integrations in controlled pilot before claiming production roaming; conformance, retry/idempotency, credential rotation, reconciliation and partner outage tests. Host/fleet isolation and finance permissions verified.

## E — Differentiation

IDs: DRV-07/09/11, OPS-04, ENR-01/02, MIC-01. Prioritize Trust Layer (CORE-04 delivered in B), accessibility and measured reliability. Collect real site and session data; test route/queue demand and prediction quality. Validate load limits with electrical partners; charging readiness cannot override electrical safety. Support two-/three-wheelers based on actual hardware and market evidence.

Gate: verified site attributes, defined reliability denominators, measured freshness/accuracy, honest uncertainty, electrical fail-safe tests and evidence of customer value.

## F — Energy and scale

IDs: OPS-06, INT-04, ENR-03/04. Evaluate selected OCPP 2.1 blocks, battery swapping, Plug & Charge, solar/BESS, predictive maintenance and V2G only with data, hardware, PKI/OEM/utility partnerships and safety review. No speculative AI or automated controls without validation.

Gate: compatible hardware and contracts, fail-safe fallback, independently reviewed safety/security, measured model performance and operational rollback.

## Working process

Use one scoped branch/PR per milestone or vertical slice, reference feature IDs and audit findings, verify actual CI and regression tests, update catalogue status with commit/evidence, and request owner review before merging. Preserve current UI routes and approved design unless separately approved. No paid infrastructure, real financial processing, public exposure or hardware commands are authorized by this plan. VG-209 and human G-series gates remain mandatory for applicable commercial release; repeat affected verification as new capabilities land.

Next handoff: verify the merged VG-201 changes and remaining audit findings; implement VG-202 on a new engineering branch. Record identity-provider and device-security decisions in ADRs when selected, not as already adopted technologies.
