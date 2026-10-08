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

Tests require Node 22.18+ for native TypeScript stripping. If Turbopack cannot bind its worker port in a restricted environment, use `pnpm exec next build --webpack`. The existing font setup downloads Google Fonts during a build and requires network access.

## Browser regression tests

After a production build, run `pnpm exec playwright install chromium` and `pnpm test:e2e`. These tests start the production console and an isolated GraphQL fixture on loopback ports 4310/4311. They cover station navigation, transaction inspection and lifecycle filtering, Operations pagination/errors, and missing-record 404s. Fixtures test frontend behavior; they do not prove the real Kafka/OCPP path.
