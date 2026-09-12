# Authorization Flow Integration Tests

This module contains black-box integration tests for VoltGrid's authorization flow.

The tests launch real Station Service and Authorization Service processes, connect them to isolated PostgreSQL containers, and interact with the system through its external interfaces.

## Covered Flow

```text
OCPP WebSocket Client
        |
        v
Station Service
        |
        | gRPC
        v
Authorization Service
        |
        v
PostgreSQL