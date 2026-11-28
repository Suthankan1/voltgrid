# VG-208 transaction event correlation

Base `88584e07f636666152d88b76e3098e60ca570b9a`. Tracks [#10](https://github.com/Suthankan1/voltgrid/issues/10), [#20](https://github.com/Suthankan1/voltgrid/issues/20), [#22](https://github.com/Suthankan1/voltgrid/issues/22), and [#23](https://github.com/Suthankan1/voltgrid/issues/23).

- `OcppMessageProcessor` validates the wire form of supplied remote start IDs before Jackson conversion. A start request without a selected EVSE omits the optional wire field.
- `StationTransactionService` invokes correlation in the first event's database transaction, after recording the receipt. Retransmissions bypass correlation. The recorded transaction supplies equipment identity for updates, including valid frames that omit `evse`.
- `StationCommandService` checks station, exact remote start ID, expected EVSE, and the response's transaction ID when present. It checks the exact station and OCPP transaction ID for a remote stop. Ambiguous historical command matches remain unresolved. An Accepted response records acknowledgement. A matching event establishes observation.
- `StationCommandJpaRepository` locks command rows during response and observation processing. Timeout, disconnect and the existing post-commit dispatch callback use conditional status updates. A matching event can still establish observation after timeout or uncertain delivery.
- [OCPP 2.0.1 Edition 4](https://openchargealliance.org/my-oca/ocpp/), Part 2 F01–F03 and Part 3 schemas, covers the cable-first Updated RemoteStart flow, the remote-start-first flow, and remote stop Updated or Ended events according to TxStopPoint. A stop observation can precede the transaction ending when the cable remains connected.

The real PostgreSQL regressions exercise early events, wrong-station and wrong-EVSE events, duplicate frames with changed correlation metadata, local stops, and cable-first start and stop updates. The first early-observation and local-stop regressions failed on the base. The sender and frames in these tests are synthetic in-process fixtures.

Outstanding acceptance includes database-enforced remote start ID allocation, tenant and connector command context, stop ownership before dispatch, AUTH-01 token-aware idempotency and revocation, durable dispatch and reconnect/restart/timeout verification across WebSocket sessions, simulator coverage beyond local frame fixtures, compatible hardware and independent review. The change introduces no database migration. Reverting the change restores the previous application behavior.

`mvn -o -f services/station-service/pom.xml verify` passed with 311 tests, zero failures, errors or skips. The suite used disposable PostgreSQL 18.6 and Kafka containers.
