# VG-203 local observability network boundary

On 2026-11-27, this SEC-006 slice was verified from main `d9b13c14324a2fd2958fa6a76ce432d2e1bddd38` on `remediation/vg-203-local-observability`. It addresses the wildcard host publishes recorded in the VG-201 audit.

| Service | Host address and port | Container port |
| --- | --- | --- |
| Jaeger UI | `127.0.0.1:16686` | 16686 |
| OpenTelemetry Collector gRPC | `127.0.0.1:4317` | 4317 |
| OpenTelemetry Collector HTTP | `127.0.0.1:4318` | 4318 |
| Prometheus UI | `127.0.0.1:9091` | 9090 |

The collectors and exporters still communicate on the Compose network through container addresses. The host ports are for local development, with unchanged protocol and port numbers. Local scripts using an explicit LAN or IPv6 host address should use `127.0.0.1`. Recreate the local observability containers to replace the host publishes. If recreation fails, stop the observability stack while resolving the conflict to keep the wildcard publishes off.

| Verification | Result |
| --- | --- |
| `python3 tests/infrastructure/verify-local-observability-ports.py` reads resolved Compose JSON and verifies all four services and ports | Passed on the change. The same test failed as expected on the original config, where every publish omitted the host IP. |
| Isolated `docker compose -p voltgrid-vg203-observability -f observability/local/compose.yaml up -d --pull never` | Passed. The first Jaeger readiness request got an empty reply while the container started. Bounded curl retries succeeded. |
| Jaeger HTTP, Prometheus readiness endpoint, OpenTelemetry HTTP empty-traces request and gRPC TCP connection | All passed on loopback. The gRPC check verified TCP reachability only. |
| `docker inspect` effective port mappings | All four reported `HostIp=127.0.0.1`. |
| Final-head CI and owner merge | Pending at submission. |

The isolated project was torn down after verification. This change leaves #5 open for TLS/WSS, credential lifecycle, verified gRPC/Kafka/PostgreSQL transport, Terraform validation and IaC scanning, the full integration matrix, and owner review.
