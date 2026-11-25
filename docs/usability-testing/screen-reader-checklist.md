# Manual Screen-Reader & Keyboard Verification Checklist (Gate G3)

> **Status: PENDING HUMAN ASSISTIVE-TECHNOLOGY VERIFICATION**
> Automated `@axe-core/playwright` checks (`0` violations across 35+ rendered states) and DOM accessibility-tree tests do **not** establish screen-reader UX compliance. Complete this checklist with **VoiceOver (macOS Safari)** and **NVDA (Windows Chrome/Firefox)** where available before marking Gate G3 Passed.

## Target Environments
- **Primary local OS**: macOS + **VoiceOver (`Cmd+F5`)** in Safari (note Safari Settings -> Advanced -> *"Press Tab to highlight each item on a webpage"* vs `Option+Tab` default link navigation).
- **Recommended secondary**: Windows + **NVDA** in Chrome/Firefox (not installed in macOS agent environment; mark unavailable unless run on Windows host).

## Representative Screen-Reader Journeys

| # | Journey | Verification Checkpoints | VoiceOver Result | NVDA Result |
|---|---|---|---|---|
| 1 | **Skip link & landmarks** | `Skip to main content` is announced first and moves focus into `main#main-content`; `Workspace sidebar`, `Breadcrumb`, and `Primary navigation` landmarks are distinct. | Pending | Pending |
| 2 | **Find station & status** | Overview metrics announce label + count/unknown + action cleanly; station table rows announce station name, `monospace` ID, `Online`/`Offline` status text + glyph without duplicate links. | Pending | Pending |
| 3 | **Inspect connectors & art** | Charger SVG illustrations are skipped (`aria-hidden="true"`), while EVSE ID, connector ID, status (`Faulted`), offline last-reported caveat, and UTC timestamp read in clear order. | Pending | Pending |
| 4 | **Register a station** | Field labels, helper descriptions, and `aria-invalid` + error alert (`role="alert"`) are announced cleanly on invalid submit; confirmation heading receives focus after creation. | Pending | Pending |
| 5 | **Failed read recovery** | Unavailable card is announced via `role="alert"`; `Try again` pending state and `Refresh data` preserve context without focus loss. | Pending | Pending |
| 6 | **Session completeness** | Lifecycle (`Ended`) and completeness (`Missing data`) read as two separate statuses; Technical details sequence items announce recorded/missing counts cleanly. | Pending | Pending |
| 7 | **Measurement stream & chart** | Stream `<select>` switches compatible streams via keyboard; SVG chart `role="img"` alternative reads summary; `Previous point`/`Next point` announce updated reading via `aria-live="polite"`; raw table provides all headers (`scope="col"`). | Pending | Pending |
| 8 | **Copy feedback** | Activating `Copy station ID` / `Copy OCPP path` triggers `"Copied"` / `"Copy unavailable"` via `role="status"`. | Pending | Pending |
| 9 | **Help disclosures & Mobile drawer** | Native `<details>`/`<summary>` announces expanded/collapsed state; mobile `Menu` opens `role="dialog"` with focus trapped and restored to `Menu` on `Escape`. | Pending | Pending |
