# 14 — Feature Gap Analysis

> **Audit**: VG-200 · **Commit**: `e6bf891` · **Date**: 2026-11-26

## Overview

VoltGrid aims to provide a modern, distributed Charging Station Management System (CSMS) compliant with the Open Charge Point Protocol (OCPP) 2.0.1. This audit compared the current repository implementation against the OCPP 2.0.1 specification and modern commercial CSMS feature requirements.

---

## 1. OCPP 2.0.1 Functional Block Matrix

| Functional Block | Standard Scope | VoltGrid Status | Gap Description |
|---|---|---|---|
| **B: Provisioning** | BootNotification, SetVariables, GetVariables, Reset, TriggerMessage | **Partial** | Only `BootNotification` is implemented. CSMS cannot remotely configure variables, query station parameters, or trigger soft/hard resets. |
| **C: Authorization** | Authorize, LocalList, Certificate/Token Cache | **Partial** | Implements incoming `Authorize` requests checked via gRPC. No local authorization list (`SendLocalList`) synchronization. |
| **D: Availability** | StatusNotification, ChangeAvailability, Heartbeat | **Partial** | `StatusNotification` and `Heartbeat` are handled. CSMS cannot remotely change connector availability (`Operative` / `Inoperative`). |
| **E: Transactions** | TransactionEvent (Started, Updated, Ended), MeterValues, Cost | **Partial** | `TransactionEvent` handled. Standalone periodic `MeterValues` requests are rejected (`NotImplemented`). Cost / tariff calculations absent. |
| **F: Remote Control**| RequestStartTransaction, RequestStopTransaction, UnlockConnector | **Missing (0%)** | Zero CSMS-initiated remote control operations exist. An operator cannot remotely start/stop charging or unlock a stuck connector. |
| **G: Metering** | SampledValue, MeterValues, Signed Data | **Partial** | Samples within `TransactionEvent` are parsed and stored. No support for meter digital signatures (Eichrecht compliance). |
| **J: Firmware** | UpdateFirmware, FirmwareStatusNotification | **Missing (0%)** | No OTA firmware update management. |
| **M: Smart Charging**| SetChargingProfile, ClearChargingProfile, GetChargingProfiles | **Missing (0%)** | No dynamic load balancing, grid peak shaving, or charging profile distribution. |
| **N: Diagnostics** | GetLog, CustomerInformation, DiagnosticsStatusNotification | **Missing (0%)** | Cannot retrieve diagnostic bundles from hardware. |
| **P: Security** | CertificateSigned, SignCertificate, SecurityEventNotification | **Missing (0%)** | No 15118 / OCPP PKI certificate lifecycle management. |

---

## 2. In-Depth OCPP Protocol Gaps

### GAP-001: Missing Standalone MeterValues Support
- In `services/station-service/src/main/java/com/voltgrid/station/api/ocpp/OcppMessageProcessor.java`:
  - When an incoming OCPP message action is `MeterValues`, the processor returns `NotImplemented`.
  - While samples embedded in `TransactionEvent` are captured, many chargers emit periodic `MeterValues` messages between state transitions or when idling to report grid voltage and power quality.

### GAP-002: Inability to Remotely Unlock Connectors or Stop Transactions
- Physical EV drivers frequently encounter stuck charging cables or need operator intervention to terminate runaway sessions.
- Currently, `station-service` provides no outbound CALL mechanism (CSMS → Charging Station). The WebSocket connection is treated exclusively as an ingress channel (Charging Station → CSMS).

### GAP-003: Timestamp Offset Parsing Restrictions
- In `OcppMessageProcessor.java`:
  - Timestamps are parsed using `Instant.parse(timestamp)`.
  - Valid RFC 3339 timestamps from chargers with explicit timezone offsets (e.g., `2026-11-26T12:00:00+02:00`) cause `DateTimeParseException` because `Instant.parse` requires ISO-8601 UTC `Z` format.
  - Non-UTC compliant station timestamps cause immediate transaction drops.

---

## 3. Operator Web Dashboard Feature Matrix

| Feature Domain | Existingredesign Implementation | Commercial CSMS Gap |
|---|---|---|
| **Fleet Overview** | Total stations, online/offline counts, active sessions, network capacity | Complete for read model; needs live WebSocket/SSE streaming |
| **Stations Directory** | Search, filter by connectivity, responsive list and cards | Complete |
| **Station Registration** | Local form, validation, backend mutation with UX fallback | Lacks credential issuance (Basic Auth / TLS cert provisioning) |
| **Station Details** | Metadata, connectors, live status, realistic charger illustrations | Lacks remote command controls (Reboot, Unlock, Set Available) |
| **Sessions Directory** | Filter by active/ended, status badges, pagination | Complete |
| **Session Details** | Complete timeline, completeness score, sample ledger | Lacks billing summary, tariff details, and invoice generation |
| **Token Administration**| None | **Missing**: Operators cannot issue, revoke, or inspect RFID tokens via UI |
| **Tariff & Pricing** | None | **Missing**: No pricing models (per kWh, per minute, idle fees) |
| **Role-Based Access** | Single global operator view | **Missing**: No Viewer vs Operator vs Fleet Admin role separation |
