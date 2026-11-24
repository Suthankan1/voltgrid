# Information architecture (UX-001.4)

## Sitemap and canonical routes
| ID | Destination | Route | Parent |
|---|---|---|---|
| UI-002 | Overview | / | Workspace |
| UI-003 | Charging stations | /stations | Workspace |
| UI-005 | Add station | /stations/new | Stations |
| UI-004 | Station details | /stations/[stationId] | Stations |
| UI-006 | Charging sessions | /sessions | Workspace |
| UI-007 | Session details | /stations/[stationId]/sessions/[sessionId] | Sessions (logical parent) |
| UI-008 | Needs attention | /attention | Workspace |
| UI-009 | Diagnostics | /diagnostics | Support |
| UI-010 | Help | /help | Support |

UI-001 is shared shell. Sidebar workspace order: Overview, Charging stations, Charging sessions, Needs attention. Support: Diagnostics, Help. No service-boundary navigation. Record/form routes are contextual, not sidebar entries. Session identity is composite (stationId, transactionId); sessionId is UI route terminology, not a changed backend identifier.

## Contextual navigation
Overview metric → filtered stations; attention → affected station/session; station → connectors, sessions, connection details; session → associated station; diagnostics → station; contextual help → relevant guidance. Station tabs: Overview (default), Connectors, Sessions, Connection details. Session tabs: Overview (default), Measurements, Technical details. Use URL-backed tab state; browser back/forward must work.

Breadcrumbs: Stations / station name; Stations / Add station; Charging sessions / session ID. Session details include an explicit station link. Preserve originating list context on back navigation; do not accept arbitrary external return URLs.

## URL and route migration
Retain / and existing station routes. Redirect /transactions → /sessions, /operations → /diagnostics, /stations/[stationId]/transactions/[transactionId] → canonical session route. Preserve validated supported filters and pagination, discard unsupported parameters; avoid double decoding and open redirects. Retain identifier helpers and test malformed/encoded IDs, reserved characters and static /new route. Define exact query names against existing parser during UI-102/107; do not silently change meanings. Search/filter changes reset relevant pagination; cursor resets when Operations status changes. Invalid filters normalize safely.

## Responsive navigation
≥1280px expanded 240px sidebar; 768–1279px compact 72px sidebar with accessible labels/tooltips and expansion; <768px drawer with focus return, Escape and scroll lock. Top bar 64px, breadcrumbs and contextual refresh. Mobile retains all six destinations; no hover-dependent interactions. Avoid mandatory tour or unsupported profile/settings controls.
