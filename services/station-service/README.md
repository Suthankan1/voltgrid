# Station Service

The Station Service is VoltGrid's OCPP-facing service.

It manages charging-station connectivity and the operational transaction data received directly from charging stations.

## Responsibilities

The Station Service currently owns:

* charging-station registration
* OCPP 2.0.1 WebSocket connections
* BootNotification handling
* Heartbeat handling
* station connectivity and liveness
* connector status received through StatusNotification
* TransactionEvent Started, Updated, and Ended processing
* transaction state persistence
* transaction meter-sample persistence
* transaction-event receipt tracking
* retransmission and idempotency handling
* late and out-of-order transaction-event recovery
* transaction completeness calculation
* GraphQL read access for station, connector, transaction, meter, and completeness data

## Service Boundary

The Station Service owns data that represents what the charging station itself has reported.

It does not own:

* authorization policies
* driver or account identity
* charging tariffs
* pricing calculations
* billing or payments
* long-term charging-session business workflows
* cross-service event processing

Those responsibilities belong to separate VoltGrid services.

## Current Communication

### Charging station → Station Service

OCPP 2.0.1 messages are received over WebSocket.

Endpoint:

```text
ws://localhost:8080/ocpp/{stationId}
```

Required WebSocket subprotocol:

```text
ocpp2.0.1
```

Implemented OCPP actions:

* BootNotification
* Heartbeat
* StatusNotification
* TransactionEvent

Unsupported actions currently return an OCPP `NotImplemented` CALLERROR.

## Transaction Processing

Transactions are identified by:

```text
(stationId, transactionId)
```

The service persists:

* transaction lifecycle state
* highest observed sequence number
* transaction-event receipts
* meter samples

Transaction-event receipts provide the durable basis for:

* retransmission detection
* conflicting sequence detection
* missing-event detection
* late-event recovery

OCPP transaction events are not assumed to arrive strictly in sequence.

For example:

```text
0 STARTED
1 UPDATED
3 UPDATED
4 ENDED
2 UPDATED
```

The late sequence `2` is accepted if it has not previously been received.

The transaction remains:

```text
status = ENDED
lastSequenceNumber = 4
```

while the missing event and its meter data are persisted.

## Concurrency

Updates to existing transactions are serialized using PostgreSQL row-level pessimistic locking.

This prevents concurrent OCPP messages from causing transaction state to move backwards or lose a newer sequence number.

Transaction creation uses the database uniqueness boundary with:

```sql
INSERT ... ON CONFLICT DO NOTHING
```

This allows simultaneous identical Started events to behave idempotently.

The concurrency behavior is verified against real PostgreSQL using Testcontainers.

## Transaction Completeness

The service exposes transaction completeness as:

* `IN_PROGRESS`
* `COMPLETE`
* `INCOMPLETE`
* `UNKNOWN`

An ended transaction is `COMPLETE` when all transaction-event sequence numbers from the first Started event through the highest observed sequence number have receipts.

Example:

```text
receipts = 0, 1, 3, 4
status   = INCOMPLETE
missing  = [2]
```

After sequence `2` arrives:

```text
receipts = 0, 1, 2, 3, 4
status   = COMPLETE
missing  = []
```

## GraphQL

GraphQL is available through:

```text
POST /graphql
```

The current read model includes:

* stations
* station
* stationConnectors
* stationTransactions
* transaction
* transactionMeterSamples
* transactionCompleteness

## Persistence

The service uses:

* PostgreSQL
* Spring Data JPA / Hibernate
* Flyway

Database migrations are immutable after they have been applied.

Current transaction-related persistence includes:

* `charging_transactions`
* `transaction_meter_samples`
* `transaction_event_receipts`

## Testing

The Station Service includes:

* unit tests for application behavior
* JPA persistence tests
* OCPP message-processing tests
* PostgreSQL/Testcontainers integration tests
* real concurrency tests
* full transaction lifecycle integration testing

The lifecycle integration test verifies:

```text
Started
→ Updated
→ skipped sequence
→ later Updated
→ Ended
→ INCOMPLETE
→ late missing Updated
→ COMPLETE
```

while ensuring the transaction remains ended and its highest sequence number does not regress.

## Local Development

From the repository root, start PostgreSQL with:

```bash
docker compose \
  -f infrastructure/local/postgres/compose.yaml \
  up -d
```

Run the service tests with:

```bash
cd services/station-service
./mvnw test
```

Testcontainers-based tests require Docker to be running.

## Configuration

Database configuration can be overridden with:

```text
STATION_DB_URL
STATION_DB_USER
STATION_DB_PASSWORD
```

JPA Open Session in View is explicitly disabled:

```properties
spring.jpa.open-in-view=false
```

Application services define transactional boundaries instead of allowing persistence access to leak into API rendering.

## Next Service Boundary

The next VoltGrid service is the Authorization Service.

The intended synchronous flow is:

```text
Charging Station
       |
       | OCPP Authorize
       v
Station Service
       |
       | gRPC / Protocol Buffers
       v
Authorization Service
       |
       | authorization decision
       v
Station Service
       |
       | OCPP AuthorizeResponse
       v
Charging Station
```

The Station Service will remain responsible for the OCPP protocol boundary.

The Authorization Service will own authorization rules and decisions.

This introduces VoltGrid's first synchronous service-to-service communication using gRPC and Protocol Buffers.
