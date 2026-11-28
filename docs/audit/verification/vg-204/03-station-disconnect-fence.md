# VG-204 station disconnect fencing

Base `88584e07f636666152d88b76e3098e60ca570b9a`. Tracks [#6](https://github.com/Suthankan1/voltgrid/issues/6) and supports #10.

A delayed socket close could still run command cleanup after PostgreSQL rejected that connection generation as stale. The WebSocket callback now removes only the matching local session. Database generation validation and command cleanup run in the same transaction. Station connectivity writes lock the row before reading its generation and updating state. Concurrent registrations therefore get distinct generations. A cleanup exception rolls back the database transition.

The stale close test failed on the base with two handler fixtures and shared PostgreSQL. The corrected suite covers concurrent registration, stale close and active close, and rollback after a synthetic callback failure. Full `mvn -o -f services/station-service/pom.xml verify` passed 309 tests with zero failures, errors or skips, using disposable PostgreSQL and Kafka.

The two handler fixtures share one test JVM. Full multi-process send and receive fencing, the race between a generation check and frame processing, shared operator sessions, broker and database outage drills, poison/DLT and tenant-preserving replay remain open. No schema change is required.
