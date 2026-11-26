# Competitive landscape and positioning

Source: owner-supplied research report, 2026-11-26, sections Competitive landscape, Sri Lankan product and regulatory requirements, Global benchmark and whitespace, SWOT and Evidence gaps. Public feature claims are not independent conformance or uptime tests. "?" means not publicly verified, not absent. Counts are intentionally omitted because definitions and snapshots differ.

| Competitor / primary supplied URL | Observed model | Publicly reported strengths | Unverified or scope-limited |
| --- | --- | --- | --- |
| [ChargeNET](https://chargenet.lk/) | CPO, driver service, equipment and CMS | Discovery, live status, app/RFID start, live session, wallet/card, invoices, commercial CMS, home and business charging, OCPP 1.6J and selected 2.0.1 | Formal OCPI, accessibility metadata, offline policy, reservation and external API scope |
| [John Keells CG Auto](https://www.johnkeellscgauto.com/charger-network/) | Vehicle distribution/ownership ecosystem and charger network | Charger locator, connector information, GreenEV partnership | Independent general-purpose eMSP, wallet, remote commands, third-party CSMS, formal roaming |
| [GreenEV](https://greenev.lk/location.html) | Network, hardware, driver app and CMS | AC/DC network, discovery, live availability, start/stop, payments, history, advertised reservations, reports/alerts, home and business equipment | Receipt detail, roaming, fleet depth, offline policy and external API scope |
| [eMotion](https://emotion.lk/) | Network, driver service and site-host/business solutions | Availability, app/PIN/QR charging, live session, wallet/card, digital receipts, idle/off-peak rates, fleet/member pricing, LECO partnership | Formal OCPI, reservation, independent CMS depth, accessibility and API scope |
| [VoltCharge](https://www.voltcharge.lk/) | Network, driver service, VoltOS CMS and OCPI hub | Route planning, payments, fleet allowances, offline Bluetooth release evidence, advertised multi-tenancy, OCPP 1.6J/2.0.1, remote ops, OTA, audit, settlements, OCPI 2.2.1 and managed API | Actual conformance, SLA, accessibility and partner coverage; do not claim interoperability is unique to VoltGrid |
| [EV.lk](https://ev.lk/) | Equipment integrator and managed charging solutions | Installation, maintenance, remote diagnostics, CMS, remote control, payment processing, pricing, load balancing and analytics | Nationwide consumer app/network, roaming and public developer program |

## Feature evidence snapshot

Legend: Y = reported in public evidence; P = partial or scope uncertain; ? = not publicly verified. This is a condensed transcription of the research matrix, not a new investigation.

| Capability | ChargeNET | JKCG | GreenEV | eMotion | VoltCharge | EV.lk |
| --- | --- | --- | --- | --- | --- | --- |
| Discovery | Y | Y | Y | Y | Y | ? |
| Live status | Y | ? | Y | Y | Y | P |
| Driver app | Y | ? | Y | Y | Y | ? |
| Start/stop | Y | ? | Y | Y | Y | Y (CMS) |
| Digital payment | Y | ? | Y | Y | Y | Y (CMS) |
| Wallet | Y | ? | P | Y | Y | ? |
| Receipts | Y | ? | ? | Y | ? | ? |
| RFID | Y | ? | P | P | P | ? |
| Reservations | ? | ? | Y | ? | ? | ? |
| Route planning | Y | ? | ? | ? | Y | ? |
| Queue ETA | ? | ? | ? | ? | P | ? |
| Idle fees | ? | ? | ? | Y | P | ? |
| Fleet/member pricing | Y | ? | P | Y | Y | Y |
| Home charging | Y | Y | Y | Y | Y | Y |
| Site-host solutions | Y | P | Y | Y | Y | Y |
| CMS | Y | ? | Y | P | Y | Y |
| OCPP | Y | ? | Y | P | Y | P |
| OCPI | ? | ? | ? | ? | Y | ? |
| Fleet portal | P | ? | ? | Y (groups) | Y | P |
| Load management | Y | ? | ? | ? | P | Y |
| Support/monitoring | Y | P | Y | Y | Y | Y |
| Weak-network resilience | ? | ? | ? | P | Y (release notes) | ? |
| External developer APIs | ? | ? | ? | ? | Y | ? |

Independent aggregator apps mentioned in the report (PlugIt and EVfy Lanka) are additional fragmentation signals, not proof of formal roaming agreements or willingness to pay.

## Positioning and SWOT

- Strength: existing OCPP station/session/metering/completeness kernel, event-driven projection and redesigned operator experience.
- Weakness: commercial identity, tenancy, device trust, pricing, payment, driver and partner capabilities remain missing or partial; engineering and human release gates remain.
- Opportunity: neutral CPO partnerships, fragmented driver experience, local payment/language needs, accessible discovery, weak-network operation and two-/three-wheeler segments.
- Threat: established networks, vehicle ecosystem partnerships, competing CMS offerings and VoltCharge's public roaming/platform ambitions.

Recommended proposition: open, reliable charging software for independent CPOs, hosts, fleets and drivers, without forcing hardware lock-in. Compete on execution and measured trust, not unsupported market-first claims.

## Differentiation hypotheses

| Opportunity | Product IDs | Validation |
| --- | --- | --- |
| Trust Layer: freshness, reliability, stale status, known interruptions | CORE-04, OPS-04, OPS-02 | Compare actual status accuracy and successful starts in pilot |
| Verified accessibility | CORE-02, DRV-11 | Site surveys and interviews with drivers with disabilities |
| End-to-end Sinhala/Tamil/English | DRV-10, ADM-03 | Native-language review and task testing |
| Low-connectivity charging | OPS-05, AUTH-01 | Hardware-specific disconnect/reconnect and billing tests |
| Neutral cross-network prices and routing | INT-01, DRV-07, PAY-01 | Partner contracts, conformance and fresh tariff data |
| Two-/three-wheeler charging | MIC-01 | Vehicle and connector survey; no passenger-car assumptions |
| Solar/BESS, safe power limits | ENR-01–04 | Electrical partner and compatible meter/EVSE pilot |
| Predictive maintenance | OPS-06 | Labelled fault history and measured false positives |

## Evidence maintenance

The report also cites app-store listings, regulatory material, EVRoaming Foundation, Open Charge Alliance, Hubject, ChargePoint, Monta, Driivz and EV Connect. Exact deep links for those citations are not available in this repository transcription. Before treating a competitor claim or legal obligation as a binding requirement, retrieve the original cited source, record URL, access date, claim, version and limitations. Verify partner hardware, supported commands, offline behavior, pricing/settlement rights, data redistribution, accessibility, privacy roles and complaint ownership. Do not infer absence from missing public evidence.
