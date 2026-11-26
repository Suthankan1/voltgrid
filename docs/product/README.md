# VoltGrid commercial product plan

Status: proposed product strategy, pending owner review. Research date: 2026-11-26.

## Purpose

Evolve the existing OCPP-based operator console into an asset-light, hardware-neutral CSMS + eMSP for Sri Lanka, with partner CPOs, site hosts, fleets and drivers. A small reference charging estate is optional, not a prerequisite to software development. Product areas are not commitments to separate apps or microservices.

| Document | Purpose |
| --- | --- |
| [Competitive landscape](competitive-landscape.md) | Six competitors, evidence limits, market positioning and differentiation |
| [Master feature catalogue](feature-catalogue.md) | All 52 research feature IDs, baseline status, priority, dependencies and acceptance criteria |
| [Delivery roadmap](delivery-roadmap.md) | Ordered work packages, VG-200 integration, gates and next milestone |
| [Architecture and release gates](architecture-and-release-gates.md) | Domain boundaries, protocol scope, security, billing and verification |
| [Commercial readiness](commercial-readiness.md) | Regulatory, partner, customer discovery, pilot and business-model work |

## Source and baseline

Derived from the owner-supplied research report **VoltGrid Sri Lanka Competitive Intelligence and Full Product Roadmap**, dated 26 November 2026. Its source-specific citations are available in the original report; the repository summary does not reproduce opaque chat citation identifiers or pretend to independently verify every source. See the competitive landscape for supplied URLs and verification requirements.

Research baseline: [e6bf891](https://github.com/Suthankan1/voltgrid/commit/e6bf89173746ebfdb59d74fe5acb71d9f32b21f8). Planning branch baseline: [d353778](https://github.com/Suthankan1/voltgrid/commit/d3537786b1e0662bef0c8171bd8985fd231dc78b), which merges [core hardening e1db18a](https://github.com/Suthankan1/voltgrid/commit/e1db18a1d50717f297b17b98b222323447b83b5e) and the VG-200 audit. The commit and changed paths were inspected; tests were not independently executed for this documentation change. Do not assume the older audit is a current test result or that all its findings are resolved.

- [VG-200 audit](../audit/README.md) and [engineering roadmap](../audit/16-implementation-roadmap.md) remain authoritative for audit findings and remediation sequencing.
- [Operator redesign](../redesign/README.md) and its acceptance criteria remain applicable; no human usability gate is waived.
- Feature IDs in this directory are product requirements, not audit finding IDs. Priorities P0–P3 here are product sequencing, not security severities.
- No feature is marked implemented merely because it is planned. No runtime, deployment, dependency, payment or hardware changes are authorized by this documentation PR.

## Product principles

Trustworthy availability, transparent pricing, secure tenant isolation, accessible trilingual UX, standards-led interoperability, resilient charging and safe control. Unknown data stays unknown. Prefer a mobile-first driver PWA before native apps, and extend the approved Orchid & Clay operator design rather than replacing it. Validate market demand and hardware capabilities before expanding scope.

The next engineering step is VG-202 after verifying VG-201 evidence and remaining findings. Commercial launch requires the engineering and human release gates plus legal/partner readiness; merging this plan does not authorize a public deployment.
