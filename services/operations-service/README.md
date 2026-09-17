# VoltGrid Operations Service

Operations Service maintains query-oriented operational projections derived from VoltGrid domain events.

Its first projection is the latest known operational status of each charging station.

## Responsibilities

Operations Service currently:

* consumes `StationStatusChanged` events from Kafka;
* validates and parses the consumer-owned event contract;
* maintains the latest station-status projection in PostgreSQL;
* processes Kafka events idempotently using durable processed-event receipts;
* ignores stale station-status events without corrupting the latest projection;
* handles concurrent duplicate deliveries safely;
* retries transient processing failures with bounded retries;
* sends permanently invalid or exhausted records to a dead-letter topic;
* exposes station-status projections through GraphQL;
* supports cursor/keyset pagination;
* supports filtering by operational status;
* exposes liveness and readiness probes.

## Architecture

```text
Station Service
     |
     | transactional outbox
     v
Kafka
voltgrid.station-status-changed.v1
     |
     v
Operations Service
     |
     +--> StationStatusChangedConsumer
     |
     +--> StationStatusChangedEventParser
     |
     +--> ProjectingStationStatusChangedHandler
            |
            +--> processed_event_receipts
            |
            +--> station_status_projections
                     |
                     v
                  GraphQL
```

The processed-event receipt and projection mutation are persisted in the same PostgreSQL transaction.

This provides an exactly-once effect for duplicate event delivery while Kafka itself remains at-least-once.

## Technology

* Java 25
* Spring Boot 4.1.1
* Spring Kafka
* Spring Data JPA
* Spring GraphQL
* PostgreSQL 18
* Flyway
* Testcontainers
* Maven

## Kafka

### Source topic

```text
voltgrid.station-status-changed.v1
```

### Dead-letter topic

```text
voltgrid.station-status-changed.v1.dlt
```

### Consumer group

Default:

```text
operations-service
```

Override with:

```text
KAFKA_CONSUMER_GROUP
```

### Delivery semantics

Kafka auto-commit is disabled.

The listener uses record acknowledgment:

```properties
spring.kafka.consumer.enable-auto-commit=false
spring.kafka.listener.ack-mode=record
```

Processing is therefore handled record by record.

Duplicate delivery is expected and is handled through the durable `processed_event_receipts` table.

## Retry and dead-letter policy

Malformed station-status events are considered permanent failures and are sent directly to the dead-letter topic.

Other processing failures use bounded retry.

Default configuration:

```properties
voltgrid.kafka.consumer.retry-backoff-ms=500
voltgrid.kafka.consumer.max-retries=2
```

This gives:

```text
initial attempt
+ retry 1
+ retry 2
= 3 total attempts
```

After retries are exhausted, the record is published to:

```text
voltgrid.station-status-changed.v1.dlt
```

## PostgreSQL

Default local configuration:

```text
Database: voltgrid_operations
Host: localhost
Port: 5436
User: voltgrid
Password: voltgrid_dev
```

Environment overrides:

```text
OPERATIONS_DB_URL
OPERATIONS_DB_USER
OPERATIONS_DB_PASSWORD
```

### station_status_projections

Stores the latest known operational state for each station.

Important fields:

```text
station_id
current_status
last_event_id
status_changed_at
updated_at
```

Projection updates only apply when an event has a strictly newer `occurredAt` value than the currently stored projection.

### processed_event_receipts

Stores successfully accepted event IDs.

Important fields:

```text
event_id
event_type
processed_at
```

`event_id` is the primary key and forms the database-level duplicate-processing boundary.

The consumer uses PostgreSQL:

```sql
INSERT ... ON CONFLICT DO NOTHING
```

instead of an `exists`-then-insert sequence, avoiding concurrency races.

## GraphQL API

Default HTTP endpoint:

```text
POST /graphql
```

### Fetch one station

```graphql
query {
  stationStatus(stationId: "STATION-001") {
    stationId
    currentStatus
    lastEventId
    statusChangedAt
    updatedAt
  }
}
```

A station that does not exist returns:

```json
{
  "data": {
    "stationStatus": null
  }
}
```

### List stations

```graphql
query {
  stationStatuses(first: 20) {
    edges {
      cursor
      node {
        stationId
        currentStatus
        lastEventId
        statusChangedAt
        updatedAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

Pagination uses keyset/cursor scrolling ordered by `stationId`.

The maximum page size is:

```text
100
```

### Filter by operational status

Supported values:

```text
ONLINE
OFFLINE
UNAVAILABLE
```

Example:

```graphql
query {
  stationStatuses(
    first: 20
    status: ONLINE
  ) {
    edges {
      node {
        stationId
        currentStatus
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

Filtering and cursor pagination can be used together.

## GraphQL validation errors

Invalid page sizes return a stable GraphQL client error.

Example:

```graphql
query {
  stationStatuses(first: 101) {
    edges {
      node {
        stationId
      }
    }
  }
}
```

The error is classified as a bad request and contains:

```json
{
  "extensions": {
    "code": "INVALID_PAGE_SIZE"
  }
}
```

## Health probes

Operations Service exposes health probes on the main application HTTP port.

### Liveness

```text
GET /livez
```

Liveness answers whether the application itself is alive.

It intentionally does not depend on external Kafka availability.

### Readiness

```text
GET /readyz
```

Readiness includes PostgreSQL availability because the GraphQL read API depends on the projection database.

Standard Actuator health endpoints are also available under:

```text
/actuator/health
```

## Local infrastructure

Start the VoltGrid local infrastructure from the repository root:

```bash
docker compose \
  -f infrastructure/local/postgres/compose.yaml \
  up -d
```

Operations Service expects:

```text
PostgreSQL: localhost:5436
Kafka:      localhost:9092
```

Kafka topics are infrastructure-owned.

The production application does not create Kafka topics during startup.

## Running

From:

```text
services/operations-service
```

run:

```bash
./mvnw spring-boot:run
```

## Testing

Run the complete service test suite:

```bash
./mvnw \
  --batch-mode \
  --no-transfer-progress \
  clean test
```

The integration suite uses real PostgreSQL and Kafka Testcontainers for critical persistence, concurrency, idempotency, retry, dead-letter, GraphQL, and health-probe behavior.

## Reliability properties

The current implementation verifies:

```text
Kafka at-least-once delivery
        +
durable event-id receipts
        +
atomic receipt/projection transaction
        +
PostgreSQL duplicate boundary
        =
exactly-once projection effect
```

It also verifies:

```text
concurrent duplicate delivery
malformed-event dead lettering
bounded processing retries
partition recovery after poison events
transaction rollback
stale-event protection
record-level offset acknowledgment
```

## Current scope

Operations Service currently owns only the station operational-status read model.

Additional projections should be introduced only when another VoltGrid use case requires them rather than expanding this service speculatively.
