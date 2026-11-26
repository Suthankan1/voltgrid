# Commercial readiness and market validation

Source: 26 November 2026 competitive research, especially Sri Lankan product and regulatory requirements, business models and evidence gaps. This is a planning checklist, not legal advice or evidence of registration, partnerships or payment approval. The original report contains source citations; exact regulatory deep links are not reproduced here. Retrieve and verify current official documents with qualified Sri Lankan counsel before relying on requirements.

## Business model

Recommended: asset-light hybrid CSMS SaaS + eMSP with partner CPOs. Compare pure CSMS (recurring B2B, existing technical fit), pure eMSP (network effects and partner dependence) and owned CPO (capital, sites, maintenance and electricity authority). Do not assume VoltGrid can sell electricity because it provides software. Consider per-EVSE/organization SaaS, premium support, fleet/host modules, white-label apps, API/roaming integration and energy management. Transaction fees only with lawful contractual/provider arrangements. No pricing or revenue forecasts without validation.

## Regulatory and operational work

| Area | Research-derived requirement / recommendation | Evidence before launch |
| --- | --- | --- |
| PUCSL EMSP | Report states registration mandatory from 6 Jan 2026; digital intermediary is not automatically authorized electricity seller | Current registration framework, counsel review, registration and scope |
| CPO authority | Partner CPOs need valid exemptions/authority and compliant installation | Verify authority, expiry, site/utility/electrical documentation |
| Consumer registration | CPO code reportedly calls for automated registration/authentication and customer history, including specified identity/contact/vehicle fields | Verify exact applicability; minimize data; privacy notice |
| Payment choice | Report identifies at least two alternative payment options and financial clearances | Licensed acquirer/provider contracts, sandbox and production approval, reconciliation |
| LANKAQR | Integrate through compliant licensed local provider; not own payment rail | Current CBSL specification and bank/provider contract |
| Metering/receipts | Meter verification/calibration and session receipts | Verify required fields, tax and tariff rules, meter evidence and reproducible receipt |
| Offline resilience | CPO code recommends start/end when mobile network unavailable; communicate availability/unavailability | Verify hardware behavior, safe offline policy and outage notifications |
| Safety/languages | Report identifies Sinhala/Tamil/English emergency guidance at site and in app | Native-language and electrical safety review, site signage and app content |
| Complaints | Report identifies reference number, immediate response to interrupted charging, acknowledgement within 3 working days and resolution effort within 14 working days or agreed extension | Confirm exact code and applicability, staffed escalation, trilingual process and SLA evidence |
| Privacy | Report states phased PDPA commencement with Sections 2/3 and Parts I/III from 1 Jan 2027 | Verify current DPA commencement orders; controller/processor roles, lawful purpose, retention, rights, incident response |
| Electricity/tax | No automatic right to resell electricity; contractual tariff/settlement/tax responsibilities | CPO/EMSP legal agreements and qualified accounting advice |

Relevant authorities to consult: PUCSL, CBSL, Data Protection Authority, CEB/LECO and relevant tax authorities. Treat recommendations (e.g. offline capability) distinctly from verified mandatory obligations. Full trilingual UI is a product goal beyond the specifically reported safety/complaint obligations.

## Partner qualification

Before any physical pilot obtain: CPO authority and site ownership; OCPP version/security profile, actual EVSE/connector/power/meter capability; remote command and offline behavior; hardware commissioning and electrical limits; data redistribution rights and freshness expectations; tariff/tax/payment/settlement ownership; OCPI support; RFID/token ownership; complaint and emergency responsibility; privacy roles; accessibility survey and contact escalation. No scraping or redistribution of competitor data without rights. Do not provision paid infrastructure or contact partners under this documentation task.

## Customer discovery

Interview drivers (including two-/three-wheeler users and people with accessibility needs), independent CPO operators, hosts, fleets, technicians, support and finance teams. Validate failed-trip causes, stale availability, payment friction, language needs, reservations/no-shows, queue ETA, fleet reimbursement, host SaaS willingness to pay, CPO roaming willingness and hardware-neutral remote operations. These are hypotheses, not established demand.

Capture consent, segment, observed task, evidence, severity, workaround, willingness to adopt/pay and follow-up. Do not fabricate interviews. Reuse the [existing usability study kit](../usability-testing/README.md) for operator validation; adapt driver/host/fleet scenarios before testing those products.

## Pilot and go-to-market

Start with one or more consenting independent CPO/site partners and verified hardware, then a controlled driver pilot with real support and licensed payment arrangements. Expand only after security, operational and financial reconciliation evidence. Measure successful-start ratio (define attempts and exclusions), status freshness, failed trips, completion rate, payment success/reconciliation, complaint response, MTTR, partner onboarding effort and customer retention. Set numerical targets after baseline and partner agreement; do not invent market-share, uptime or revenue figures.

Separate software delivery from physical installation, legal registration, commercial agreements, payment approval, support staffing and hardware/utility commissioning. These remain owner/business responsibilities, with engineering evidence supporting them.
