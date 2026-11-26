# Product experience (UX-001.1–3, 6)

## Identity
VoltGrid is an EV charging-network management workspace for monitoring stations, inspecting charging activity and investigating observed problems. Vision: make infrastructure management understandable even for first-time operators. Tagline: Energy in focus. Personality: calm, precise, trustworthy, distinctive. The product is not a showcase of Kafka, gRPC, OCPP or GraphQL.

## Personas (hypotheses)
| Persona | Priority | Needs | Context |
|---|---|---|---|
| Network operator | Primary | Connectivity, search, connector status, registration, sessions | Daily; basic/intermediate technical skill; desktop |
| Infrastructure technician | Secondary/high | Equipment identifiers, timestamps, meter streams, missing sequences, connection guidance | Daily/on fault; advanced; laptop/mobile on site |
| Network manager | Secondary | Trustworthy network summaries and operational oversight | Daily/weekly; desktop/mobile |

One application for all; personas are not security roles. Default views favor ordinary tasks; advanced evidence remains available. Validate with actual operators where possible and previous feedback participants.

## Jobs to be done
| ID | When / desired outcome | Priority | Destination |
|---|---|---|---|
| JTBD-01 | Starting work, understand current fleet connectivity | P0 | Overview |
| JTBD-02 | Inspecting known equipment, find it by name/ID | P0 | Stations |
| JTBD-03 | Investigating problems, locate observable issues | P0 | Attention |
| JTBD-04 | Opening a station, distinguish connectivity, connectors and activity | P0 | Station details |
| JTBD-05 | Reviewing activity, find session, timing, lifecycle and data quality | P0 | Sessions/details |
| JTBD-06 | Investigating measurements, interpret compatible recorded streams | P1 | Session measurements |
| JTBD-07 | Expanding fleet, register and understand connection steps | P0 | Add station (local only) |
| JTBD-08 | Troubleshooting, inspect technical evidence | P1 | Diagnostics/details |

P1 is not permission to remove existing behavior.

## Experience rules
- Clarity over complexity; purpose over decoration; guidance over training; trust over appearance; depth without distraction.
- One clear page purpose and primary action per task region. Use familiar links, buttons and labels. No icon-only essential actions.
- Progressive disclosure: awareness → investigation → diagnostic evidence. Critical warnings stay visible.
- Show meaning before technical representation. Preserve advanced identifiers and raw data.
- Status is a reported observation, not physical confirmation. Current connectivity is not uptime; zero is not unknown; ended is not complete; occupied is not proof of active charging.
- No fabricated measurements, global totals from partial pages or unsupported actions.
- Desktop-first, responsive, keyboard accessible, reduced motion; see design system and acceptance criteria.
- Error copy: explain what happened, consequences and next action; do not expose raw exceptions. Critical errors persist, not toast-only.

## Vocabulary
| Technical term | Default UI |
|---|---|
| Network | Overview |
| Transaction | Charging session |
| Integrity INCOMPLETE | Missing data |
| Meter trace | Charging measurements |
| Operations projection | Reported station status |
| Sequence rail | Event sequence (technical details) |
| Register station | Add station (navigation), Register station (submit) |
| Request failure | Unable to load [resource] |
| Page lifecycle filter | Active sessions on this page |

## Non-goals
Maps, revenue, payments, historical uptime, remote start/stop, reset, firmware, predictive maintenance, incident assignments, alerts/notifications, user administration, production authentication and cloud deployment. No additional backend endpoints during redesign. Revisit only as separately approved features.
