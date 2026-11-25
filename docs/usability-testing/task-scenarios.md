# Usability Task Scenarios & Comprehension Checks

**Rule for moderators**: Read only the **Participant prompt**. Never mention route paths (`/attention`, `/diagnostics`, etc.), sidebar labels, or tab names in the prompt.

## Core Timed Tasks

| # | Goal | Starting Screen | Participant Prompt | Time Target | Correct Completion Standard |
|---|---|---|---|---|---|
| **T1** | Identify offline count | Overview (`/`) | *"You just started your shift. How many charging stations are currently disconnected from the network?"* | **10s** | States exact offline count (`1` / fixture count) from authoritative summary without counting rows manually across pages. |
| **T2** | Find known station | Overview (`/`) | *"Find the charging station named `Kandy Transit Depot` and open its details page."* | **15s** | Navigates to `Kandy Transit Depot` station detail screen via preview or station search/filter. |
| **T3** | Faulty connector + composite ID | Station Overview (`/stations/CP-ONLINE`) | *"A driver reported a broken charger here. Which exact piece of equipment has an equipment fault, and how is it identified?"* | **30s** | Identifies **both** the EVSE number and connector number (e.g., `EVSE 1 · Connector 1`, status `Faulted`). Giving only `Connector 1` without `EVSE 1` is an incomplete/critical ambiguity check. |
| **T4** | Find historical session | Overview (`/`) | *"Look up charging session `TX-OK-1` and verify when it started and whether it has ended."* | **30s** | Locates session `TX-OK-1`, states UTC start time and `Ended` lifecycle state. |
| **T5** | Identify missing session records | Overview (`/`) | *"Check whether any charging sessions are missing telemetry event messages, and open one to see which event sequence numbers are missing."* | **30s** | Identifies `Missing data` (`INCOMPLETE`) session(s) and opens sequence audit showing specific missing sequence numbers (`[1, 2]`). |
| **T6** | Register station (local demo) | Overview (`/`) (`OPERATOR_LOCAL_WRITES=true`) | *"Add a new charging station called `Nuwara Eliya Plaza` with technical ID `CP-NE-01`."* | **60s** *(excludes physical connection)* | Submits valid name & ID once and reaches the **Station registered** confirmation screen. |
| **T7** | Locate connection guidance | Station Overview (`/stations/CP-NE-01` or `/stations/CP-ONLINE`) | *"You're on-site configuring a charger for this station. Where do you find the WebSocket path it needs to connect to?"* | **30s** | Opens Connection details (or post-registration Connection setup) and identifies `/ocpp/<stationId>` and `OCPP 2.0.1`. |
| **T8** | Access technical diagnostics | Overview (`/`) | *"A technician asks whether the asynchronous operational status feed matches what Station Service shows for `CP-OFFLINE`, and wants the last event ID. Find that record."* | **30s** | Navigates to operational projection view, locates `CP-OFFLINE`, and opens `Technical event details` to read `Last event ID`. |
| **T9** | Recover from failed read | Charging stations (`/stations`) *(backend temporarily returning `503`, restored once error appears)* | *"Try loading offline stations right now. If the screen shows an error, get the list loaded again without losing your place."* | **30s** | Recognizes unavailable state (does **not** mistake it for zero stations) and uses `Try again` or `Refresh data` after service recovery to display live rows. |

## Additional Qualitative & Cross-Device Checks

1. **First-time comprehension**: Can the participant explain the purpose of the workspace within 15 seconds without mandatory onboarding?
2. **Online ≠ Healthy**: After viewing an `Online` station that has a `Faulted` connector (`CP-ONLINE`), confirm participant understands `Online` only means Station Service connectivity, not hardware health.
3. **Occupied ≠ Charging**: When viewing an `Occupied` connector with `0` active sessions, confirm participant does not conclude power is actively flowing.
4. **Measurement & Register interpretation**: On `?section=measurements`, confirm participant can switch between `Power.Active.Import` and `Energy.Active.Import.Register`, inspect a raw value, and recognize that `Register` is a cumulative meter reading rather than derived session energy delivered.
5. **Back navigation & filter retention**: Filter `/stations` or `/sessions`, open a record, use the `← Back to ...` link, and verify filter context remained intact.
6. **Mobile usability (`390×844` or `320×568`)**: Open the mobile `Menu` drawer, visit two screens, inspect a stacked mobile card, and close the drawer cleanly.
7. **Read-only restriction (`/stations/new` with `OPERATOR_LOCAL_WRITES=false`)**: Confirm participant understands registration is intentionally disabled rather than broken.
