# Architecture evolution and release gates

Proposed design constraints, not implemented ADRs. Retain the existing Java/Spring services, PostgreSQL, Kafka/outbox and Next.js operator console where practical. Evaluate modular application boundaries before adding services; choose transaction, ownership, security and scaling boundaries deliberately.

| Boundary | Responsibility / proposed evolution |
| --- | --- |
| Station Service | Authoritative device/EVSE/connector, connectivity, OCPP, session and meter data; verified capability and command lifecycle |
| Authorization Service | Charging token identity, issuance/revocation and offline policy; distinct from human OIDC identity |
| Operations Service | Asynchronous projection, operational health, incidents/alerts; never substitute projection for authoritative station connectivity |
| Identity and organization | External OIDC integration, resource-scoped RBAC, CPO/host/fleet memberships, tenant isolation across API/DB/events |
| Commercial domain | Versioned tariffs, quote, payment intent, ledger, receipts, refunds, settlements and reconciliation; define transaction boundary before service extraction |
| Partner boundary | OCPI and versioned scoped APIs/webhooks; partner credentials, retries, rate limits, data provenance |
| Experiences | Existing operator console; driver PWA first; role-scoped host/fleet/support surfaces; shared design tokens and accessibility |

## Domain and safety invariants

- A site, station, EVSE, connector and charging point are distinct; define counts. No fabricated coordinates, power ratings, physical layout or accessibility.
- Connectivity, connector availability, charging lifecycle, data completeness and freshness are independent. Offline is not necessarily fault; occupied is not proof of charging. Stale or unavailable data is not zero or confirmed available.
- Use OCPP 2.0.1 core first; support legacy 1.6J only when justified by hardware demand and tested separately. Target OCPI 2.3.0 with 2.2.1 compatibility where needed. Do not claim protocol certification based on a subset.
- Remote command lifecycle must distinguish requested, accepted/rejected, timed out/uncertain and observed physical/session outcome. Enforce resource ownership, idempotency, correlation, expiration, capability, audit and safe failure. Do not blindly retry uncertain start/stop. Never override electrical safety or local emergency controls.
- Meter data retains raw provenance and units; normalize multipliers once; distinguish cumulative register from delivered energy. Missing/invalid readings or incomplete sessions trigger reconciliation rather than invented energy or cost.
- Price quote and tariff version are immutable inputs to billing; use exact decimal/minor-unit accounting with explicit rounding/tax rules. Separate session, payment and settlement state. Verify signed provider callbacks, deduplicate events, reconcile refunds and chargebacks, avoid raw card storage. Never equate payment success with successful charging.
- Use explicit least privilege for operator, driver, device and partner identities; enforce server-side tenant scope on every query, command, event, export and webhook. Do not expose internal gRPC/Kafka/DB publicly. Audit sensitive changes without logging secrets or unnecessary PII.
- Offline operation depends on actual charger capability and bounded authorization policy; reconcile on reconnect with idempotency and safe fallback. No promise that every device can charge offline.

## Release evidence

| Gate | Required evidence |
| --- | --- |
| Engineering foundation | Current VG-200 findings disposition; actual unit/integration/CI, negative authorization and device impersonation tests, transport/network review, dependency/image scans, secrets and backup/restore |
| Charging protocol | Simulator and compatible physical hardware tests, reconnect/duplicate/out-of-order events, bounded payloads, command uncertainty and capability checks |
| Data/finance | Tariff reproducibility, precision, duplicate/replay protection, reconciliation, refunds, immutable receipt, cross-tenant tests |
| UX/accessibility | Existing [redesign acceptance criteria](../redesign/acceptance-criteria.md), keyboard/screen reader, cross-browser, responsive and actual human validation; repeat for driver/host/fleet journeys |
| Reliability/performance | Measured SLOs and load tests on representative workloads; status freshness and successful-start metrics with defined denominators; recovery drills and alert ownership |
| Regulatory/partner | Verified exemptions/registration, licensed payment arrangements, privacy/terms, trilingual safety/complaint review, signed data-sharing and support responsibility |
| Pilot | Controlled partner and hardware scope, real user feedback, support escalation, reconciliation and incident rollback; no unresolved critical/high exploitable risk |
| Release | VG-209 plus applicable G1–G8, security review/pen-test, CI, migration/rollback, owner sign-off and evidence at release commit |

Lab performance is not field performance. No fabricated participant results, availability history, partner conformance, regulatory approval or commercial readiness. Record blocked/unverified gates explicitly. If a mandatory gate cannot be met, keep the affected capability disabled and do not describe it as production-ready.
