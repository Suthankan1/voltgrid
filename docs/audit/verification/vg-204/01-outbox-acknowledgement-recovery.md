# VG-204 outbox acknowledgement recovery

On 2026-11-27, the acknowledgement/persistence slice was verified from main `05dfe6b0e111f2d35e983b99ffd43ff7c679eb68` on `remediation/vg-204-outbox-ack-recovery`.

The relay applies the broker-send failure budget only around the send. A failure recording publication after Kafka acknowledgement propagates out of the transaction. The durable unpublished row can be reclaimed, with the same Kafka key, event ID, and payload. Delivery is at least once. Consumers must tolerate duplicate records.

| Criterion | Evidence | Status |
| --- | --- | --- |
| Send failure spends the existing send retry budget, while post-ack write failure propagates | `OutboxRelayServiceTests` exercises the producer success and failure paths and injects a repository exception after acknowledgement. | 4 tests passed |
| Broker acknowledgement followed by database rollback retains a replayable committed event | `OutboxRelayIntegrationTests` uses real disposable Kafka and PostgreSQL. A fixture trigger rejects the publication marker after the real broker send. The row stays unpublished with untouched retry count. Removing the trigger permits a retry. Kafka contains two offsets for the same key and payload. | 2 tests passed |
| Station regressions and schema compatibility | Station `mvn -B -ntp verify` | 242 passed, zero failures, errors, or skips |

The initial targeted run omitted the repository's existing fixture environment and failed to load the secure-mode application context because the fixture did not have an OIDC issuer. The full rerun used `VOLTGRID_SECURITY_REQUIRE_AUTH=false VOLTGRID_OCPP_AUTH_REQUIRED=false AUTHORIZATION_GRPC_TLS_ENABLED=false`, matching the existing Station Maven CI fixture. This verifies database/broker transaction behavior in isolated containers. Security-specific tests use their own settings. Production configuration was untouched.

No migration or data reversal is required for rollback. Existing unpublished rows remain recoverable under the previous revision. The PR records the delivered SHA and final CI outcome. VG-204 remains open for backoff/quarantine/replay, causal ordering and durable consumer receipts, multi-instance fencing, and the full fault matrix.
