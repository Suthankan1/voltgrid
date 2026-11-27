# 11. Transport Encryption, Network Boundaries, and Certificate Lifecycle

## Context
VoltGrid processes sensitive charging transactions, financial authorization, operator administration, and physical charging commands. Prior to milestone VG-203, network communication had mixed transport security posture:
- Observability and local database ports were exposed on wildcard host interfaces (`0.0.0.0`) instead of loopback (`127.0.0.1`) (SEC-006).
- Inter-service gRPC communication relied on application-level metadata service authentication without mandatory transport-level encryption (SEC-004).
- Charging station WebSocket connections supported application-level basic authentication, but did not formally enforce TLS/WSS at the protocol and proxy boundary.
- Database and event bus connections used default unencrypted transport in development without startup-level enforcement of certificate verification in production.

## Security Problem
Plaintext transport or inadequate certificate verification exposes VoltGrid to:
- Network sniffing and packet capture of credentials, session tokens, and charging records.
- Man-in-the-Middle (MitM) attacks through rogue proxies or spoofed DNS.
- Header injection / spoofing (e.g. forging `X-Forwarded-Proto` to bypass secure transport checks).
- Unauthorized lateral movement on the internal VPC network.

## Architectural Boundaries and Threat Model

```
+-----------------------------------------------------------------------------------------+
|                                    PUBLIC UNTRUSTED ZONE                                |
|                                                                                         |
|   +-----------------------+                         +-------------------------------+   |
|   |   Operator Browser    |                         |    OCPP 2.0.1 Charging        |   |
|   |  (HTTPS / TLS 1.3)    |                         |    Station (WSS / TLS 1.3)    |   |
|   +-----------+-----------+                         +---------------+---------------+   |
+---------------|-----------------------------------------------------|-------------------+
                |                                                     |
                v                                                     v
+-----------------------------------------------------------------------------------------+
|   AWS Application Load Balancer (ALB) / ACM Certificate (ELBSecurityPolicy-TLS13-1-2)   |
|   - Port 80 HTTP -> 301 Redirect to Port 443 HTTPS                                     |
|   - Drops malformed header fields (drop_invalid_header_fields = true)                   |
|   - Strips / sanitizes rogue client-supplied X-Forwarded headers                        |
+-----------------------------------------------------------------------------------------+
                |                                                     |
                v (Private Subnets)                                   v (Private Subnets)
+-----------------------------------------------------------------------------------------+
|                                   VPC PRIVATE SUBNETS                                   |
|                                                                                         |
|   +-------------------------------+             +----------------------------------+    |
|   |        Operator Web           |             |         Station Service          |    |
|   |       (Next.js BFF)           |             |      (Spring Boot / Java 25)     |    |
|   +---------------+---------------+             +-----------------+----------------+    |
|                   |                                               |                     |
|                   | Internal GraphQL                              | gRPC (Netty TLS)    |
|                   | (HTTPS / Verified Service Key)                |                     |
|                   v                                               v                     |
|   +--------------------------------------------------------------------------------+    |
|   |                             Authorization Service                              |    |
|   |                  (gRPC Server with TLS & Service Key Interceptor)              |    |
|   +--------------------------------------------------------------------------------+    |
|                                                                                         |
|                   |                                               |                     |
|                   v PostgreSQL (sslmode=verify-full)              v Kafka (TLS/SASL)    |
|   +-------------------------------+             +----------------------------------+    |
|   |     RDS PostgreSQL 18.6       |             |           Apache Kafka           |    |
|   |    (Encrypted gp3, Private)   |             |       (Encrypted Topics)         |    |
|   +-------------------------------+             +----------------------------------+    |
+-----------------------------------------------------------------------------------------+
```

## Decisions

### 1. OCPP Security Profile Distinction
VoltGrid distinguishes OCPP security profiles based on the OCPP 2.0.1 specification:
- **Profile 0 (Unsecured / Path-based identity)**: Strictly prohibited across all environments.
- **Profile 1 (Unsecured transport / Basic Auth)**: Prohibited in production; permitted only in local offline unit mock tests.
- **Profile 2 (Basic Authentication over TLS/WSS)**: **Current Commercial Production Standard**.
  - Chargers connect via `wss://<domain>/ocpp/{stationId}`.
  - Requires valid HTTP `Authorization: Basic <credentials>` verified against PBKDF2-v2 salted hashes (210,000 iterations).
  - Reverse proxy / ALB terminates TLS; backend validates that `X-Forwarded-Proto` is `https` or `wss`, rejecting plaintext requests when secure transport is required.
- **Profile 3 (Client Certificate Mutual TLS / mTLS)**:
  - Architecture defined for enterprise hardware PKI.
  - Mutual certificate authentication where charger presents a client certificate issued by a trusted root CA.
  - Requires hardware-embedded private keys (TPM / secure element) on chargers. VoltGrid does not claim Profile 3 compliance until hardware PKI and client cert verification are verified in release gates.

### 2. Transport Encryption Enforcement in Production (`prod` Profile)
VoltGrid services fail closed (`IllegalStateException`) on bootstrap in production if unencrypted transport is configured:
1. **gRPC Inter-Service Transport**:
   - `spring.grpc.server.ssl.enabled=true` with configured SSL key/cert bundle.
   - `spring.grpc.client.channel.authorization.ssl.enabled=true`.
   - Plaintext gRPC connections fail immediately with SSL handshake error.
2. **PostgreSQL Relational Storage**:
   - `spring.datasource.url` must specify `sslmode=verify-full` or `verify-ca` (or `ssl=true`) along with `sslrootcert`.
   - Plaintext JDBC connection strings are rejected during bootstrap validation.
3. **Kafka Event Bus**:
   - `spring.kafka.properties.security.protocol` must be `SSL` or `SASL_SSL`.
   - Unencrypted plaintext broker connections (`PLAINTEXT`) are rejected during bootstrap validation.
4. **WebSocket / HTTP Ingress**:
   - `OcppHandshakeInterceptor` enforces secure transport (`voltgrid.ocpp.require-secure-transport=true`).
   - Plaintext WebSocket upgrades (`ws://` without verified `X-Forwarded-Proto: https/wss`) are rejected with `403 Forbidden`.

### 3. Loopback Ingress for Local Monitoring & Dev Services (SEC-006)
- In development and CI compose files (`compose.yaml`, `observability/local/compose.yaml`), all diagnostic and database ports are bound strictly to `127.0.0.1`:
  - PostgreSQL: `127.0.0.1:5432-5436`
  - Station Service: `127.0.0.1:8080`
  - Authorization Service gRPC: `127.0.0.1:9090`
  - Operations Service: `127.0.0.1:8081`
  - Prometheus: `127.0.0.1:9091`
  - Jaeger UI: `127.0.0.1:16686`
  - OpenTelemetry Collector: `127.0.0.1:4317` (gRPC), `127.0.0.1:4318` (HTTP)

### 4. Infrastructure & Edge Hardening (Terraform / AWS)
- **ALB Listeners**:
  - Port 80 (HTTP) listener configured with a permanent `301 Moved Permanently` redirect to port 443 (HTTPS) when an ACM certificate is provisioned.
  - Port 443 (HTTPS) listener utilizes AWS modern security policy `ELBSecurityPolicy-TLS13-1-2-2021-06`.
  - ALB configured with `drop_invalid_header_fields = true` to protect backend services against HTTP request smuggling and malformed proxy headers.
- **VPC Subnet & Security Group Isolation**:
  - Application services and databases reside strictly within private subnets with no public IPv4 addresses assigned.
  - Security group ingress rules enforce point-to-point least privilege:
    - ALB -> ECS Task targets on port 8080 / 8081.
    - Station Service -> Authorization Service gRPC on port 9090.
    - Services -> RDS Postgres on port 5432 strictly from their specific security groups.

### 5. Certificate Lifecycle and Rotation Runbook
- **Certificate Authority (CA) Hierarchy**:
  - Root CA: Offline, high-security root key.
  - Intermediate / Issuing CA: Signs server certificates for gRPC, WSS, and internal services.
  - Leaf Certificates: Bound to exact Subject Alternative Names (SANs) e.g. `authorization-service.voltgrid.internal`, `station-service.voltgrid.internal`.
- **Validation Invariants**:
  - Expiration: Certificates must be rotated before expiration (standard 90-day validity for leaf certificates).
  - Hostname verification: Clients verify SAN against expected destination host.
  - Untrusted CA / wrong hostname / expired certificates fail immediately with handshake termination.
- **Zero-Downtime Rotation Procedure**:
  1. Distribute new CA certificates into client truststores before server certificate renewal.
  2. Deploy server leaf certificates signed by the active issuing CA.
  3. Verify handshake with canary requests.
  4. Retire superseded leaf certificates and update CRL / revocation lists.

## Effective Endpoint Inventory

| Endpoint | Protocol / Scheme | Port | Ingress Source | Transport Security & Verification |
| --- | --- | --- | --- | --- |
| Edge HTTP Ingress | HTTP | 80 | Public Internet | 301 Redirect to HTTPS 443 |
| Edge HTTPS Ingress | HTTPS / TLS 1.3 | 443 | Public Internet | ACM Certificate (`ELBSecurityPolicy-TLS13-1-2-2021-06`) |
| OCPP WebSocket | WSS / TLS 1.3 | 443 -> 8080 | Charging Stations | Terminated at ALB; backend checks `X-Forwarded-Proto: https`; Basic Auth PBKDF2-v2 |
| Operator Web BFF | HTTPS | 443 -> 3000 | Web Browsers | Terminated at ALB; Same-origin cookies, `HttpOnly`, `Secure`, `SameSite=Lax` |
| Station Service GraphQL | HTTP / HTTPS | 8080 | Operator Web / Internal | JWT Bearer validation with Keycloak JWKS, tenant scoping |
| Operations Service API | HTTP / HTTPS | 8081 | Operator Web / Internal | JWT Bearer validation with Keycloak JWKS, read-projection scoping |
| Authorization Service gRPC | gRPC / Netty TLS | 9090 | Station Service | Netty TLS with server certificate verification + `x-voltgrid-service-id` / `service-key` |
| RDS PostgreSQL | PostgreSQL Wire | 5432 | Station, Auth, Operations | Private subnet SG; `sslmode=verify-full`, encrypted gp3 storage |
| Apache Kafka | Kafka Wire / SSL | 9092 / 29092 | Station, Operations | Private subnet; `security.protocol=SSL` or `SASL_SSL` |
| Prometheus UI | HTTP | 9091:9090 | Localhost | Bound strictly to `127.0.0.1` |
| Jaeger UI | HTTP | 16686 | Localhost | Bound strictly to `127.0.0.1` |
| OpenTelemetry Collector | gRPC / HTTP | 4317 / 4318 | Localhost | Bound strictly to `127.0.0.1` |

## Consequences
- Prevents plaintext data leakage across public and internal network segments.
- Formally clarifies OCPP Profile 2 as current production baseline while distinguishing Profile 3 prerequisites.
- Eliminates silent fallbacks to unencrypted transport in production via fail-closed startup validation.
