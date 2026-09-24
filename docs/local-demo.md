# VoltGrid Local Demo

This runbook demonstrates VoltGrid locally through the real service boundaries:

```text
OCPP Charging Station
        |
        | WebSocket / OCPP 2.0.1
        v
Station Service :8080
        |
        +---- gRPC ----> Authorization Service :9090
        |
        +---- transactional outbox
                    |
                    v
                  Kafka
                    |
                    v
            Operations Service :8081
                    |
                    v
             GraphQL read model
```

## 1. Start VoltGrid

From the repository root:

```bash
docker compose up -d --build
```

Check the stack:

```bash
docker compose ps -a
```

Expected application ports:

```text
Station Service        8080
Operations Service     8081
Authorization Service  9090
Kafka                   9092
```

`kafka-init` should exit successfully with status `0`.

## 2. Check service health

Station Service:

```bash
curl -s http://localhost:8080/actuator/health/readiness | jq .
```

Operations Service:

```bash
curl -s http://localhost:8081/actuator/health/readiness | jq .
```

Authorization Service:

```bash
docker compose exec authorization-service \
  /usr/local/bin/grpc_health_probe \
  -addr=127.0.0.1:9090
```

Expected results:

```text
Station:       UP
Operations:    UP
Authorization: SERVING
```

## 3. Seed a demo charging station

```bash
docker compose exec -T postgres \
  psql -U voltgrid -d voltgrid_station <<'SQL'
INSERT INTO charging_stations (
    id,
    name,
    status,
    last_seen_at
)
VALUES (
    'STATION-LOCAL-DEMO-001',
    'VoltGrid Local Demo Station',
    'OFFLINE',
    NULL
)
ON CONFLICT (id)
DO UPDATE SET
    name = EXCLUDED.name,
    status = 'OFFLINE',
    last_seen_at = NULL;

DELETE FROM outbox_events
WHERE aggregate_id = 'STATION-LOCAL-DEMO-001';
SQL
```

## 4. Seed an ACTIVE authorization token

Generate the HMAC-SHA256 fingerprint:

```bash
TOKEN_FINGERPRINT=$(
  printf '%s' 'ACTIVE-RFID' |
  openssl dgst -sha256 \
    -hmac 'voltgrid-local-development-hmac-key-change-me' |
  awk '{print $2}'
)
```

Seed Authorization Service:

```bash
docker compose exec -T authorization-postgres \
  psql -U voltgrid -d voltgrid_authorization \
  -v fingerprint="$TOKEN_FINGERPRINT" <<'SQL'
INSERT INTO authorization_tokens (
    id,
    token_fingerprint,
    status,
    expires_at,
    created_at,
    updated_at
)
VALUES (
    gen_random_uuid(),
    :'fingerprint',
    'ACTIVE',
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (token_fingerprint)
DO UPDATE SET
    status = 'ACTIVE',
    expires_at = NULL,
    updated_at = CURRENT_TIMESTAMP;
SQL
```

## 5. Connect a charging station

Open an OCPP 2.0.1 WebSocket:

```bash
npx wscat \
  -c ws://localhost:8080/ocpp/STATION-LOCAL-DEMO-001 \
  -s ocpp2.0.1
```

Keep this WebSocket open during the next steps.

## 6. Send BootNotification

Inside `wscat`:

```json
[2,"boot-demo-001","BootNotification",{"reason":"PowerUp","chargingStation":{"model":"VoltGrid Demo","vendorName":"VoltGrid"}}]
```

Expected response:

```json
[3,"boot-demo-001",{"currentTime":"...","interval":300,"status":"Accepted"}]
```

This changes the station from `OFFLINE` to `ONLINE`.

Station Service persists the state transition and a `StationStatusChanged` event in the same database transaction.

The outbox relay then publishes that event to Kafka.

## 7. Test Authorization Service

Unknown token:

```json
[2,"auth-demo-unknown","Authorize",{"idToken":{"idToken":"UNKNOWN-RFID","type":"ISO14443"}}]
```

Expected:

```json
[3,"auth-demo-unknown",{"idTokenInfo":{"status":"Invalid"}}]
```

ACTIVE token:

```json
[2,"auth-demo-active","Authorize",{"idToken":{"idToken":"ACTIVE-RFID","type":"ISO14443"}}]
```

Expected:

```json
[3,"auth-demo-active",{"idTokenInfo":{"status":"Accepted"}}]
```

This demonstrates:

```text
OCPP
  → Station Service
  → gRPC
  → Authorization Service
  → authorization decision
  → OCPP response
```

## 8. Verify transactional outbox publication

While the WebSocket is still connected:

```bash
docker compose exec -T postgres \
  psql -U voltgrid -d voltgrid_station -c "
SELECT
    aggregate_id,
    event_type,
    payload,
    published_at
FROM outbox_events
WHERE aggregate_id = 'STATION-LOCAL-DEMO-001'
ORDER BY created_at DESC;
"
```

The `OFFLINE → ONLINE` event should have a non-null `published_at`.

## 9. Verify Operations projection

Query Operations Service through GraphQL:

```bash
curl -s http://localhost:8081/graphql \
  -H 'Content-Type: application/json' \
  --data '{
    "query": "query { stationStatus(stationId: \"STATION-LOCAL-DEMO-001\") { stationId currentStatus lastEventId statusChangedAt updatedAt } }"
  }' | jq .
```

Expected state while the WebSocket remains connected:

```json
{
  "data": {
    "stationStatus": {
      "stationId": "STATION-LOCAL-DEMO-001",
      "currentStatus": "ONLINE"
    }
  }
}
```

This demonstrates:

```text
Station Service
  → transactional outbox
  → Kafka
  → Operations Service
  → PostgreSQL projection
  → GraphQL
```

## 10. Demonstrate disconnect handling

Close `wscat` with:

```text
Ctrl+C
```

The Station Service marks the station `OFFLINE`, writes another `StationStatusChanged` event, and publishes it through Kafka.

Query Operations GraphQL again:

```bash
curl -s http://localhost:8081/graphql \
  -H 'Content-Type: application/json' \
  --data '{
    "query": "query { stationStatus(stationId: \"STATION-LOCAL-DEMO-001\") { stationId currentStatus lastEventId statusChangedAt updatedAt } }"
  }' | jq .
```

Expected final state:

```text
OFFLINE
```

## 11. Stop VoltGrid

Stop containers while preserving local database volumes:

```bash
docker compose down
```

To completely reset local state:

```bash
docker compose down -v
```