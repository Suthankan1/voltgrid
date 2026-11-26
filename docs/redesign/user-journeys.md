# User journeys (UX-001.5)

All journeys use real supported data; examples in prototype fixtures only.

| ID | Start and success path | Failure and recovery |
|---|---|---|
| UJ-01 | Open → retrieve stations → populated overview or valid empty network → add first station/help | Unavailable is not empty; retry; read-only empty state explains restriction |
| UJ-02 | Overview → counts/connectivity → offline filter or station preview | Retain last successful snapshot on refresh failure if safe, label age and retry; do not zero counters |
| UJ-03 | Stations → search name/ID + status → select → overview/tab | No matches: clear filters; null station: not found; failed lookup: retry; restore list state |
| UJ-04 | Overview/attention → offline stations → affected station → connection details → recheck | Offline not proof of fault; check power/network/configured endpoint; no fabricated cause or last heartbeat |
| UJ-05 | Station → Connectors → inspect faulted/unavailable equipment with EVSE + connector ID | No connector records: explain; unavailable section: retry; offline: last reported condition; no remote repair |
| UJ-06 | Sessions → exact supported filters → page → composite record → overview | No matches: clear filters; missing record vs unavailable; page-only lifecycle filter explicitly scoped |
| UJ-07 | Attention/session → missing data warning → technical sequence evidence → refresh | Late/out-of-order records may change completeness; no promise of arrival or manual repair; unknown distinct |
| UJ-08 | Add station → validate → submit once → confirmed success → connection guidance → inspect/refresh station | Invalid: field feedback; duplicate: lookup/correct; uncertain: verify before retry; disabled: explain |
| UJ-09 | Session → Measurements → select compatible stream → chart/raw values | No samples: explicit empty; unsupported units: raw values; unknown intervals: no fabricated zeros or interpolation |
| UJ-10 | Diagnostics or contextual technical details → filter/inspect timestamps and identifiers | Projection may differ from authoritative station status; cursor failure retry; reset cursor when filters change |
| UJ-11 | Any page → failure feedback → retry or safe navigation | Preserve safe input/list state; never expose exceptions or lose context unnecessarily |

## Read-state contract
Loading: accessible pending state and reserved skeleton space. Success: validated payload. Empty: valid zero records. No matches: filter excludes records. Not found: explicit absent entity. Unavailable: transport/HTTP/GraphQL/invalid response failure. Refreshing: retain valid prior data, mark pending. Stale: explicitly label previously retrieved data and age, offer retry. Partial failure: independent sections retain valid data; do not calculate totals from missing dependencies. No mandatory global auto-refresh.

## Registration contract
Trim both fields; identifier matches ^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$; name 1–255 characters after trim. Preserve server validation, local writes flag and loopback checks including request host. Disable duplicate submission while pending. On confirmed success show registered ID/name and actual configured OCPP connection guidance, not invented public host. Initial status may change if charger connects; registration is not physical connection. On ambiguous outcome, check authoritative fleet by exact ID before retry; if lookup fails, retain uncertainty; if existing record differs, do not claim success. Never retry a mutation automatically. Preserve user input on failure. No production authorization claims.

## Feedback
Inline field errors; persistent critical warnings and uncertain outcomes; confirmation for successful write; brief accessible copy feedback; section-specific retry for independent reads; safe back navigation on missing record. Use text and icon, not color alone. Keyboard focus moves appropriately after submission/error/navigation. See acceptance criteria for timing and verification.
