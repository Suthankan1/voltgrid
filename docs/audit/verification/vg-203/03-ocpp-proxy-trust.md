# VG-203 OCPP proxy trust

Base `88584e07f636666152d88b76e3098e60ca570b9a`. Tracks [#5](https://github.com/Suthankan1/voltgrid/issues/5).

The Station OCPP handshake requires secure transport by default in the `prod` and `production` profiles. Direct TLS uses the native request scheme. A TLS-terminating proxy can supply one HTTPS or WSS protocol value only when the socket peer matches an explicit CIDR in `voltgrid.ocpp.trusted-proxy-cidrs`. This setting is empty by default. Invalid CIDRs fail startup. Secure mode also rejects configuration that rewrites request identity before the handshake.

For deployments that terminate TLS at a proxy, use a dedicated, trusted proxy CIDR or tightly scoped peer addresses. Restrict Station ingress to that proxy and have the proxy replace forwarding headers on the upstream connection. The checked-in cloud topology has no new proxy trust configuration in this change. A deployment needs validated peer ranges, certificate settings and ingress restrictions before relying on proxy termination.

`OcppHandshakeTransportSecurityTests` verifies direct TLS, configured proxy and default production behavior, untrusted peer rejection, ambiguous or insecure protocol values, and the forwarded-header strategy check. Full `mvn -o -f services/station-service/pom.xml verify` passed 310 tests with zero failures, errors or skips. The suite used disposable PostgreSQL and Kafka. The handshake class uses request mocks.

Certificate expiry, rotation, live TLS/proxy integration, actual network reachability, gRPC and authenticated Kafka transport remain open. This change has no database migration. Reverting it restores the previous application trust behavior.
