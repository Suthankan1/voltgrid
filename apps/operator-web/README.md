# VoltGrid Operator Console

Local operator web console (`Next.js 16.3.5`, `React 19.2.8`, `TypeScript`, `Tailwind CSS 4`) redesigned under the **Orchid & Clay** visual system with the **Voltmark** identity and locally hosted **Manrope** + **IBM Plex Mono** typography (`public/fonts/`).

> **Scope notice**: This application is a local operator-console milestone backed by local Docker Compose services. It does **not** include public deployment, user authentication, billing, or remote charger control commands.

## Canonical Navigation & Compatibility Routes

### Primary Destinations
- **Overview** (`/`): Authoritative full-fleet snapshot counts (`Total`, `Online`, `Offline`), calculated connectivity percentage (`N/A` on `0` registered stations), attention summary, and offline-first station preview from Station Service.
- **Charging stations** (`/stations`): Complete searchable/filterable station directory with URL-backed filter context preserved across back navigation.
- **Add station** (`/stations/new`): Opt-in local station registration workflow (read-only by default).
- **Station details** (`/stations/[stationId]`): Tabbed inspection (`Overview`, `Connectors`, `Sessions`, `Connection details`) using realistic generic charger illustrations inside simple connector cards (`EVSE` + `Connector` composite identity, last-reported offline caveats, no implied physical cabinet count, model, or power rating).
- **Charging sessions** (`/sessions`): Server-filtered (`stationId`, `transactionId`, `integrityStatus`), paginated session ledger (`page`, `size`) plus an explicitly scoped current-page active toggle (`All on page` / `Active on page`).
- **Session details** (`/stations/[stationId]/sessions/[sessionId]`): Tabbed view (`Overview`, `Measurements`, `Technical details`) preserving independent `StationLifecycle` vs. `TransactionCompleteness` separation, strict numeric `unitMultiplier` normalization, compatible stream grouping (`measurand + unit + phase + location + context`), explicit cumulative-register disclaimers (`Energy.Active.Import.Register` never labeled as delivered session total), gap-breaking charts, raw tabular data, and bounded OCPP sequence completeness audit.
- **Needs attention** (`/attention`): Independent operator triage combining offline stations (from authoritative Station Service `getStationSnapshot()`) and missing-data sessions (`networkTransactionPage(integrityStatus: INCOMPLETE)`), without fabricated global incident counts. Connector-level faults remain station-local.
- **Diagnostics** (`/diagnostics`): Asynchronous Operations Service projection viewer (`stationStatuses` cursor pagination + `stationStatus(stationId)` lookup) displaying `currentStatus`, `statusChangedAt`, `updatedAt`, and collapsible `lastEventId`. Explicitly notes asynchronous eventual consistency relative to Station Service.
- **Help** (`/help`): Static contextual troubleshooting disclosures and workflow deep links.

### Legacy Redirect Compatibility
- `/?q=...&status=...&all=...` → `/stations?...`
- `/transactions?...` (`station`, `q`, `integrity`, `page`, `size`) → `/sessions?...`
- `/stations/[stationId]/transactions/[transactionId]?section=...&returnTo=...` → `/stations/[stationId]/sessions/[sessionId]?...`
- `/operations?status=...&stationId=...&after=...` → `/diagnostics?...`

## Local Startup

Start the repository Docker Compose backend stack from the repository root, then in `apps/operator-web`:

```sh
pnpm install --frozen-lockfile
STATION_GRAPHQL_URL=http://127.0.0.1:8080/graphql OPERATIONS_GRAPHQL_URL=http://127.0.0.1:8081/graphql pnpm dev
```

For explicit local station registration demo mode:

```sh
OPERATOR_LOCAL_WRITES=true STATION_GRAPHQL_URL=http://127.0.0.1:8080/graphql OPERATIONS_GRAPHQL_URL=http://127.0.0.1:8081/graphql pnpm start
```

Registration writes require **all** of: `OPERATOR_LOCAL_WRITES=true`, loopback HTTP `STATION_GRAPHQL_URL`, and loopback `Host` / `X-Forwarded-Host` request headers. Failed or timed-out registration submissions return explicit uncertain guidance and offer a read-only verification lookup rather than automatic mutation retry.

## Verification Commands

Run all commands from `apps/operator-web` (Node 24 / >= 22.18 and `pnpm@12.4.2`):

```sh
pnpm install --frozen-lockfile
pnpm test                        # Unit & component tests (Node test runner)
pnpm lint                        # ESLint
pnpm exec tsc --noEmit           # TypeScript strict check
pnpm build                       # Reproducible Webpack production build
pnpm test:e2e                    # Full Chromium Playwright regression & UI suite
pnpm test:a11y                   # Automated @axe-core/playwright WCAG 2.2 AA audit
pnpm test:e2e:cross-browser      # Chromium + Firefox + WebKit core matrix
```

### Real Local-Stack Verification (Disposable Compose)

From the repository root:

```sh
docker compose -p voltgrid-ui110-test -f compose.yaml -f compose.operator-test.yaml up -d --build
pnpm --dir apps/operator-web test:e2e:live
docker compose -p voltgrid-ui110-test -f compose.yaml -f compose.operator-test.yaml down -v --remove-orphans
```

Exercises real Station registration, OCPP 2.0.1 WebSocket (`BootNotification`, `Authorize`, `StatusNotification` `Available`/`Faulted`, `TransactionEvent Started/Updated/Ended`, intentional `INCOMPLETE` sequence gap, WebSocket disconnect offline transition), gRPC invalid-token check, outbox/Kafka projection, `Needs attention`, `Diagnostics`, `Sessions` measurements/completeness, legacy redirects, `Help`, and navigation links.

## Known Technical Limitations

- **Malformed raw percent escapes (e.g., `/stations/%ZZ`)**: Next.js 16.3.5 App Router rejects un-decodable raw `%` escapes in dynamic URL segments with plain-text `HTTP 500 Internal Server Error` (`Content-Length: 21`, no stack trace or path disclosure) before route code executes. Properly encoded literal-percent identifiers (e.g., `/stations/%25ZZ`) decode safely once inside `decodePathIdentifier()` and resolve to HTTP 404/200 as appropriate.
- **No public WebSocket gateway hostname exposure**: Connection guidance displays `/ocpp/<stationId>` and `ocpp2.0.1` without fabricating undeclared public hostnames.
- **No cumulative session energy derivation**: `Energy.Active.Import.Register` reflects persisted meter register samples only; interval totals are never fabricated across missing sequences.
- **Pending Human Gates**: Owner visual review (G1), manual VoiceOver/NVDA walkthrough (`docs/usability-testing/screen-reader-checklist.md`, G3), and human participant usability evaluation (`docs/usability-testing/`, G7) remain open prior to merge/release sign-off.
