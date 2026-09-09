# VoltGrid

VoltGrid is a distributed EV Charging Network Platform / Charging Station Management System (CSMS) built as a learning-focused backend engineering project.

The project is developed incrementally so each distributed-systems concept is introduced because the system has a concrete need for it.

## Current Architecture

```text
Charging Stations
       |
       | OCPP 2.0.1 / WebSocket
       v
+-------------------+
|  Station Service  |
+-------------------+
       |
       | gRPC — next
       v
+-----------------------+
| Authorization Service |
+-----------------------+
```

The Station Service is the first completed service boundary.

The Authorization Service is the next service to be introduced.

## Station Service v1

The Station Service currently provides:

* charging-station registration
* OCPP 2.0.1 WebSocket connectivity
* BootNotification and Heartbeat processing
* station liveness tracking
* connector StatusNotification processing
* TransactionEvent Started / Updated / Ended processing
* transaction and meter-sample persistence
* retransmission and idempotency handling
* late/out-of-order transaction-event handling
* transaction completeness tracking
* concurrency-safe transaction processing
* GraphQL read APIs
* PostgreSQL persistence with Flyway
* PostgreSQL/Testcontainers integration and concurrency testing

See:

```text
services/station-service/README.md
```

for the Station Service boundary and implementation details.

## Next: Authorization Service

The next development phase introduces VoltGrid's second service.

The target flow is:

```text
Charging Station
       |
       | OCPP Authorize
       v
Station Service
       |
       | gRPC
       v
Authorization Service
       |
       | Accepted / Rejected
       v
Station Service
       |
       | OCPP response
       v
Charging Station
```

This phase introduces:

* Protocol Buffers
* gRPC
* synchronous service-to-service communication
* service contracts
* failure handling across service boundaries

Kafka will be introduced later when VoltGrid has events that multiple services need to react to asynchronously.

## Learning Goals

VoltGrid is being used to learn and apply:

* microservices architecture
* Spring Boot
* JPA / Hibernate
* PostgreSQL
* gRPC and Protocol Buffers
* GraphQL
* OCPP and WebSockets
* Apache Kafka and event processing
* distributed-system reliability patterns
* OpenTelemetry
* Docker
* Terraform
* AWS
* CI/CD

## Development Approach

VoltGrid is built through small, independently understandable features.

Each feature should introduce a concrete capability or solve a real system problem rather than adding technology for its own sake.

Important architectural decisions and learning notes live under:

```text
docs/
```

The Git history is kept incremental so the evolution of the system and its architecture can be followed over time.
