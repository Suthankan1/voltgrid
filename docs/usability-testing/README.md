# VoltGrid Operator Console — Human Usability & Assistive-Technology Testing Kit (UI-110H / G7)

> **Status: PENDING HUMAN VALIDATION (Gate G7 & Manual Screen-Reader Check)**
> Automated engineering checks (Axe WCAG 2.2 AA, Playwright functional flows, and live-stack integration) do **not** establish human usability comprehension or assistive-technology screen-reader sign-off. No human sessions have been run yet; no synthetic participant scores exist.

## 1. Study Objectives & Participant Plan

This evaluation verifies that the redesigned VoltGrid Operator Console (`apps/operator-web`) resolves the usability confusion reported prior to the redesign without hiding operational caveats or fabricating telemetry.

- **Target cohort (10 participants minimum)**:
  - **4 non-technical / operations-support participants**
  - **4 technical / EVSE engineering participants**
  - **2 management-oriented participants**
- Include prior feedback participants and newcomers where available, plus real EV infrastructure operators when feasible.
- Optionally run a ~5-participant **formative round** before the 10-participant summative evaluation; treat small samples as formative evidence rather than population-wide statistical estimates.
- **Comparative fairness**: If comparing legacy (`v0.2.0`) vs. redesigned UI, use equivalent datasets, devices, and task complexity with counterbalanced task ordering or separate participant groups to avoid learning bias.

## 2. Controlled Fixture Preparation

Use **only controlled demo/test fixtures** (never private, customer, or production records):

1. Start the isolated fixture stack or seed the local Compose demo with controlled test records:
   - At least **4 registered stations** (mix of `ONLINE` and `OFFLINE`, e.g., `Colombo Harbor Hub` `ONLINE`, `Kandy Transit Depot` `OFFLINE`).
   - Connectors spanning all five OCPP states (`FAULTED` e.g., `EVSE 1 · Connector 1`, `UNAVAILABLE`, `OCCUPIED`, `RESERVED`, `AVAILABLE`), including a faulted connector that must be distinguished by composite EVSE + connector ID.
   - Charging sessions covering `ACTIVE` + `IN_PROGRESS`, `ENDED` + `COMPLETE`, and `ENDED` + `INCOMPLETE` (missing OCPP sequences `[1, 2]`), with recorded `Power.Active.Import` and `Energy.Active.Import.Register` meter samples.
   - Asynchronous Operations projection entries including at least one cursor page boundary and one status discrepancy/lookup entry.
2. Verify read/write mode before each task:
   - **Tasks 1–5, 7–8**: Standard console or local demo mode (`OPERATOR_LOCAL_WRITES=true` or `false` as specified per task).
   - **Task 6 (Register station)**: `OPERATOR_LOCAL_WRITES=true` targeting loopback `http://127.0.0.1:...` + one separate **Read-only check** with `OPERATOR_LOCAL_WRITES=false`.
   - **Task 9 (Recover from failed read)**: Simulate transient backend unavailability (`HTTP 503` or paused service container) and restore availability before the participant activates **Try again** / **Refresh data**.

## 3. Documents in This Kit

| File | Purpose |
|---|---|
| [participant-instructions.md](participant-instructions.md) | Non-leading participant briefing and consent check |
| [moderator-script.md](moderator-script.md) | Standardized facilitation rules, neutral prompts, and zero-coaching protocol |
| [task-scenarios.md](task-scenarios.md) | All 9 timed tasks, comprehension checks, starting screens, and time targets |
| [rubric-and-scoring.md](rubric-and-scoring.md) | Success/assisted/failure criteria, P0–P3 defect rubric, SUS & median math, retest gate |
| [observation-and-timing-sheet.md](observation-and-timing-sheet.md) | Per-session timing sheet, observation log, post-task 1–7 ease, and standard 10-item SUS |
| [results-template.md](results-template.md) | Anonymized aggregate scorecard template with explicit denominators |
| [screen-reader-checklist.md](screen-reader-checklist.md) | Human VoiceOver / NVDA manual verification checklist (required for G3 sign-off) |

## 4. Acceptance Targets (`docs/redesign/acceptance-criteria.md`)

- **Core task completion**: `>= 90%` (using attempted applicable tasks as denominator; also report per task)
- **Unassisted completion**: `>= 90%`
- **Critical user errors**: `0`
- **Mean post-task ease**: `>= 5.5 / 7`
- **Mean SUS score**: `>= 80 / 100`
- **Median successful unaided time**: at or below every task time target (`10s–60s`)
- **Comprehension**: Online ≠ healthy, Occupied ≠ active charging, Ended ≠ complete session data, Cumulative register ≠ session energy total
- **No systematic failure hidden by aggregate averages** and **no mandatory onboarding**

## 5. Retest Procedure

1. Any `P0` or `P1` usability finding—or any task falling below target completion (`< 90%`) or exceeding median time target—blocks **G7**.
2. Log every defect in `results-template.md` using the P0–P3 severity rubric in `rubric-and-scoring.md`.
3. Implement minimal targeted fixes with regression tests, re-seed identical controlled fixtures, and retest the affected tasks with **at least 3 representative participants** (confirming zero regression on adjacent flows) before updating G7 status.
