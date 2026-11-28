#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
scratch=$(mktemp -d "${TMPDIR:-/tmp}/voltgrid-restore.XXXXXX")
container="voltgrid-restore-${scratch##*.}"
umask 077

cleanup() {
    docker rm --force "$container" >/dev/null 2>&1 || true
    rm -rf "$scratch"
}
trap cleanup EXIT

docker run --detach --pull never --network none --name "$container" \
    --env POSTGRES_HOST_AUTH_METHOD=trust postgres:18.6 >/dev/null

psql_db() {
    local database=$1
    shift
    docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1 -d "$database" "$@"
}

ready=false
for _ in {1..30}; do
    if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then
        ready=true
        break
    fi
    sleep 1
done
if [[ "$ready" != true ]]; then
    docker logs "$container" >&2
    exit 1
fi

psql_db postgres -Atc 'SHOW server_version'
for service in station authorization; do
    psql_db postgres -q -c "CREATE DATABASE ${service}_source"
    psql_db postgres -q -c "CREATE DATABASE ${service}_restored"
    while IFS= read -r migration; do
        psql_db "${service}_source" -q < "$migration"
    done < <(find "$repo_root/services/$service-service/src/main/resources/db/migration" \
        -maxdepth 1 -name 'V*.sql' | sort -V)
done

psql_db station_source -q <<'SQL'
INSERT INTO organizations (id, name) VALUES ('restore-org-a', 'Fixture A'), ('restore-org-b', 'Fixture B');
INSERT INTO charging_stations (id, name, status, organization_id)
SELECT 'fixture-station-' || n, 'Fixture Station ' || n, 'ONLINE',
       CASE WHEN n % 2 = 0 THEN 'restore-org-a' ELSE 'restore-org-b' END
FROM generate_series(1, 1000) AS n;
INSERT INTO charging_transactions (station_id, transaction_id, evse_id, connector_id, status, started_at, ended_at, last_sequence_number)
SELECT id, 'fixture-transaction', 1, 1, 'ENDED', TIMESTAMPTZ '2026-01-01 00:00:00Z',
       TIMESTAMPTZ '2026-01-01 00:10:00Z', 2
FROM charging_stations WHERE id LIKE 'fixture-station-%';
INSERT INTO transaction_event_receipts (station_id, transaction_id, sequence_number, event_type)
SELECT station_id, transaction_id, sequence_number, event_type
FROM charging_transactions
CROSS JOIN (VALUES (0, 'STARTED'), (1, 'UPDATED'), (2, 'ENDED')) AS events(sequence_number, event_type)
WHERE transaction_id = 'fixture-transaction' AND (sequence_number <> 1 OR station_id <> 'fixture-station-1');
INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, occurred_at, created_at, published_at)
SELECT gen_random_uuid(), 'Station', id, 'StationStatusChanged',
       jsonb_build_object('stationId', id, 'organizationId', organization_id),
       TIMESTAMPTZ '2026-01-01 00:10:00Z', TIMESTAMPTZ '2026-01-01 00:10:00Z',
       CASE WHEN organization_id = 'restore-org-b' THEN TIMESTAMPTZ '2026-01-01 00:11:00Z' END
FROM charging_stations WHERE id LIKE 'fixture-station-%';
INSERT INTO station_commands (id, station_id, message_id, action, status, transaction_id, requested_at, expires_at)
SELECT gen_random_uuid(), id, 'restored-stop', 'RequestStopTransaction', 'OBSERVED', 'fixture-transaction',
       TIMESTAMPTZ '2026-01-01 00:10:00Z', TIMESTAMPTZ '2026-01-01 00:10:30Z'
FROM charging_stations WHERE id LIKE 'fixture-station-%';
SQL

psql_db authorization_source -q <<'SQL'
INSERT INTO authorization_tokens (id, token_fingerprint, status, expires_at, created_at, updated_at, key_version)
SELECT gen_random_uuid(), encode(sha256(convert_to('synthetic-restore-fixture-' || n, 'UTF8')), 'hex'),
       CASE WHEN n % 2 = 0 THEN 'ACTIVE' ELSE 'BLOCKED' END,
       TIMESTAMPTZ '2027-01-01 00:00:00Z', TIMESTAMPTZ '2026-01-01 00:00:00Z',
       TIMESTAMPTZ '2026-01-01 00:00:00Z', CASE WHEN n % 2 = 0 THEN 'v2' ELSE 'v1' END
FROM generate_series(1, 1000) AS n;
SQL

for service in station authorization; do
    started=$SECONDS
    docker exec "$container" pg_dump -U postgres --format=custom "${service}_source" > "$scratch/$service.dump"
    docker exec -i "$container" pg_restore -U postgres --exit-on-error --single-transaction \
        --dbname="${service}_restored" < "$scratch/$service.dump"

    for variant in source restored; do
        docker exec "$container" pg_dump -U postgres --schema-only --restrict-key=VoltGridRestore \
            "${service}_${variant}" |
            # PostgreSQL can deparse an array-wide text cast as equivalent element-wise casts after restore.
            sed -E "/CHECK/ { s/\(\(ARRAY\[(.*)\]\)::text\[\]\)/(ARRAY[\1])/g; s/\(('([^']*)'::character varying)\)::text/\1/g; }" \
                > "$scratch/$service-$variant-schema.sql"
        if [[ "$service" == station ]]; then
            psql_db "station_${variant}" -At > "$scratch/$service-$variant-data.txt" <<'SQL'
SELECT row_to_json(row) FROM organizations AS row ORDER BY id;
SELECT row_to_json(row) FROM charging_stations AS row ORDER BY id;
SELECT row_to_json(row) FROM charging_transactions AS row ORDER BY station_id, transaction_id;
SELECT row_to_json(row) FROM transaction_event_receipts AS row ORDER BY station_id, transaction_id, sequence_number;
SELECT row_to_json(row) FROM station_commands AS row ORDER BY id;
SELECT row_to_json(row) FROM outbox_events AS row ORDER BY aggregate_id, id;
SELECT row_to_json(row) FROM transaction_integrity_status AS row ORDER BY station_id, transaction_id;
SQL
        else
            psql_db "authorization_${variant}" -Atc 'SELECT row_to_json(row) FROM authorization_tokens AS row ORDER BY id' \
                > "$scratch/$service-$variant-data.txt"
        fi
    done
    diff -u "$scratch/$service-source-schema.sql" "$scratch/$service-restored-schema.sql"
    cmp "$scratch/$service-source-data.txt" "$scratch/$service-restored-data.txt"
    printf '%s schema and ordered data matched after dump/restore (%s s)\n' "$service" "$((SECONDS - started))"
done

printf 'Station rows (stations, transactions, receipts, commands, pending outbox)\n'
psql_db station_restored -Atc 'SELECT (SELECT count(*) FROM charging_stations),
    (SELECT count(*) FROM charging_transactions), (SELECT count(*) FROM transaction_event_receipts),
    (SELECT count(*) FROM station_commands), (SELECT count(*) FROM outbox_events WHERE published_at IS NULL)'
printf 'Authorization records by status and fingerprint key version\n'
psql_db authorization_restored -Atc 'SELECT status, key_version, count(*) FROM authorization_tokens
    GROUP BY status, key_version ORDER BY status, key_version'
