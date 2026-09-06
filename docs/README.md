# VoltGrid Documentation

This directory contains the technical documentation created while designing and building VoltGrid.

VoltGrid is being developed incrementally, with a strong focus on understanding each architectural concept and implementation decision.

## Structure

### `adr/`

Contains Architecture Decision Records (ADRs).

ADRs are used to document important technical and architectural decisions made during the project, such as:

* choosing a microservices architecture
* selecting gRPC for internal communication
* choosing Kafka for asynchronous event processing
* deciding how services own their data
* selecting observability and deployment approaches

Each ADR should explain:

* the context or problem
* the decision
* alternatives considered
* consequences and trade-offs

---

### `learning/`

Contains learning notes written while implementing VoltGrid.

These notes are intended to capture the concepts learned during development, including:

* what the concept is
* why VoltGrid needs it
* how it works
* how it was implemented
* mistakes, trade-offs, and lessons learned

Topics may include:

* Spring Boot
* microservices architecture
* JPA and Hibernate
* PostgreSQL
* gRPC and Protocol Buffers
* GraphQL
* OCPP
* WebSockets
* Apache Kafka
* event processing
* transactional outbox
* idempotency
* dead-letter queues
* OpenTelemetry
* Terraform
* AWS

## Documentation Approach

Documentation should evolve together with the implementation.

The project should avoid creating documentation for technologies or architectural decisions that have not yet been introduced.

When a new concept is implemented, the relevant learning notes or ADRs can be added as part of the same development phase.
