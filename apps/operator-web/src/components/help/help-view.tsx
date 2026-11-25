import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DisclosureItem {
  id: string;
  summary: string;
  body: ReactNode;
}

function DisclosureList({ items }: { items: readonly DisclosureItem[] }) {
  return (
    <div className="divide-y divide-[color:var(--vg-border)] border-t border-[color:var(--vg-border)]">
      {items.map(item => (
        <details key={item.id} className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 font-sans text-[0.9375rem] font-semibold text-[color:var(--vg-text-primary)] hover:text-[color:var(--vg-brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)] [&::-webkit-details-marker]:hidden">
            <span>{item.summary}</span>
            <span
              aria-hidden="true"
              className="shrink-0 font-mono text-[0.875rem] text-[color:var(--vg-text-secondary)] transition-transform duration-[var(--vg-transition-fast)] group-open:rotate-180 motion-reduce:transition-none"
            >
              ▾
            </span>
          </summary>
          <div className="pb-4 pt-1 font-sans text-[0.875rem] leading-[1.45rem] text-[color:var(--vg-text-secondary)]">
            {item.body}
          </div>
        </details>
      ))}
    </div>
  );
}

const TROUBLESHOOTING_ITEMS: readonly DisclosureItem[] = [
  {
    id: "offline-after-registration",
    summary: "Station remains offline after registration",
    body: (
      <div className="space-y-2">
        <p>
          Registering a station creates its record in Station Service and immediately sets initial connectivity to Offline until the charger connects. Verify that the physical or simulated charger points its OCPP 2.0.1 WebSocket client to the station&apos;s{" "}
          <code className="font-mono text-[0.8125rem] text-[color:var(--vg-text-primary)]">
            /ocpp/&lt;stationId&gt;
          </code>{" "}
          path on your configured Station Service host using WebSocket subprotocol{" "}
          <code className="font-mono text-[0.8125rem] text-[color:var(--vg-text-primary)]">
            ocpp2.0.1
          </code>
          , then send a BootNotification and refresh the station page.
        </p>
        <p>
          <Link
            href="/stations?status=OFFLINE"
            className="font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:underline"
          >
            Inspect offline stations →
          </Link>
        </p>
      </div>
    ),
  },
  {
    id: "station-data-unavailable",
    summary: "Station data unavailable",
    body: (
      <p>
        When VoltGrid displays an error panel instead of station counts or records, Station Service could not be reached, timed out, or returned an unexpected response. Unavailable data is never turned into zero counts. Use the section Retry control or the top-bar Refresh data button after confirming Station Service is running.
      </p>
    ),
  },
  {
    id: "registration-disabled",
    summary: "Registration disabled",
    body: (
      <p>
        Add station writes are restricted to local write mode targeting a loopback Station Service endpoint. If the registration form is replaced by a Read-only console notice, station creation is intentionally blocked for this runtime configuration.
      </p>
    ),
  },
  {
    id: "registration-uncertain",
    summary: "Registration outcome uncertain",
    body: (
      <div className="space-y-2">
        <p>
          VoltGrid never automatically retries a station registration mutation. If a timeout or network interruption makes the outcome ambiguous, look up the submitted identifier in{" "}
          <Link
            href="/stations"
            className="font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:underline"
          >
            Charging stations
          </Link>{" "}
          before submitting again to avoid duplicate attempts or mistaken confirmation if an existing record has a different name.
        </p>
      </div>
    ),
  },
  {
    id: "no-matching-sessions",
    summary: "No matching sessions",
    body: (
      <div className="space-y-2">
        <p>
          In{" "}
          <Link
            href="/sessions"
            className="font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:underline"
          >
            Charging sessions
          </Link>
          , Station ID and Session ID filters perform exact, case-sensitive matches on the server, while the Active filter only narrows sessions already loaded on the current page. Clear active filters if a session exists under different casing or on another page.
        </p>
      </div>
    ),
  },
  {
    id: "incomplete-session-records",
    summary: "Incomplete session records",
    body: (
      <div className="space-y-2">
        <p>
          A session marked Missing data means Station Service observed gaps between received OCPP TransactionEvent sequence numbers. An Ended session can still have missing sequences. Open the session&apos;s Technical details section to inspect the first, last, and missing sequence numbers; late OCPP retransmissions may close gaps on subsequent refreshes.
        </p>
        <p>
          <Link
            href="/attention"
            className="font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:underline"
          >
            Review incomplete sessions in Needs attention →
          </Link>
        </p>
      </div>
    ),
  },
  {
    id: "measurement-data-unavailable",
    summary: "Measurement data unavailable",
    body: (
      <p>
        Session lookup, sequence completeness, and meter samples load independently. If Measurements reports an error while Overview still renders, only the meter-samples query failed—use Try again on the error panel. If Measurements shows an empty state, zero MeterValues samples were persisted for that session.
      </p>
    ),
  },
  {
    id: "projection-record-not-found",
    summary: "Projection record not found in Diagnostics",
    body: (
      <div className="space-y-2">
        <p>
          An absent record in{" "}
          <Link
            href="/diagnostics"
            className="font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:underline"
          >
            Diagnostics
          </Link>{" "}
          means Operations Service has not stored a projected status row for that station identifier—it does not prove the station is unregistered. Check{" "}
          <Link
            href="/stations"
            className="font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:underline"
          >
            Charging stations
          </Link>{" "}
          for the authoritative station record and allow time for outbox/Kafka status events to arrive if the station was just registered.
        </p>
      </div>
    ),
  },
];

const GETTING_STARTED_DESTINATIONS = [
  {
    href: "/",
    title: "Overview",
    summary:
      "Fleet-wide reported connectivity percentage, station counts, offline-first station preview, and Needs attention entry.",
  },
  {
    href: "/stations",
    title: "Charging stations",
    summary:
      "Search registered stations by name or identifier, filter by Online or Offline status, inspect connectors, and access station registration.",
  },
  {
    href: "/sessions",
    title: "Charging sessions",
    summary:
      "Server-paginated charging transactions with exact Station ID, Session ID, and Data completeness filtering.",
  },
  {
    href: "/attention",
    title: "Needs attention",
    summary:
      "Separate queues for offline charging stations and charging sessions with missing OCPP sequence records.",
  },
  {
    href: "/diagnostics",
    title: "Diagnostics",
    summary:
      "Asynchronous Operations Service station-status projection records with exact station lookup, status filter, and cursor pagination.",
  },
] as const;

const HELP_ANCHORS = [
  { id: "getting-started", label: "Getting started" },
  { id: "registering-and-connecting", label: "Registering & connecting" },
  { id: "understanding-stations", label: "Charging stations" },
  { id: "understanding-sessions", label: "Charging sessions" },
  { id: "understanding-measurements", label: "Measurements" },
  { id: "understanding-diagnostics", label: "Diagnostics" },
  { id: "troubleshooting", label: "Troubleshooting" },
] as const;

/**
 * Static server-rendered Help reference covering all implemented operator workflows,
 * telemetry semantics, and VoltGrid boundaries without backend dependencies or
 * fabricated support channels.
 */
export function HelpView() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Help"
        description="Learn how to use VoltGrid and understand your charging network."
      />

      <Card padding="md">
        <nav aria-label="Help topics">
          <ul className="flex flex-wrap gap-2">
            {HELP_ANCHORS.map(anchor => (
              <li key={anchor.id}>
                <a
                  href={`#${anchor.id}`}
                  className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3.5 py-2 font-sans text-[0.8125rem] font-semibold text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)] hover:text-[color:var(--vg-brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  {anchor.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </Card>

      <Card
        as="section"
        id="getting-started"
        aria-labelledby="help-getting-started-title"
        padding="md"
        className="scroll-mt-24"
      >
        <CardHeader className="mb-4">
          <div>
            <CardTitle id="help-getting-started-title">
              Getting started
            </CardTitle>
            <CardDescription>
              Navigate VoltGrid&apos;s workspace and support destinations by task.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GETTING_STARTED_DESTINATIONS.map(dest => (
            <div
              key={dest.href}
              className="flex flex-col justify-between gap-3 rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-4"
            >
              <div className="space-y-1">
                <h3 className="font-sans text-[0.9375rem] font-semibold text-[color:var(--vg-text-primary)]">
                  {dest.title}
                </h3>
                <p className="font-sans text-[0.8125rem] leading-[1.25rem] text-[color:var(--vg-text-secondary)]">
                  {dest.summary}
                </p>
              </div>
              <Link
                href={dest.href}
                className="inline-flex min-h-11 items-center gap-1 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
              >
                <span>Open {dest.title}</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          as="section"
          id="registering-and-connecting"
          aria-labelledby="help-register-title"
          padding="md"
          className="scroll-mt-24"
        >
          <CardHeader className="mb-3">
            <div>
              <CardTitle id="help-register-title">
                Registering and connecting a station
              </CardTitle>
              <CardDescription>
                Local-write rules, OCPP 2.0.1 path conventions, and safe verification.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 font-sans text-[0.875rem] leading-[1.45rem] text-[color:var(--vg-text-secondary)]">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-[color:var(--vg-text-primary)]">
                  Identifiers and names:
                </strong>{" "}
                Station identifiers must start with an alphanumeric character and use only letters, numbers, dots, underscores, colons, or hyphens (up to 255 characters). Display names require 1–255 trimmed characters.
              </li>
              <li>
                <strong className="text-[color:var(--vg-text-primary)]">
                  Local-write restriction:
                </strong>{" "}
                Creating stations via{" "}
                <Link
                  href="/stations/new"
                  className="font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:underline"
                >
                  Add station
                </Link>{" "}
                is permitted only when local operator writes are explicitly enabled against a loopback Station Service endpoint.
              </li>
              <li>
                <strong className="text-[color:var(--vg-text-primary)]">
                  Registration vs connection:
                </strong>{" "}
                Registration records the station ID in Station Service with initial status Offline. The charger becomes Online only after opening a WebSocket connection using subprotocol{" "}
                <code className="font-mono text-[0.8125rem] text-[color:var(--vg-text-primary)]">
                  ocpp2.0.1
                </code>{" "}
                to{" "}
                <code className="font-mono text-[0.8125rem] text-[color:var(--vg-text-primary)]">
                  /ocpp/&lt;stationId&gt;
                </code>{" "}
                on your provisioned Station Service host and sending a BootNotification.
              </li>
              <li>
                <strong className="text-[color:var(--vg-text-primary)]">
                  Finding connection details:
                </strong>{" "}
                Open any station&apos;s Connection details tab to copy its exact ID and OCPP path. This console does not invent or publish external gateway hostnames.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card
          as="section"
          id="understanding-stations"
          aria-labelledby="help-stations-title"
          padding="md"
          className="scroll-mt-24"
        >
          <CardHeader className="mb-3">
            <div>
              <CardTitle id="help-stations-title">
                Understanding charging stations
              </CardTitle>
              <CardDescription>
                Connectivity, connector states, EVSE identity, and charger illustrations.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 font-sans text-[0.875rem] leading-[1.45rem] text-[color:var(--vg-text-secondary)]">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-[color:var(--vg-text-primary)]">
                  Online vs Offline:
                </strong>{" "}
                Reflects Station Service&apos;s currently reported WebSocket connectivity, not historical uptime. Offline does not automatically establish a hardware failure.
              </li>
              <li>
                <strong className="text-[color:var(--vg-text-primary)]">
                  Connector statuses &amp; EVSE identity:
                </strong>{" "}
                Individual endpoints report Available, Occupied, Reserved, Unavailable, or Faulted under composite{" "}
                <code className="font-mono text-[0.8125rem] text-[color:var(--vg-text-primary)]">
                  EVSE · Connector
                </code>{" "}
                identifiers. Occupied alone does not prove an active charging transaction.
              </li>
              <li>
                <strong className="text-[color:var(--vg-text-primary)]">
                  Offline last-reported condition:
                </strong>{" "}
                When a station is offline, connector cards display their last-reported conditions saved before disconnection.
              </li>
            </ul>

            <Alert
              variant="info"
              announce="none"
              title="Generic charger illustrations"
            >
              Connector cards include generic light-industrial charger illustrations to reinforce connector status visually. These graphics do not represent actual hardware manufacturer, model, physical cabinet count, or site bay layout.
            </Alert>
          </CardContent>
        </Card>

        <Card
          as="section"
          id="understanding-sessions"
          aria-labelledby="help-sessions-title"
          padding="md"
          className="scroll-mt-24"
        >
          <CardHeader className="mb-3">
            <div>
              <CardTitle id="help-sessions-title">
                Understanding charging sessions
              </CardTitle>
              <CardDescription>
                Separate lifecycle state, telemetry completeness, and composite identity.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 font-sans text-[0.875rem] leading-[1.45rem] text-[color:var(--vg-text-secondary)]">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-[color:var(--vg-text-primary)]">
                  Lifecycle (Active vs Ended):
                </strong>{" "}
                Indicates whether Station Service has recorded a closing transaction event. An Active session has no duration yet because no stop timestamp exists.
              </li>
              <li>
                <strong className="text-[color:var(--vg-text-primary)]">
                  Completeness (Complete, In progress, Missing data, Unknown):
                </strong>{" "}
                Tracks OCPP TransactionEvent sequence receipt continuity independently of session lifecycle. An Ended session can still be flagged Missing data when intermediate sequence numbers never arrived.
              </li>
              <li>
                <strong className="text-[color:var(--vg-text-primary)]">
                  Composite identity:
                </strong>{" "}
                Every session is uniquely keyed by{" "}
                <code className="font-mono text-[0.8125rem] text-[color:var(--vg-text-primary)]">
                  (stationId, transactionId)
                </code>{" "}
                so identical transaction IDs from different chargers remain distinct.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card
          as="section"
          id="understanding-measurements"
          aria-labelledby="help-measurements-title"
          padding="md"
          className="scroll-mt-24"
        >
          <CardHeader className="mb-3">
            <div>
              <CardTitle id="help-measurements-title">
                Understanding measurements
              </CardTitle>
              <CardDescription>
                Recorded meter telemetry, stream separation, registers, and missing intervals.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 font-sans text-[0.875rem] leading-[1.45rem] text-[color:var(--vg-text-secondary)]">
            <p>
              Session charts show persisted OCPP MeterValues already stored by Station Service—they do not stream live telemetry.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-[color:var(--vg-text-primary)]">
                  Compatible streams:
                </strong>{" "}
                Samples are grouped strictly by measurand, unit, phase, location, and sampling context so distinct electrical signals never mix on one curve.
              </li>
              <li>
                <strong className="text-[color:var(--vg-text-primary)]">
                  Cumulative energy registers:
                </strong>{" "}
                Register readings (such as Energy.Active.Import.Register) track the meter&apos;s cumulative running counter at each sample time—not instantaneous charging power and not a derived net energy total.
              </li>
              <li>
                <strong className="text-[color:var(--vg-text-primary)]">
                  Missing periods stay blank:
                </strong>{" "}
                Chart lines break across documented OCPP sequence gaps rather than inventing zeros or interpolating missing intervals.
              </li>
            </ul>

            <DisclosureList
              items={[
                {
                  id: "unit-multipliers-technical",
                  summary: "Technical note: unit multipliers and raw samples",
                  body: (
                    <p>
                      OCPP samples store a string decimal value and integer{" "}
                      <code className="font-mono text-[0.8125rem] text-[color:var(--vg-text-primary)]">
                        unitMultiplier
                      </code>{" "}
                      representing{" "}
                      <code className="font-mono text-[0.8125rem] text-[color:var(--vg-text-primary)]">
                        value × 10^unitMultiplier
                      </code>{" "}
                      in the reported unit. VoltGrid applies the multiplier once for normalized display while keeping every unmodified raw reading (including unplottable entries) in the Raw recorded samples table.
                    </p>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card
        as="section"
        id="understanding-diagnostics"
        aria-labelledby="help-diagnostics-title"
        padding="md"
        className="scroll-mt-24"
      >
        <CardHeader className="mb-3">
          <div>
            <CardTitle id="help-diagnostics-title">
              Understanding diagnostics
            </CardTitle>
            <CardDescription>
              Authoritative Station Service data vs asynchronous Operations Service projections.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 font-sans text-[0.875rem] leading-[1.45rem] text-[color:var(--vg-text-secondary)]">
          <p>
            VoltGrid separates operational writes and connectivity in Station Service from the event-driven read model maintained by Operations Service over a transactional outbox and Kafka pipeline.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-[color:var(--vg-text-primary)]">
                Why statuses can differ:
              </strong>{" "}
              <Link
                href="/diagnostics"
                className="font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:underline"
              >
                Diagnostics
              </Link>{" "}
              reads the asynchronous Operations projection. During recent connect/disconnect events or backlog, its projected state may lag behind{" "}
              <Link
                href="/stations"
                className="font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:underline"
              >
                Charging stations
              </Link>
              .
            </li>
            <li>
              <strong className="text-[color:var(--vg-text-primary)]">
                Scope limit:
              </strong>{" "}
              Diagnostics inspects projected station status records and their last event identifiers—it does not inspect Kafka broker metrics, database health, outbox queues, or trigger projection repair.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card
        as="section"
        id="troubleshooting"
        aria-labelledby="help-troubleshooting-title"
        padding="md"
        className="scroll-mt-24"
      >
        <CardHeader className="mb-2">
          <div>
            <CardTitle id="help-troubleshooting-title">
              Troubleshooting
            </CardTitle>
            <CardDescription>
              Expand a scenario below for supported investigation steps inside VoltGrid.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <DisclosureList items={TROUBLESHOOTING_ITEMS} />
        </CardContent>
      </Card>
    </div>
  );
}
