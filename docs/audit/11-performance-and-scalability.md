# 11 — Performance and Scalability Review

> **Audit**: VG-200 · **Commit**: `e6bf891` · **Date**: 2026-11-26

## Overview

A distributed EV Charging Station Management System must process continuous telemetry (meter samples, periodic heartbeats, status notifications) while serving responsive operator queries. This review evaluated the runtime performance, scalability ceilings, and resource utilization patterns across the VoltGrid stack.

---

## 1. Unbounded Queries & Memory Saturation (BUG-005)

### GraphQL Query Analysis
In `services/station-service/src/main/resources/graphql/station.graphqls` and controller mappings:
```graphql
type Query {
    stations: [ChargingStation!]!
    transactions: [ChargingTransaction!]!
    stationTransactions(stationId: ID!): [ChargingTransaction!]!
    transactionMeterSamples(stationId: ID!, transactionId: ID!): [TransactionMeterSample!]!
    networkTransactions: [NetworkTransaction!]!
}
```

### Impact & Scalability Ceilings
1. **Unbounded `stations`**:
   - `StationQueryService.findAll()` executes `SELECT * FROM charging_stations`.
   - In a production network with 10,000 charging stations, a single call serializes all 10,000 entities into JSON, allocating tens of megabytes per request.
2. **Unbounded `transactions` / `networkTransactions`**:
   - Executes `SELECT * FROM charging_transactions`. Over time, a network generates millions of transactions. Calling this query will crash the JVM via `OutOfMemoryError`.
3. **Unbounded `transactionMeterSamples`**:
   - Fast chargers push meter values every 10–30 seconds. A 4-hour DC fast charge produces 480–1,440 samples. Without pagination or downsampling, long sessions saturate both database I/O and HTTP response buffers.
4. **Only One Query is Paginated**:
   - Only `networkTransactionPage(page: Int!, size: Int!, ...): NetworkTransactionPage!` supports pagination. All other list queries are vulnerable to query amplification denial-of-service.

---

## 2. Integer Overflow CPU Lockup in Completeness Calculation (BUG-001)

### Algorithmic Vulnerability
In `TransactionCompletenessService.java`:
```java
public List<Integer> findMissingSequenceNumbers(int lastSequenceNumber, Set<Integer> received) {
    List<Integer> missing = new ArrayList<>();
    for (int sequenceNumber = 0; sequenceNumber <= lastSequenceNumber; sequenceNumber++) {
        if (!received.contains(sequenceNumber)) {
            missing.add(sequenceNumber);
        }
    }
    return missing;
}
```
- **Complexity**: $O(N)$ time and space, where $N = \text{lastSequenceNumber}$.
- If an OCPP client sends `seqNo = 2,147,483,647` (`Integer.MAX_VALUE`), the loop condition `sequenceNumber <= Integer.MAX_VALUE` is **always true**. The loop will never terminate because `sequenceNumber++` wraps around to `Integer.MIN_VALUE` (-2,147,483,648), consuming 100% of a CPU core indefinitely until an OutOfMemoryError occurs as `missing.add()` exhausts the heap.

---

## 3. Database Connection Pool & Thread Contention

### HikariCP Configuration
- Neither `station-service`, `authorization-service`, nor `operations-service` configures explicit connection pool parameters in `application.properties`.
- Defaults apply:
  - `maximumPoolSize = 10`
  - `minimumIdle = 10`
  - `connectionTimeout = 30000ms`
- **Contention Scenario**:
  - `station-service` handles incoming WebSocket frames, scheduled liveness checks, outbox relay polling, and incoming operator GraphQL queries concurrently on the same 10-connection pool.
  - A single unbounded query (e.g. `stations` or `v_transaction_data_integrity`) holding a database connection for several seconds easily starves the WebSocket message processor, triggering message processing timeouts and false station disconnects.

---

## 4. Outbox Throughput & Ingestion Capacity

### Polling Characteristics
In `application.properties`:
```properties
voltgrid.kafka.outbox.poll-delay-ms=1000
voltgrid.kafka.outbox.max-events-per-poll=25
```
- Maximum throughput ceiling = $\frac{25 \text{ events}}{1.0 \text{ s}} = 25 \text{ events/sec}$ per relay instance.
- **Scalability Limit**: During fleet-wide state changes (e.g. grid power restoration after an outage, where 500 stations reconnect and send status events simultaneously), an outbox backlog of 500 events will take 20 seconds to drain.
- **Recommendation**:
  - Transition from fixed 1000ms polling to an adaptive backoff with PostgreSQL `LISTEN/NOTIFY` or reactive batching.
  - Increase batch size dynamically when backlog is detected.

---

## 5. Caching & Query Optimization

| Domain | Current Implementation | Opportunity |
|---|---|---|
| Station metadata & status | DB query on every frame | Caffeine in-memory L1 cache with invalidation |
| Authorization token lookup | DB query on every `Authorize` request | Redis / Caffeine cache with 5-minute TTL |
| Connector status | Direct DB read/write | Write-through cache for real-time dashboards |
| Static GraphQL schema | Re-parsed per boot | Pre-compiled schema (Spring GraphQL default) |
