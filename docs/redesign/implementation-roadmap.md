# Implementation roadmap

## Milestones
UX-001 complete as specification. UX-002 documentation consolidation. UX-003 high-fidelity interactive prototype using fictional fixtures, clearly labeled; all P0 tasks and error states. UX-004 internal qualitative feedback led to V3: retain simple V1 station layout and use realistic-looking generic charger illustrations only. Owner approved V3 and explicitly deferred external testing until the working frontend. Formal internal scorecard and V3 regression verification remain pending. Production implementation may begin; G7 user validation remains a mandatory release gate. Preserve baseline for comparison.

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

## Current Status & Handoff
Slices **UI-101 through UI-110** are implemented and engineering-verified on `redesign/operator-experience`. See [evidence/README.md](evidence/README.md) for verified commits, test results, curated charger visual review captures, defect resolutions, security/data audit notes, and the live G1–G8 gate status matrix. Next step is owner visual review, GitHub Actions CI run on the draft pull request (including `ubuntu-latest` Firefox cross-browser verification), manual VoiceOver/NVDA checks, and execution of the 10-participant usability evaluation under [docs/usability-testing/](../usability-testing/README.md). No release number is assigned yet, and no cloud deployment or backend change is included.
