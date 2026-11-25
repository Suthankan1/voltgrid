# Success Rubric, Defect Severity, and Scoring Calculations

## 1. Per-Task Outcome Rubric
- **Unaided Success (`U`)**: Participant reaches the exact correct outcome independently within `2 × target` without hints or moderator rescue and makes zero critical errors.
- **Assisted Success (`A`)**: Participant completes the task only after requesting or requiring a moderator prompt. Counted as completed **only** in overall completion (`U + A`), **excluded** from Unassisted completion (`U`) and **excluded** from median unaided timing.
- **Failed (`F`)**: Participant gives the wrong operational conclusion (critical error), cannot complete the task, or stops.
- **Not Attempted / N/A**: Explicitly excluded from applicable denominator and reported separately as missing/unattempted.

## 2. Metrics & Exact Formulas (Do Not Confuse Metrics)

Report **every numerator and denominator explicitly**:
1. **Core task completion rate**: `(Unaided + Assisted) / Attempted applicable tasks` (target `>= 90%`; also report per task).
2. **Unassisted completion rate**: `(Unaided) / Attempted applicable tasks` (target `>= 90%`; also report per task).
3. **Median successful unaided time & spread (IQR / min–max)**: Compute per task strictly over `Unaided Success` attempts; check `median <= task target`. Report `% meeting time target`.
4. **Mean post-task ease**: Mean of `1..7` ratings across all rated task attempts (target `>= 5.5`).
5. **Standard System Usability Scale (SUS)** (`0–100`, target `mean >= 80`):
   - Standard 10-item Likert (`1 = Strongly disagree` to `5 = Strongly agree`).
   - Odd items (`1, 3, 5, 7, 9`): contribution = `response - 1`.
   - Even items (`2, 4, 6, 8, 10`): contribution = `5 - response`.
   - `SUS = (sum of 10 item contributions) × 2.5`.
   - Note: SUS is a perceived usability score, **never** task completion percentage.

## 3. Defect Severity Rubric
- **P0 (Critical)**: Unsafe write/retry risk, participant misinterprets operational safety/data (e.g., mistakes unavailable API for zero stations, mistakes `Ended` for `Complete` data quality, mistakes cumulative `Register` reading for session delivered energy total), or privacy/security exposure. **Target: 0 unresolved P0s.**
- **P1 (High)**: Core task blocked or failed systematically, navigation trap, unreadable essential control, or broken assistive workflow. **Target: 0 unresolved P1s.**
- **P2 (Medium)**: Participant succeeds with hesitation or temporary detour via an available workaround.
- **P3 (Low / Cosmetic)**: Minor visual polish or wording preference with zero task impact.
