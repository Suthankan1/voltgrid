# VG-204 Verification Evidence

This directory contains verification evidence for **[VG-204][P0] Distributed reliability, ordering and outbox recovery** (issue [#6](https://github.com/Suthankan1/voltgrid/issues/6)).

## Artifacts

1. [01-outbox-acknowledgement-recovery.md](./01-outbox-acknowledgement-recovery.md): Broker acknowledgement followed by database rollback retains committed event and leaves Kafka send retry budget intact.
2. [02-distributed-reliability-ordering-and-fencing.md](./02-distributed-reliability-ordering-and-fencing.md): Verification evidence covering:
   - Per-aggregate ordering keys on partitioned topics.
   - Monotonic causal sequence numbers and deterministic tie-breaks for equal-timestamp events.
   - Multi-instance station connection generation fencing preventing split-brain stale disconnects.
   - Outbox relay exponential backoff, poison event quarantine, and operator replay runbooks.
   - Durable consumer idempotency and atomic projection transactions.
