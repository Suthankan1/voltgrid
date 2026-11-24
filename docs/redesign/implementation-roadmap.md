# Implementation roadmap

## Milestones
UX-001 complete as specification. UX-002 documentation consolidation. UX-003 high-fidelity interactive prototype using fictional fixtures, clearly labeled; all P0 tasks and error states. UX-004 formative user testing and iteration (preserve baseline for comparison). Do not start production frontend until prototype feedback and design changes reviewed.

| Slice | Deliverable | Exit evidence |
|---|---|---|
| UI-101 | CSS tokens, local licensed fonts, Voltmark assets, core primitives | Contrast/state examples, build and tests |
| UI-102 | Shell, navigation, responsive drawer, route migration plan | Keyboard, viewport, legacy route tests |
| UI-103 | Overview | Counts/zero/unavailable and links |
| UI-104 | Stations list | Search/filter/back-state browser tests |
| UI-105 | Station detail | Tabs, connector identity, offline and partial-state tests |
| UI-106 | Registration | Local write gate, validation, duplicate/uncertain and real registration |
| UI-107 | Sessions list | Exact filters, server pagination, page-only lifecycle |
| UI-108 | Session detail | Timing, integrity, compatible measurements/raw data |
| UI-109 | Attention, diagnostics, help | Independent failures, cursor reset, contextual links |
| UI-110 | Integration and quality | All release gates, real local stack, user validation |

Split each slice further as needed; UI-109 should be separate attention/diagnostics/help commits. Commit after each independently verified small change. Maintain working application and rollback via Git; avoid destructive history changes. Do not push directly to main; review branch changes before merging.

## Engineering decisions
Retain Next.js 16.3.5, React 19.2.8, TypeScript, Tailwind 4, pnpm 12.4.2 and reproducible Webpack builds at baseline; do not upgrade dependencies gratuitously. Use server components/server-only clients and selective client interaction. CSS custom properties, Lucide and accessible primitives (new dependencies require review); chart library optional, evaluate weight/accessibility. Preserve API clients, runtime validation, registration guards, tests and CI. No backend/service/infra changes in this milestone. AWS dev previously intentionally removed; local Compose is verification target.

## Change control
Before each slice inspect actual code, document contract mismatch and choose safe frontend limitation rather than silently adding backend functionality. Review affected requirements and tests. Keep old route behavior compatible. Capture visual baselines only after review. Update this documentation if prototype validation changes design. Track evidence in PR/commit notes. No release number assigned. No public deployment or authentication claim.

## Next action
Review UX-002 documentation; then UX-003 prototype. Do not treat diagrams, fictional records, or approved brand as shipped implementation. No frontend or backend code has been changed by UX-002.
