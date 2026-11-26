# 05 — Security Findings

> **Audit**: VG-200 · **Commit**: `e6bf891` · **Date**: 2026-11-26

## SEC-001 · Unauthenticated OCPP WebSocket (Critical)

| Field | Value |
|---|---|
| **Severity** | Critical |
| **Confidence** | Confirmed by static analysis |
| **Component** | station-service |
| **File** | `services/station-service/src/main/java/com/voltgrid/station/api/ocpp/OcppHandshakeInterceptor.java` L25–L47 |
| **Audited commit** | `e6bf891` |

**Description**: The WebSocket handshake interceptor validates that the requested station ID exists in the database and that the client requests the `ocpp2.0.1` subprotocol, but requires **no authentication credentials**. No Basic Auth header check, no client certificate validation, no bearer token, no pre-shared key.

**Evidence**: `OcppHandshakeInterceptor.beforeHandshake()` (L26–L48) checks only `supportsOcpp201(request)` and `stationReader.findById(stationId).isEmpty()`. No `Authorization` header inspection. `OcppWebSocketConfig` (L27) registers the handler at `/ocpp/*` with no additional security interceptors.

**Impact**: Any client on the network can connect to `ws://host:8080/ocpp/{knownStationId}` and send arbitrary OCPP messages — BootNotification, StatusNotification, TransactionEvent, Authorize — as that station.

**Deployment exposure**: Local dev (low risk), shared network (high), cloud (critical), production (critical).

**Remediation**: Add Basic Auth or token validation in `OcppHandshakeInterceptor.beforeHandshake()` by extracting and verifying credentials from the `Authorization` header against a per-station credential store. Long-term: mutual TLS with client certificates.

---

## SEC-002 · Zero backend authentication/authorization (Critical)

| Field | Value |
|---|---|
| **Severity** | Critical |
| **Confidence** | Confirmed by static analysis |
| **Components** | station-service, authorization-service, operations-service |
| **Files** | All `pom.xml` files (no `spring-boot-starter-security`), all `@Controller`/`@GrpcService` classes |
| **Audited commit** | `e6bf891` |

**Description**: None of the three backend services include Spring Security. No `spring-boot-starter-security` dependency in any `pom.xml`. No `SecurityFilterChain` configuration, no `@PreAuthorize` annotations, no JWT/OIDC token validation, no API key validation.

**Evidence**:
- `services/station-service/pom.xml`: No security starter
- `services/authorization-service/pom.xml`: No security starter (this service authorizes RFID tokens, not API callers)
- `services/operations-service/pom.xml`: No security starter
- `StationGraphQlController.java`: Unannotated `@Controller` with public `registerStation` mutation
- `GrpcAuthorizationService.java`: Unannotated `@GrpcService`

**Impact**: Any HTTP client can call `POST /graphql` on port 8080 to register stations, query all transactions, or on port 8081 to query the operations projection. Any gRPC client can call the authorization service directly.

**Existing mitigation**: The frontend uses `'use server'` Server Actions with local validation, but this is a UX constraint only — the backend is fully exposed.

**Remediation**: Add `spring-boot-starter-security` and configure a JWT resource server with OIDC provider integration across all three services. Apply `@PreAuthorize` to all mutations and sensitive queries.

---

## SEC-003 · HMAC key hardcoded fallback and missing deployment injection (High)

| Field | Value |
|---|---|
| **Severity** | High |
| **Confidence** | Confirmed by static analysis |
| **Component** | authorization-service |
| **File** | `services/authorization-service/src/main/java/com/voltgrid/authorization/application/TokenFingerprintService.java` L14 |
| **Audited commit** | `e6bf891` |

**Description**: `TokenFingerprintService` uses an HMAC key from `voltgrid.authorization.hmac-key` with a hardcoded fallback value `voltgrid-local-development-hmac-key-change-me`. The ECS task definition in Terraform does not inject this environment variable, so the production deployment would use the default.

**Evidence**: `application.properties` L7: `voltgrid.authorization.hmac-key=${HMAC_KEY:voltgrid-local-development-hmac-key-change-me}`. Terraform `ecs.tf` container definitions do not include `HMAC_KEY`.

**Impact**: Predictable token fingerprints in deployed environments. Known HMAC key enables token forgery.

**Remediation**: Inject `HMAC_KEY` via AWS Secrets Manager/Parameter Store in ECS task definition. Remove hardcoded fallback or fail startup when no key is provided in non-dev profiles.

---

## SEC-004 · All transport plaintext (High)

| Field | Value |
|---|---|
| **Severity** | High |
| **Confidence** | Confirmed by static analysis |
| **Components** | All services, infrastructure |
| **Files** | `station-service/application.properties` L14, `compose.yaml`, `infrastructure/terraform/ecs.tf`, ALB config |
| **Audited commit** | `e6bf891` |

**Description**: No encryption in transit anywhere in the system:
- WebSocket: `ws://` (not `wss://`)
- GraphQL: `http://` (not `https://`)
- gRPC: `spring.grpc.client.channel.authorization.ssl.enabled=false`
- Kafka: `PLAINTEXT` security protocol (default, no `security.protocol` override)
- JDBC: No `sslmode` parameter in connection URLs
- ALB: Listener on port 80 only, no HTTPS listener or certificate

**Impact**: All data in transit (station identities, authorization tokens, transaction data, meter readings, DB credentials) visible to any network observer.

**Remediation**: Enable TLS on ALB with ACM certificate, configure `wss://` for OCPP WebSocket, enable gRPC SSL, set Kafka `security.protocol=SSL`, add `sslmode=require` to JDBC URLs.

---

## SEC-005 · Public subnets and unrestricted egress in Terraform (Moderate)

| Field | Value |
|---|---|
| **Severity** | Moderate |
| **Confidence** | Confirmed by static analysis |
| **Component** | Infrastructure |
| **File** | `infrastructure/terraform/networking.tf`, `infrastructure/terraform/ecs.tf` |
| **Audited commit** | `e6bf891` |

**Description**: All ECS services (including internal authorization-service) are deployed in public subnets with `assign_public_ip = true`. Security groups allow unrestricted egress. Authorization-service has no business need for public internet access.

**Impact**: Increased attack surface. Compromised containers can exfiltrate data without NAT gateway logging.

**Remediation**: Deploy internal services (authorization-service, operations-service) in private subnets with NAT gateway for outbound access. Restrict security group egress to required destinations only.

---

## SEC-006 · Docker Compose ports bound to all interfaces (Moderate)

| Field | Value |
|---|---|
| **Severity** | Moderate |
| **Confidence** | Confirmed by static analysis |
| **Component** | Docker Compose |
| **File** | `compose.yaml` |
| **Audited commit** | `e6bf891` |

**Description**: All service ports in `compose.yaml` are bound to `0.0.0.0` (e.g., `8080:8080`, `9090:9090`, `5433:5432`), exposing services on all network interfaces including public WiFi or VPN interfaces. Only `compose.operator-test.yaml` correctly binds to `127.0.0.1`.

**Impact**: Services accessible to any device on the developer's network.

**Remediation**: Prefix all port mappings with `127.0.0.1:` (e.g., `127.0.0.1:8080:8080`).
