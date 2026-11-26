# Historical Station upgrade through V15

V15 creates `station_credentials.id` as `varchar(64)` and inserts a five-character prefix plus the existing station identifier. V16 widens the column after V15 succeeds. A database with identifiers of 60 to 255 characters needs preparation before V15 starts.

This procedure applies to the Flyway-managed Station database using the `public` schema. It needs temporary access to a PostgreSQL superuser for setup and cleanup. If the target database cannot provide that access, test backup restoration and the upgrade on a compatible maintenance instance, then arrange a separately validated migration into the target. PostgreSQL restricts event-trigger creation to superusers. [PostgreSQL event trigger documentation](https://www.postgresql.org/docs/18/sql-createeventtrigger.html)

## Preflight and backup

1. Stop Station services, relay jobs, migration workers and other writers. Keep the database offline to applications until V18 and all post-upgrade checks are complete.
2. Verify the database identity and the Station Flyway configuration. Capture the Flyway history and inventory identifiers with `SELECT char_length(id), count(*) FROM public.charging_stations GROUP BY 1 ORDER BY 1;`. Record counts and stable identifiers or hashes for stations, connectors, transactions, meter samples, receipts and outbox events.
3. Take a restorable database backup. Rehearse the procedure and restoration with an isolated copy first. Keep Operations data and its backup under the existing deployment procedure.
4. Use the same Flyway version and migration resources as Station Service. Run Flyway `info` and inspect pending versions. For databases below V14, migrate to target V14 with the application still offline. Preserve Flyway history and validation. Reserve the maintenance schema `voltgrid_v15_maintenance` and event trigger `voltgrid_widen_v15_credential_id` for this procedure. Stop if existing objects with these names cannot be attributed to a prior run.

## Upgrade

From `services/station-service`, run the preparation script using an administrator connection to the offline database. Use the existing authenticated connection configuration for `psql`.

```sh
psql -X -v ON_ERROR_STOP=1 -f maintenance/prepare-pre-v15-upgrade.sql
```

Preparation is transactional and repeatable. It checks for V14 and long identifiers before arming a database-local trigger restricted to creation of `public.station_credentials` with the historical column width. The trigger runs with the migration identity's privileges and widens the new column in the same transaction as V15. The Flyway migration role must own the tables it creates and modifies. Preparation is unnecessary on fresh installs, on V14 with only short identifiers, and after V15.

Run the matching Flyway CLI to at least V18 with the application offline. Configure its URL, user and password using your existing migration credentials. From `services/station-service`, use the canonical migration directory.

```sh
flyway -defaultSchema=public -locations=filesystem:src/main/resources/db/migration migrate
```

V16 removes the historical credential seeds. V18 quarantines stations assigned to the historical default organization. Keep automatic application startup disabled throughout this interval. After migration succeeds, remove the temporary trigger and run `flyway -defaultSchema=public -locations=filesystem:src/main/resources/db/migration validate` with the same connection configuration.

```sh
psql -X -v ON_ERROR_STOP=1 -f maintenance/remove-pre-v15-upgrade.sql
```

Compare the data inventory with the backup-side inventory. Confirm that V15–V18 succeeded, `station_credentials.id` is `varchar(300)`, the temporary event trigger is gone, historical seed credentials and synthetic memberships are absent, and default-owned legacy stations have null organization and site assignments. Enable application access only after verification.

## Failure and recovery

On failure, leave application access disabled. Check Flyway history and the database schema to identify the last committed migration. A V15 width failure in a transactional PostgreSQL migration rolls V15 back while preserving V14 and its data. If V14 remains current, correct the prerequisite and rerun preparation and Flyway migration. If V15 or later already committed, resume with the remaining migrations after investigating the error. If validation reports a checksum mismatch or failed history entry, investigate against the backup and the canonical migration files before retrying. Restore the verified backup if the schema or data cannot be reconciled. Remove the temporary trigger if abandoning the upgrade.

## Regression suite

Run from `services/station-service` against disposable Docker PostgreSQL 18.6.

```sh
./mvnw -q -Dtest=HistoricalStationMigrationTests test
```

The suite runs production Flyway migrations and the two maintenance scripts. It includes isolated V14 cases for 1, 59, 60, 128 and 255 characters, a mixed-length recovery from a transactional V15 failure, fresh installation, and restart at V15 or V18. It compares Station data and existing Flyway history, validates foreign key and uniqueness enforcement, repeats maintenance and migration, and checks that historical Station ownership and credentials remain quarantined or removed as appropriate. Operations projection replay and explicit ownership assignment require separate verification.
