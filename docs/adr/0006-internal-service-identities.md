# 6. Internal Service Identities

## Context
VoltGrid services communicate across boundaries: Station Service calls Authorization Service over gRPC to validate charging tokens; Station Service publishes events to Apache Kafka; Operations Service consumes events to maintain materialized read projections.

## Security Problem
Unauthenticated service communication allows rogue processes on the internal network to spoof gRPC requests (e.g., authorizing fraudulent charging sessions) or inject forged status events directly into Kafka topics. Human operator credentials must not be reused for inter-service communication.

## Alternatives Considered
1. **Plaintext Network Trust (Implicit Trust)**:
   - *Pros*: Zero configuration.
   - *Cons*: Vulnerable to network eavesdropping, lateral movement, and spoofing if perimeter is breached.
2. **Shared Static API Keys in gRPC Metadata**:
   - *Pros*: Simple to verify with gRPC interceptor.
   - *Cons*: Difficult to rotate without downtime; static key compromise affects all services.
3. **Mutual TLS (mTLS) with Service-Scoped Tokens / Interceptors**:
   - *Pros*: Cryptographic mutual authentication, strong identity binding, transport encryption.
   - *Cons*: Requires infrastructure PKI setup (deferred to VG-203).
4. **Application-level Service Identity with gRPC Interceptors & Kafka Principal Scoping**:
   - *Pros*: Enforces distinct service identities (`station-service`, `authorization-service`, `operations-service`) using application-level tokens/credentials validated via gRPC client/server interceptors; lays the contract foundation for mTLS in VG-203.

## Selected Approach
Implement **Application-Level Service Authentication with gRPC Interceptors**:
- **Service Identity**: `station-service` identifies itself when calling `authorization-service` via gRPC metadata (`x-voltgrid-service-id: station-service` and `x-voltgrid-service-key: <service-secret>`).
- **Authorization Service gRPC Interceptor**: Validates the caller identity and secret against configured trusted service identities. Unauthenticated or unrecognized callers are rejected with `Status.UNAUTHENTICATED`.
- **Audience Verification**: gRPC requests verify that the target audience is `authorization-service`.
- **Kafka Contracts**: Kafka topic publishers and consumers are explicitly named with consumer group IDs and message schemas; topic access policies and SASL/SCRAM are documented for VG-203.

## Rationale
- Prevents unauthorized callers from querying Authorization Service.
- Establishes clear service trust boundaries and audit trails.
- Separates machine service identities from human operator identities.

## Trade-offs
- Requires configuring service secrets across communicating backend services.

## Trust Boundaries
- Station Service gRPC Client -> Authorization Service gRPC Server. Every gRPC call crosses a service trust boundary and is authenticated via the server interceptor.

## Failure Behavior
- gRPC calls with invalid service credentials fail with `UNAUTHENTICATED`, and charging token authorization is rejected (fails closed).

## Migration Implications
- Development configurations provide explicit local service secrets.

## Operational Implications
- Service secrets are injected via environment variables (`AUTHORIZATION_SERVICE_KEY`, `STATION_SERVICE_KEY`).

## Testing Strategy
- Unit and integration tests verifying authorized gRPC calls succeed.
- Negative tests asserting that missing, bad, or mismatched service credentials result in `Status.UNAUTHENTICATED`.

## Remaining Dependencies
- Production mTLS wire encryption and service mesh certificates (deferred to VG-203).
