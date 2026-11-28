# VG-205 Station and Authorization PostgreSQL restore

Base `88584e07f636666152d88b76e3098e60ca570b9a`. Tracks [#7](https://github.com/Suthankan1/voltgrid/issues/7) and supports recovery evidence for [#9](https://github.com/Suthankan1/voltgrid/issues/9).

Run `integration-tests/postgresql-restore/run.sh` with a locally available `postgres:18.6` Docker image. The script uses a fresh container with Docker networking disabled and no published ports. It creates separate source and destination databases for each service, applies the checked-in SQL migrations directly to the source, inserts synthetic fixtures, takes custom-format `pg_dump` backups, and performs transactional `pg_restore` operations. It removes the fixture and archives on exit. Direct SQL migration setup is separate from the application's Flyway validation.

The comparison uses ordered row exports and schema-only exports. PostgreSQL represented two restored CHECK constraints with equivalent array casts. The comparison normalizes that syntax on CHECK lines while preserving constraint names, literals and all other schema text. Both normalized schemas and both ordered data exports matched.

| Service | PostgreSQL 18.6 restored fixture | Observed time |
| --- | --- | --- |
| Station | 1,000 stations across two organizations, 1,000 transactions, 2,999 receipts, 1,000 command rows, and 500 unpublished outbox entries out of 1,000. Station organizations, receipt rows, command rows, outbox payload/state and derived integrity results matched. | 1 second |
| Authorization | 1,000 fingerprint rows. 500 ACTIVE with key version v2 and 500 BLOCKED with key version v1. All token-state rows and fingerprints matched. | Under the one-second timer resolution |

Times cover dump, restore and comparisons for the small local fixture. These are lab timings. Shell syntax validation and ShellCheck passed. The prior Operations restore remains recorded under #7.

Outstanding recovery acceptance includes application startup and authorization with restored data, Kafka replay and tenant-preserving projections from restored outbox entries, recovery on representative volumes, runtime role grants and recovery ownership.
