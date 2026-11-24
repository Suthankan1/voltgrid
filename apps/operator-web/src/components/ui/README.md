# VoltGrid UI Primitives (`src/components/ui`)

Accessible, light-first component primitives implementing the Orchid & Clay design system (`docs/redesign/design-system.md`) on top of `--vg-*` semantic CSS tokens and local `Manrope` / `IBM Plex Mono` typography.

## Design rules

- **Tokens only**: Components consume `--vg-*` custom properties defined in `src/app/design-tokens.css`.
- **Native semantics first**: Use `<button>`, `<input>`, `<select>`, and `next/link` rather than clickable `<div>` elements or custom dropdowns.
- **Target touch size**: Default `Button` (`md`), `IconButton` (`md`), `Input`, `Select`, and `MetricCard` links satisfy `44 × 44` CSS pixel touch targets (`min-h-11`). Reserve `size="sm"` for compact desktop-only secondary actions.
- **Keyboard & motion**: All interactive controls render `:focus-visible` outlines using `--vg-focus` (`#795A88`). Animations respect `prefers-reduced-motion: reduce`.
- **No unsupported backend actions**: No destructive button variants or incident-management controls are exposed.

## Component inventory and usage

### 1. Actions & surfaces

- **`Button`** (`primary | secondary | tertiary`, `sm | md | lg`)
  - Defaults to `type="button"`.
  - Pass `pending` (and optional `pendingLabel`) during async mutations or refreshes; sets `disabled`, `aria-busy="true"`, and blocks duplicate click activation.
- **`IconButton`** (`label`, `icon`, `primary | secondary | tertiary`, `sm | md | lg`)
  - Requires a non-empty `label` (`aria-label`) and wraps `icon` in `aria-hidden="true"`.
- **`Card` / `Surface`** (`variant="default | subtle"`, `padding="none | sm | md | lg"`, `as="div | section | article"`)
  - Uses `--vg-border` with `shadow-none`. Composable with `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter`. Never attach `onClick` to a card container; place `<Link>` or `<Button>` controls inside instead.

```tsx
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

<Card as="section" aria-labelledby="fleet-card">
  <CardHeader>
    <CardTitle id="fleet-card">Fleet actions</CardTitle>
  </CardHeader>
  <CardContent className="flex flex-wrap gap-3">
    <Button variant="primary">Register station</Button>
    <Button variant="secondary">Clear filters</Button>
  </CardContent>
</Card>;
```

### 2. Forms

- **`FormField`** (`label`, `htmlFor?`, `description?`, `error?`, `required?`)
  - Always renders a visible, persistent `<label>` (never rely on placeholders as labels).
  - Use the render-prop pattern `{(fieldProps) => <Input {...fieldProps} />}` so `id`, `aria-describedby`, `aria-invalid`, and `required` stay synchronized.
- **`Input`** (`invalid?`, `mono?`, native `<input>` attributes)
  - Set `mono` for technical identifiers (`stationId`, `transactionId`).
- **`Select`** (`invalid?`, `options?` or `<option>` children, native `<select>` attributes)

```tsx
import { FormField, Input, Select } from "@/components/ui";

<FormField
  label="Station identifier"
  description="Letters, numbers, dots, underscores, colons and hyphens."
  error={fieldError}
  required
>
  {(fieldProps) => <Input {...fieldProps} name="id" mono maxLength={255} />}
</FormField>;
```

### 3. Operational status indicators

Every status indicator renders both a tone-matched SVG glyph (`aria-hidden="true"`) and text—never color alone. **Keep the five operational domains strictly separated:**

| Domain | Component / Resolver | Values & Mapping |
|---|---|---|
| Station connectivity | `StationStatusIndicator` / `getStationConnectivityDisplay` | `ONLINE` → `success` ("Online"), `OFFLINE` → `neutral` ("Offline") |
| Connector status | `ConnectorStatusIndicator` / `getConnectorStatusDisplay` | `AVAILABLE` → `success` ("Available"), `OCCUPIED` → `info` ("Occupied"), `RESERVED` → `warning` ("Reserved"), `UNAVAILABLE` → `neutral` ("Unavailable"), `FAULTED` → `danger` ("Faulted") |
| Session lifecycle | `SessionLifecycleIndicator` / `getSessionLifecycleDisplay` | `ACTIVE` → `info` ("Active"), `ENDED` → `neutral` ("Ended") |
| Session completeness | `SessionCompletenessIndicator` / `getSessionCompletenessDisplay` | `IN_PROGRESS` → `info` ("In progress"), `COMPLETE` → `success` ("Complete"), `INCOMPLETE` → `warning` ("Missing data"), `UNKNOWN` → `neutral` ("Unknown") |
| Operations projection | `OperationsStatusIndicator` / `getOperationsStatusDisplay` | `ONLINE` → `success` ("Online"), `OFFLINE` → `neutral` ("Offline"), `UNAVAILABLE` → `neutral` ("Unavailable") |

Domain rules:
- `OFFLINE` connectivity is `neutral`, never proof of a physical equipment fault.
- `OCCUPIED` connector status does not establish active charging.
- `ENDED` session lifecycle does not imply `COMPLETE` data integrity.
- Equipment `UNAVAILABLE` is distinct from API/request unavailability (`ErrorState`).
- Any unrecognized runtime value resolves to `neutral` ("Unknown"), never `success`.

### 4. Feedback, loading, and metrics

- **`Alert`** (`variant="info | success | warning | error"`, `announce="none | polite | assertive"`, `title?`, `actions?`)
  - Static informational notices (`info`, `success`, `warning`) default to `announce="none"` to avoid noisy screen-reader announcements on initial load.
  - `error` defaults to `announce="assertive"` (`role="alert"`). Use `announce="polite"` (`role="status"`) for dynamic confirmations.
  - Alerts are persistent and never auto-dismiss.
- **`EmptyState`** (`title`, `description`, `kind="empty | no-matches"`, `action?`)
  - Use **only** when the API call succeeded with zero matching/registered records—never for failed requests.
- **`ErrorState`** (`title?`, `message`, `guidance?`, `onRetry?`, `retrying?`)
  - Use when an API request is unconfigured, timed out, returned HTTP/GraphQL errors, or failed validation. Display safe operator copy only—never raw exception messages or stack traces.
- **`SkeletonGroup` + `Skeleton`** (`label`, `variant="text | heading | block | circle"`)
  - `SkeletonGroup` announces `role="status"` and `aria-busy="true"` while every `Skeleton` bar is hidden via `aria-hidden="true"`.
- **`MetricCard`** (`label`, `value`, `unknownLabel="Unknown"`, `description?`, `href?`, `linkLabel?`)
  - Numeric `0` renders `"0"`; `null`, `undefined`, `NaN`, or blank values render `unknownLabel` (for example `"N/A"` when a connectivity denominator is zero).
  - Never fabricate trend arrows or global totals from partial pages.

## Choosing the right component

- Need a user-triggered action? Use `Button` (or `IconButton` with `label`). Need navigation? Use `next/link` (or `MetricCard` with `href`).
- Request failed or timed out? Use `ErrorState` (page/section recovery) or `Alert variant="error"` (inline form failure).
- Request succeeded with zero items? Use `EmptyState` (`kind="empty"` vs `kind="no-matches"`).
- Content loading? Wrap `Skeleton` placeholders in `SkeletonGroup`.
