# VoltGrid Operator Console

The existing console reads station registration, connector and transaction data from Station Service. `/operations` reads the asynchronous Operations Service projection with cursor pagination. Projection rows can lag station changes; page counts are not network totals.

## Local use

Start the repository Docker Compose stack, then in this directory:

```sh
pnpm install --frozen-lockfile
STATION_GRAPHQL_URL=http://localhost:8080/graphql OPERATIONS_GRAPHQL_URL=http://localhost:8081/graphql pnpm dev
```

Open http://localhost:3000 and follow “View Operations status”. Endpoints are server-side environment variables. Missing configuration or API failure displays an unavailable state. This console is a local demo; restrict access to the services and console before any shared deployment.

## Verification

```sh
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Tests require Node 22.18+ for native TypeScript stripping. The default build uses Webpack for reproducibility in restricted environments. System fonts remove build-time font downloads.

## Browser regression tests

After a production build, run `pnpm exec playwright install chromium` and `pnpm test:e2e`. These tests start the production console and an isolated GraphQL fixture on loopback ports 4310/4311. They cover station navigation, transaction inspection and lifecycle filtering, Operations pagination/errors, and missing-record 404s. Fixtures test frontend behavior; they do not prove the real Kafka/OCPP path.

## Real local-stack browser test

Start a dedicated stack from the repository root (Docker Compose must support `!override`):

```sh
docker compose -p voltgrid-operator-test -f compose.yaml -f compose.operator-test.yaml up -d --build --wait
```

Then run `pnpm test:e2e:live` in this directory. The override exposes only Station on loopback port 18080 and Operations on 18081; Kafka and all three databases remain internal. It starts the console on port 4312, registers a unique station and transaction, and sends OCPP messages. Run only against disposable test data; remove the dedicated stack/volumes after the run.

The live scenario verifies BootNotification, gRPC rejection of an unknown token, the outbox/Kafka projection, connector state, a complete transaction, ledger rendering and projection-to-station navigation. It does not exercise paid cloud resources.

Remove the test data from the repository root when finished:

```sh
docker compose -p voltgrid-operator-test -f compose.yaml -f compose.operator-test.yaml down --volumes
```

## Fleet search and local registration

Search by station name or identifier and filter connectivity from the network page. Network totals retain their meaning while the fleet shows the matching record count.

Registration is read-only by default. To explicitly enable it for a local demo, set `OPERATOR_LOCAL_WRITES=true` alongside a loopback HTTP `STATION_GRAPHQL_URL`. The action checks this setting and local request/backend hosts on every submission. Default dev/start commands bind to loopback. This gate is not shared-environment user authentication; keep writes disabled outside the local demo. No remote charging commands, token administration or destructive mutations are exposed.

The form enforces identifier/name limits, starts a station offline, redirects to its detail view and handles duplicate identifiers. After a network interruption, inspect the fleet before retrying because the backend may have committed the registration.
