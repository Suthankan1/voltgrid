# VoltGrid Experience Redesign

Status: UX-001 specification complete; UX-002 consolidated; implementation and user validation pending.
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

## Authority and boundaries
These documents govern the redesign of apps/operator-web. MUST denotes a required behavior; SHOULD denotes a default subject to documented review. Existing backend contracts and security restrictions take precedence over illustrative design concepts. If a requirement cannot be implemented safely using current contracts, defer it and record the limitation; do not invent data or silently expand backend scope.

Do not delete historical release documents. No new backend work, cloud deployment, production write access or authentication claims are authorized by this milestone. All personas, usability thresholds and layouts are design hypotheses pending validation. Approved brand direction does not imply trademark clearance or accessibility certification.

## Source baseline
- [Station schema](../../services/station-service/src/main/resources/graphql/station.graphqls)
- [Operations schema](../../services/operations-service/src/main/resources/graphql/schema.graphqls)
- [Station client](../../apps/operator-web/src/lib/station-api.ts)
- [Operations client](../../apps/operator-web/src/lib/operations-api.ts)
- [Registration boundary](../../apps/operator-web/src/lib/station-registration.ts)
- [Frontend scripts](../../apps/operator-web/package.json)

Change this specification through reviewed documentation changes; record rationale, affected requirements and tests. No implementation or test pass is claimed here.
