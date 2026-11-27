# VG-203 Transport Encryption and Network Boundary Hardening

On 2026-11-27, the transport encryption and network boundary hardening controls specified in issue [#5](https://github.com/Suthankan1/voltgrid/issues/5) and [ADR 0011](../../adr/0011-transport-encryption-and-network-boundaries.md) were implemented and verified across infrastructure and service configurations.

## Threat and Trust Boundaries

| Boundary | Interface / Protocol | Security Profile & Enforcement | Rejection & Failure Mode |
| --- | --- | --- | --- |
| Edge Ingress | ALB HTTPS (Port 443) | TLS 1.3/1.2 via ACM certificate; HTTP (Port 80) permanently redirects to HTTPS (301) | HTTP plaintext blocked; redirects to HTTPS |
| Ingress Forwarding | `X-Forwarded-Proto` | Verified edge reverse proxy only; `OcppHandshakeInterceptor` checks forwarded proto is `https` or `wss` | Non-TLS forwarded proto or multi-hop insecure headers rejected with `403 Forbidden` |
| EVSE to Station Service | OCPP 2.0.1 over WSS (Port 8080/443) | Profile 2 (WSS + salted HTTP Basic Auth). Profile 3 (Client Cert mTLS) reserved for hardware PKI | Plaintext `ws://` / `http://` rejected with `403 Forbidden` when `requireSecureTransport=true` |
| Internal gRPC | Authorization Service (Port 9090) | Netty TLS with x509 leaf and trusted CA certificate chain; shared secret service key `X-Service-Key` | Plaintext clients rejected at handshake; untrusted CA rejected; missing/invalid service key rejected with `UNAUTHENTICATED` (401) |
| Event Streaming | Apache Kafka / AWS MSK | `security.protocol=SSL` or `SASL_SSL` enforced in production profiles | Production startup aborts with `IllegalStateException` if plaintext or insecure protocol configured |
| Relational Storage | PostgreSQL | `sslmode=verify-full` (or pgJDBC's equivalent `ssl=true`) enforced on JDBC URLs in production profiles | Production startup aborts with `IllegalStateException` if `sslmode` is missing or disabled |
| Local Observability | Jaeger, Prometheus, OTel (Ports 16686, 9091, 4317, 4318) | Strict loopback binding (`127.0.0.1`) on all host port publications | Local Docker host avoids wildcard `0.0.0.0` exposure |

## Terraform Configuration Hardening

The Terraform environment definitions under `infrastructure/terraform/environments/dev/` were hardened:
- `load-balancer.tf`: Added HTTP port 80 listener with default 301 redirect to HTTPS port 443; added path-based routing rule `/operations*` forwarding to Operations Service target group.
- `variables.tf`: Introduced `postgres_ssl_mode` variable defaulting to `verify-full`.
- `station-task.tf`, `operations-task.tf`, `authorization-task.tf`: Hardened database JDBC connection strings to append `?sslmode=${var.postgres_ssl_mode}`.
- Terraform Validation:
  - `terraform -chdir=infrastructure/terraform/environments/dev fmt -check`: Passed.
  - `terraform -chdir=infrastructure/terraform/environments/dev validate`: Passed (Success! The configuration is valid).

## Backend Guard Implementation & Verification

### 1. Station Service
- `OcppHandshakeInterceptor`:
  - Enforces `requireSecureTransport` flag. Rejects non-TLS requests (`http`/`ws`) with `403 Forbidden`.
  - Validates `X-Forwarded-Proto` (`https`/`wss`).
  - Rejects multi-hop or spoofed headers with insecure hops.
  - Verified by `OcppHandshakeTransportSecurityTests` (8/8 tests passed).
- `ProductionSecurityConfiguration`:
  - Enforces `sslmode=verify-full` or pgJDBC's equivalent `ssl=true` for database connections in production profiles.
  - Enforces `security.protocol=SSL` or `SASL_SSL` for Kafka event streaming.
  - Enforces `requireSecureTransport=true` in production profiles.
  - Verified by `ProductionSecurityConfigurationTests` (9/9 tests passed).
- Full Station Service suite: 275 tests passed.

### 2. Operations Service
- `ProductionSecurityConfiguration`:
  - Enforces `sslmode=verify-full` or pgJDBC's equivalent `ssl=true` for database connections in production profiles.
  - Enforces Kafka `security.protocol=SSL` or `SASL_SSL` in production profiles.
  - Verified by `ProductionSecurityConfigurationTests` (6/6 tests passed).

### 3. Authorization Service
- `ProductionSecurityConfiguration`:
  - Enforces `sslmode=verify-full` or pgJDBC's equivalent `ssl=true` for database connections in production profiles.
  - Verified by `ProductionSecurityConfigurationTests` (6/6 tests passed).
- `AuthorizationGrpcTlsIntegrationTests`:
  - Verified Netty gRPC server TLS with isolated self-signed and custom CA certificates.
  - Matrix verified:
    1. Trusted CA client connects and receives authorized response: PASSED.
    2. Plaintext client rejected during handshake when TLS required: PASSED.
    3. Untrusted CA client rejected during handshake: PASSED.
    4. Missing or invalid service key rejected with `Status.Code.UNAUTHENTICATED`: PASSED.
    5. Clean failure and revocation without fallback: PASSED.

## Certificate and Secret Lifecycle Runbook

1. **CA and Leaf Certificate Provisioning**:
   - Leaf certificates must be generated from intermediate CAs with maximum 90-day lifespans.
   - Private keys must use minimum RSA 3072-bit or ECDSA P-256/P-384.
2. **Zero-Downtime Certificate Rotation**:
   - Phase 1: Deploy updated truststores containing both the current and new CA certificates.
   - Phase 2: Deploy new leaf certificates and private keys to services.
   - Phase 3: Remove retired CA certificate from truststores once leaf cutover is verified.
3. **Emergency Revocation**:
   - Revoked certificates are added to CRL / OCSP responder immediately.
   - System strictly rejects connections on handshake failure; fallback to plaintext or unauthenticated transport is prohibited.


## PostgreSQL configuration regression

The production guards use pgJDBC's URL parser and SSL mode resolution. They require certificate and peer hostname verification and reject custom SSL factories, custom hostname verifiers, and GSS modes that can take precedence over TLS. The Terraform configuration requires `verify-full`. Deployments using `verify-ca` must configure the CA and use the database endpoint covered by the server certificate before restarting.

Focused offline Maven tests passed on Java 25 in Station (9), Authorization (6), and Operations (7) using `mvn -o -q -f services/<service>-service/pom.xml -Dtest=ProductionSecurityConfigurationTests test`. These tests exercise URL policy. Terraform formatting and validation passed without applying infrastructure changes.

`PostgresTlsIntegrationTests` started PostgreSQL 18.6 on a local Docker engine with a generated certificate and SCRAM authentication. A trusted connection to the certificate hostname succeeded and `pg_stat_ssl` confirmed encryption. A different hostname with the same trust, an untrusted certificate, a plaintext client, and a bad database password were each rejected. Full offline Maven verification passed for Station (305 tests) and Authorization (49 tests, including the PostgreSQL TLS fixture). Certificate expiry, rotation, authenticated Kafka, gRPC, and reverse-proxy boundary acceptance remain tracked in #5.
