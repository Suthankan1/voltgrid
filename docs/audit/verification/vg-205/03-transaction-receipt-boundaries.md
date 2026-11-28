# VG-205 transaction receipt boundaries

Base `88584e07f636666152d88b76e3098e60ca570b9a`. Tracks [#7](https://github.com/Suthankan1/voltgrid/issues/7).

The V20 integrity view counted receipts beyond a transaction's high-water mark. Extra receipts could conceal gaps, an Updated receipt could stand in for an Ended receipt, and the sequence span calculation could overflow PostgreSQL integer arithmetic. Three PostgreSQL regressions reproduced those cases before the fix.

`V23__verify_transaction_receipt_boundaries.sql` replaces the view in place and preserves its public schema. It counts unique receipts inside the start and high-water bounds, requires an Ended receipt at the high-water mark, and uses 64-bit arithmetic for the range. Missing or invalid start history stays unknown. Ongoing transactions stay in progress when they have a valid start boundary.

`TransactionCompletenessService` applies the same boundary and terminal-receipt rules. A sparse transaction stays incomplete even when the existing 10,000-item limit truncates the displayed missing sequence list. PostgreSQL integration tests check the view and Java result against the same data, including a sequence of 2,147,483,647.

Existing Flyway files and stored data are preserved. An operational database rollback would use a new forward migration to restore the prior view definition, with the known classification defects returning. All-list GraphQL bounds, wider representative query plans, database restore and application replay, and owner-approved retention remain under #7.

`mvn -o -f services/station-service/pom.xml verify` passed with 310 tests, zero failures, errors or skips. The suite used disposable PostgreSQL 18.6 and Kafka containers.
