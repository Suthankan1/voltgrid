# Detailed screen specifications (UX-001.8)

## Shared shell UI-001
Persistent sidebar with workspace/support groups; logo home; active selection; responsive drawer; breadcrumb, contextual refresh, local environment label where accurate. No fake profile/notifications. Header title, optional short description, one primary action. Desktop grid, mobile stacked content. Shared states per user-journeys.md.

## UI-002 Overview /
Header + Add station where enabled. First row total/online/offline from full stations snapshot; metric links to filtered list. Second row connectivity (online / total × 100, not uptime; N/A if zero) and attention summary. Third row explicitly limited station preview, offline first with deterministic ordering. Retrieval time is not heartbeat. Empty network guidance; unavailable metrics unknown; no historical/financial charts.

## UI-003 Stations /stations
Header + Add station; search name/ID, All/Online/Offline filters, matching count. Desktop name, ID, connection, detail link; mobile stacked records. Retain original simple fleet list; no V2 infrastructure gallery. Full snapshot local search; URL-backed filters and restored context. No invented location/model/heartbeat/connector totals. Empty, no matches, unavailable distinct.

## UI-004 Station details
Header name primary, ID secondary, connectivity. Overview: connector counts and active-session count only from complete relevant responses, attention and explicitly limited recent sessions. Connectors: simple cards displaying EVSE+connector identity, status and statusUpdatedAt; prioritize faulted/unavailable; offline last-reported label. V3 approved: realistic-looking generic charger cabinet art (screen, cable, plug and status light) inside the cards, retaining V1 station overview and tabs. Do not add a parking-bay layout, facility map, separate equipment inspection panel, or complex hierarchy visualization. Art is illustrative, not evidence of physical installation or cabinet count. Sessions: station history with lifecycle and valid timing; link composite detail. Connection details: identifier, OCPP 2.0.1 and actual configured endpoint/path guidance; copy, no invented host. Independent query failures shown locally; missing station distinct. Mobile stacks cards and accessible tab controls. Do not infer occupied = active session.

## UI-005 Add station
Centered single-column form, name and ID, helper text, submit/cancel, local-only explanation. Exact validation and safe outcome handling per UJ-08. Confirmed result shows station and connection next steps. No automatic mutation retry. Maintain existing request-host gate and server action. Responsive full-width fields.

## UI-006 Sessions /sessions
Header, server filter toolbar, paginated table. Columns: session ID, resolved station name or ID fallback, lifecycle, completeness, start, duration where valid, details. Mobile stacked records. Use networkTransactionPage(page,size,stationId,transactionId,integrityStatus); exact ID filters, not unsupported substring server search. Preserve existing page-index semantics. Server totalElements/totalPages/hasNext are for server filter scope. Active filter applies to loaded page only; explicitly label and distinguish counts. Include all four integrity states; reset page on filter changes. No default sequence column. Avoid N+1 lookups: use existing stations snapshot for names if practical.

## UI-007 Session details
Header composite identity and station link; lifecycle and persistent data-quality status separately. Overview: startedAt/endedAt with explicit timezone, duration only for valid timestamps (active duration if offered explicitly elapsed as of retrieval), EVSE/connector. Measurements: actual sampledAt, numeric value validation, normalize compatible unit and multiplier only; group by measurand/context/phase/location/unit compatibility, avoid joining incompatible streams. Label peak/latest as recorded; cumulative energy register not session energy. Unknown units retain raw; missing events do not establish precise missing meter intervals; no invented zeros/interpolation. Accessible raw table: sequenceNumber, sampledAt, value, measurand, context, phase, location, unit, unitMultiplier. Technical: first/last/missing sequences, bounded rendering for large ranges, unknown distinct, no fabricated receipt details. Independent failures preserve valid summary. Mobile chart plus raw-data alternative.

## UI-008 Attention /attention
Offline stations from complete snapshot; incomplete sessions via networkTransactionPage integrityStatus INCOMPLETE with server totalElements and explicitly paginated preview. Independent failures labeled; never aggregate unavailable categories as zero. Link filtered lists/affected records. Connector faults remain station-local; no network scan/N+1 or fake incident management. If supported checks succeed and empty, say No matching issues found, not fleet healthy. Newly registered offline equipment may await connection.

## UI-009 Diagnostics /diagnostics
Use Operations stationStatuses(first,after,status) and existing cursor client. Preserve ONLINE/OFFLINE/UNAVAILABLE filters; cursor and selected status reset correctly on filter changes; link station detail safely. Display stationId, currentStatus, statusChangedAt, updatedAt; preserve lastEventId technical access where existing behavior warrants. Projection is asynchronous and may disagree with Station Service; no live telemetry claim or invented lag. Page counts scoped; no network totals from cursor page.

## UI-010 Help /help
Static accessible topics: getting started, configured OCPP connection instructions, offline meaning, missing events, local-only registration, asynchronous diagnostics. Contextual deep links, keyboard accordion; no mandatory onboarding.

## Integration boundaries (verified baseline)
Station schema: stations; station(id); stationConnectors(stationId); stationTransactions(stationId); networkTransactionPage(page,size,stationId,transactionId,integrityStatus); transaction(stationId,transactionId); transactionCompleteness(stationId,transactionId); transactionMeterSamples(stationId,transactionId); registerStation(input:{id,name}). Operations schema: stationStatus(stationId), stationStatuses(first,after,status). Preserve server-side endpoint configuration, runtime validation, no-store fetch behavior, existing 5s bounds where configured, guarded route decoding, and distinction between explicit null and errors. No backend changes. Verify precise client types/response validation when implementing each slice. Station Service owns station records; Operations is independent projection. Authorization Service is not an operator-management API.

## Screen completion
All applicable loading/empty/no-match/unavailable/not-found/refresh/stale/partial states; responsive layout; keyboard and screen reader; real API integration; no fixture values in production. See acceptance-criteria.md.
