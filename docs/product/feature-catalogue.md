# Master feature catalogue

All 52 stable IDs from the 26 November 2026 competitive research. Status is the research baseline (e6bf891), not a fresh source-code audit: E existing, P partial, M missing, U unknown; M/P denotes uncertainty between missing and partial. The subsequent d353778 hardening merge is not evidence of commercial feature completion. Reassess each status at implementation kickoff. P0 foundation/pilot essential, P1 competitive expansion, P2 later enhancement, P3 advanced/data/partner-dependent; these are not audit severity ratings.

Delivery groups A–F are proposed ordering (see [roadmap](delivery-roadmap.md)). Dependencies are gates, not permission to implement in parallel without design review. Each row is a capability/epic, not a single ticket. Split into design, migration, API, UX, tests, operations and partner tasks as needed. Acceptance is proposed, not passed.

| ID | Capability | Baseline | Priority | Group | Acceptance criterion | Dependencies / impact |
| --- | --- | --- | --- | --- | --- | --- |
| SEC-01 | Operator identity / OIDC | M | P0 | A | Authenticated actions, expiring/revocable sessions; no shared admin credential. | VG-202; external IdP; API/BFF authorization. |
| SEC-02 | Organization/role/resource authorization | M | P0 | A | Owner/admin/operator/support/finance/technician can access only permitted resources. | SEC-01, CORE-01; negative cross-tenant tests. |
| SEC-03 | Charging-station device identity | M/P | P0 | A | Station ID alone cannot authenticate; credentials rotate and revoke. | VG-202/203; OCPP hardware security profile. |
| SEC-04 | Immutable administrative audit trail | P | P0 | A | Actor, time, action, resource and result recorded for login/configuration/commands/tariffs/refunds/roles. | SEC-01/02; tamper protection, retention and redaction. |
| CORE-01 | Multi-tenant organization/site model | M | P0 | A | Multiple CPOs/sites/hosts isolated across queries, writes and events. | SEC-01/02 co-design; migration/backfill. |
| CORE-02 | Geospatial site metadata | M | P0 | B | Verified/versioned coordinates, hours, amenities, accessibility and entrance instructions; unknown remains unknown. | CORE-01; host surveys; map provider. |
| CORE-03 | EVSE capability model | P | P0 | B | Connector type, current, max power, hardware capability and status separate and validated. | Station/OCPP metadata; hardware verification. |
| CORE-04 | Status freshness/trust | M | P0 | B | Every state has last-observed time; stale state never definitively available. | Connection telemetry; API/UI freshness policy. |
| DRV-01 | Driver PWA/mobile experience | M | P0 | C | Mobile-first compatible charger discovery, authentication and supported charging journey. | Identity, CORE-02/03/04, DRV-04/05, PAY. |
| DRV-02 | Map/discovery/filtering | M | P0 | C | Search place; filter connector, power, availability, operator, hours, access, price. | CORE-02/03/04, PAY-01; licensed map data. |
| DRV-03 | Vehicle profile/compatibility | M | P1 | D | Vehicle connector/capability filters unsuitable EVSEs; no guaranteed charge curve. | Vehicle catalog governance; CORE-03. |
| DRV-04 | Driver remote start/stop | M | P0 | C | Authorized supported EVSE start/stop with idempotent command and truthful outcome. | OPS-01, SEC-01/02/03; driver ownership. |
| DRV-05 | Live charging session | P (backend) | P0 | C | Actual energy/power/time/cost with freshness and unknown semantics. | Measurement normalization, PAY-01; no register-as-energy error. |
| DRV-06 | Driver charging history | P (operator only) | P0 | C | Driver can retrieve only own sessions, costs and receipts. | Driver identity, PAY-05, ADM-02. |
| DRV-07 | Route planner | M | P2 | E | Compatible route uses hours, coverage and explicit freshness. | DRV-02/03, routing provider, partner coverage. |
| DRV-08 | Reservations | M | P2 | D | Only capable participating EVSEs; expiry/no-show/fees disclosed. | CORE-03, OPS-01, CPO/OCPI support. |
| DRV-09 | Waitlist/queue ETA | M | P2 | E | Transparent order; predictive ETA labeled with uncertainty. | Session-duration and utilization history. |
| DRV-10 | Sinhala/Tamil/English localization | M | P0 | C | Safety, complaint, price and critical charging flows in all three languages. | Native-language review, translation workflow, legal review. |
| DRV-11 | Accessibility-aware discovery | M | P1 | E | Filter verified accessibility attributes; unknown not inferred. | CORE-02, site surveys, OCPI accessibility. |
| PAY-01 | Versioned tariff engine | M | P0 | C | Pre-session price; kWh/time/idle/session components and effective dates; reproducible quote. | CPO contracts, metering, LKR precision, legal review. |
| PAY-02 | Licensed gateway integration | M | P0 | C | At least two compliant payment options; no raw card storage. | Licensed providers, PAY-01, PAY-06, financial clearance. |
| PAY-03 | LANKAQR/ad-hoc QR | M | P1 | D | Compliant provider QR payment reconciles to session/order. | Bank/acquirer; PAY-02/06. |
| PAY-04 | Wallet/credits | M | P1 | D | Double-entry idempotent ledger; top-up/refund/expiry rules explicit. | PAY-02/06; legal/accounting approval. |
| PAY-05 | Receipts/invoices | M | P0 | C | Each billed session yields immutable receipt with required session/tariff/payment fields. | PAY-01/02/06; tax/legal. |
| PAY-06 | Refunds/disputes/reconciliation | M | P0 | C | No double charge under retries; gateway/session/receipt/settlement discrepancies visible. | Ledger, signed webhooks, support, accounting. |
| PAY-07 | Promotions/idle/off-peak rates | M | P2 | D | Applicability disclosed before charging; historic bill reproducible. | PAY-01; CPO rules. |
| AUTH-01 | RFID/token management | P | P0 | B | Issue/revoke/assign to user/vehicle/org; explicit offline policy. | SEC-01/02/03; Authorization Service; VG-208. |
| OPS-01 | Production remote operations | M | P0 | B | Capability-gated authorized/audited start/stop first; unlock/reset/availability separately verified. | VG-208, SEC-02/03/04; outbound OCPP correlation. |
| OPS-02 | Incident/ticket management | M | P1 | D | Fault/complaint has reference, owner, state and timestamps. | Operations events, ADM-03; support staffing. |
| OPS-03 | Notifications | M | P1 | D | Opt-in session/outage/reservation/support/recovery notifications. | Consent; SMS/email/push providers. |
| OPS-04 | SLA/reliability analytics | M | P1 | E | Successful-start ratio, availability, stale rate and MTTR from defined events. | Sufficient telemetry/history; CORE-04, OPS-02. |
| OPS-05 | Low-connectivity/offline resilience | M | P0 | C | Supported chargers finish/reconcile after disconnect without duplicate billing. | Hardware capability, AUTH-01, PAY-06; fail-safe policy. |
| OPS-06 | Predictive/anomaly maintenance | M | P3 | F | Explainable alerts; false positives measured before automated action. | Labelled faults; OPS-04; human oversight. |
| HOST-01 | Site-host portal | M | P1 | D | Host sees only own sites, uptime, sessions, revenue/settlement and tickets. | CORE-01, SEC-02, PAY, OPS-02; read-only pilot may precede finance. |
| HOST-02 | Installation/commissioning workflow | M | P2 | D | Versioned site survey, capacity, commissioning and compliance evidence. | Electrical partners, CEB/LECO/PUCSL. |
| FLT-01 | Fleet/depot portal | M | P1 | D | Per-fleet vehicle/driver/depot charging, readiness, allowances and costs. | CORE-01, SEC-02, vehicle identity, PAY. |
| FLT-02 | Corporate allowances | M | P1 | D | Driver/vehicle budgets enforced transactionally and audited. | FLT-01, PAY, AUTH-01. |
| FLT-03 | Home/public/depot reimbursement | M | P2 | D | Eligible charging reconciled with evidence. | Home integrations, employer rules, PAY-06. |
| INT-01 | OCPI interoperability | M | P1 | D | Conformant locations/status/tariffs/tokens/sessions/CDRs/commands; tested retries. | CORE-01/02/03/04, PAY, SEC; 2.3 target, 2.2.1 partner compatibility. |
| INT-02 | Roaming settlement | M | P2 | D | Partner sessions reconcile against versioned tariffs/CDRs deterministically. | INT-01, PAY-06, finance contracts. |
| INT-03 | Partner API/webhooks | M | P1 | D | Scoped OAuth/keys, quotas, versioning, idempotency and replay protection. | SEC-01/02/04, rate limits, contracts. |
| INT-04 | Plug & Charge readiness | M | P3 | F | Contract/device certificate model; no activation until verified PKI/hardware partners. | ISO 15118, OCPP security, OEM/PKI. |
| ENR-01 | Static/dynamic load management | M | P1 | E | Supported scenarios respect site import limit; profiles audited, safe fallback. | Site meter, OCPP profiles, electrical validation. |
| ENR-02 | Scheduled smart charging | M | P2 | E | Departure/capacity/tariff schedule without safety compromise. | ENR-01, FLT-01, PAY-01. |
| ENR-03 | Solar/BESS integration | M | P2 | F | Verified meter/PV/BESS state and safe fallback on missing telemetry. | ENR-01, inverter/storage partners. |
| ENR-04 | Demand response/V2G | M | P3 | F | Disabled without utility program and compatible EV/EVSE/protocol. | OCPP 2.1, ISO 15118, utility/OEM. |
| MIC-01 | Two-/three-wheeler support | M | P1 | E | Vehicle/connector/battery-swap model avoids passenger-car assumptions. | Hardware/market survey; battery swap activation separately gated. |
| ADM-01 | EMSP/CPO compliance registry | M | P0 | A | Authority/exemption, expiry and invalid state visible per commercial operator/station. | Legal/compliance; CORE-01. |
| ADM-02 | Privacy/consent/retention | M | P0 | A | Purpose, lawful handling, retention/deletion and processor records before commercial PII. | PDPA legal review; SEC, data governance. |
| ADM-03 | Complaint/support portal | M | P1 | D | Reference, communication history, SLA timers and escalation. | OPS-02, DRV-10; trilingual support. |
| ADM-04 | Fraud/risk controls | M | P1 | D | Detect duplicate starts/payments, token-sharing and refund abuse without blocking legitimate retries. | SEC, PAY, telemetry; manual review. |
| ADM-05 | Settlement/reporting exports | M | P1 | D | Finance reconciles CPO/host/roaming statements to immutable session/payment records. | PAY-06, INT-02 for roaming; tenant-scoped export. |

## Cross-cutting acceptance for every capability

Each implementation PR must identify affected IDs, verify current baseline and prerequisites, document scope and non-goals, preserve existing data semantics, enforce server-side resource authorization, validate untrusted input, bound queries and retries, test failure/recovery and tenant isolation, consider privacy/accessibility/localization, include migration/rollback and operational evidence where relevant, and link actual CI results. Never expose an unimplemented capability as live.

## Additional engineering enablers (not extra research feature IDs)

The audit's GAP-001/002/003 and VG-208 cover standalone MeterValues, outbound OCPP commands and timestamp compatibility; verify current behavior with protocol tests rather than copying historical assumptions. Add capability-driven provisioning, Get/SetVariables, ChangeAvailability, diagnostics/log retrieval, local authorization list, firmware lifecycle and security events only after individual design and hardware tests. Evaluate OCPP 1.6J compatibility against partner hardware inventory; no claim of support/certification until conformance and device tests. OCPP 2.1, signed metering and certificate management require explicit business/regulatory/hardware decisions. All advanced operations remain disabled until verified safe.

## Traceability

Competitor parity and differentiation rationale are in [competitive landscape](competitive-landscape.md). Local obligations and partner prerequisites are in [commercial readiness](commercial-readiness.md). The original report's feature IDs and priorities are preserved; group assignment and additional acceptance details are planning proposals.
