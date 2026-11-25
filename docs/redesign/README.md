# VoltGrid Experience Redesign

Status: **Engineering complete through UI-110 on branch `redesign/operator-experience`** — automated unit, lint, TypeScript, production build, `@axe-core/playwright` accessibility, Chromium+WebKit cross-browser responsive matrix, performance benchmark, security/data hardening, and live Docker Compose stack verification complete; **owner visual review (G1), manual screen-reader testing (G3), Firefox CI/local confirmation (G4), and human usability validation (G7) remain open** before merge to `main`.

Baseline: [main at f4708fb](https://github.com/Suthankan1/voltgrid/commit/f4708fb558226d8dfc43bcb2893b39f33782bab4).
Approved direction: simplicity first for technical and non-technical audiences; Orchid & Clay; Voltmark.

## Reading order
1. [Product experience](product-experience.md) — UX-001.1–3 and UX-001.6 principles.
2. [Information architecture](information-architecture.md) — UX-001.4.
3. [User journeys](user-journeys.md) — UX-001.5.
4. [Design system](design-system.md) — UX-001.6–7.
5. [Screen specifications](screen-specifications.md) — UX-001.8.
6. [Acceptance criteria](acceptance-criteria.md) — UX-001.9.
7. [Implementation roadmap](implementation-roadmap.md) — delivery sequence.
8. [Release Evidence Index](evidence/README.md) — UI-110 verification matrix, screenshots, defect register, security & performance findings, and release gates.
9. [Human Usability & AT Testing Kit](../usability-testing/README.md) — UI-110H participant study & manual VoiceOver/NVDA protocols.

## Authority and boundaries
These documents govern the redesign of `apps/operator-web`. `MUST` denotes a required behavior; `SHOULD` denotes a default subject to documented review. Existing backend contracts and security restrictions take precedence over illustrative design concepts. No new backend services, GraphQL mutations, database migrations, authentication, billing, cloud deployment, or production write access are included in this redesign milestone.

Do not delete historical release documents ([v0.2.0.md](../releases/v0.2.0.md)). All usability thresholds remain active release gates; no release number or completion waiver is claimed until owner sign-off and human validation complete.

## Source baseline
- [Station schema](../../services/station-service/src/main/resources/graphql/station.graphqls)
- [Operations schema](../../services/operations-service/src/main/resources/graphql/schema.graphqls)
- [Station client](../../apps/operator-web/src/lib/station-api.ts)
- [Operations client](../../apps/operator-web/src/lib/operations-api.ts)
- [Registration boundary](../../apps/operator-web/src/lib/station-registration.ts)
- [Frontend scripts](../../apps/operator-web/package.json)
