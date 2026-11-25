# Moderator Script & Protocol

## Pre-Session Checklist (Before Participant Arrives)
- [ ] Reset fixture database/server to the clean controlled evaluation dataset.
- [ ] Confirm browser zoom (`100%`) and clean session state (unless testing mobile `390×844` or `320×568` scenarios).
- [ ] Prepare timing sheet and confirm desktop/mobile device matches participant assignment.
- [ ] Do **not** describe the sidebar groups, tabs, or screen names beforehand.

## Opening Script
> "Hi [Name], thanks for joining. Today we're evaluating a redesign of the VoltGrid charging network console. Remember, we are testing the software—never you. There are no wrong answers. Please think out loud as you go so we know what makes sense and what feels confusing. Every record on screen is local demo data. Are you ready to begin, and do you consent to us recording anonymized timings and notes?"

## Standardized Task Delivery Rules
1. Navigate silently to the **Starting screen** listed in `task-scenarios.md`.
2. Read the task prompt verbatim without emphasizing menu labels or hints.
3. Start the stopwatch when the participant makes their first visual scan/movement after **"You can begin."**
4. **Zero coaching during timed tasks**:
   - Allowed neutral prompts: *"What are you thinking right now?"*, *"What would you expect that label to mean?"*
   - Disallowed prompts: *"Try checking the left menu"*, *"Look under Technical details"*, *"Offline is on Needs attention"*.
5. **Assistance rule**: Only provide a hint if the participant explicitly gives up OR exceeds `2 × target time` with zero progress; immediately mark outcome as **Assisted** or **Failed** (never Unaided).
6. Stop the stopwatch when the participant gives their final answer or completes the action.
7. Ask the single post-task ease question (`1 = Very difficult` to `7 = Very easy`) immediately after each task while impressions are fresh.

## Comprehension Debrief Prompts (After Tasks 1–9)
- Ask: *"If a station shows `Online`, does that prove its connectors can charge a car right now?"*
- Ask: *"If a connector shows `Occupied`, does that prove electricity is actively flowing?"*
- Ask: *"Look at the energy reading marked `Energy.Active.Import.Register`—is that total energy delivered during this single session?"*
- Ask participant to complete the 10-item SUS questionnaire independently without discussion.
