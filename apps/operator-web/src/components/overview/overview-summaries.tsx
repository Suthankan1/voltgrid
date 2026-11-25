import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusIndicator } from "@/components/ui/status-indicator";
import type { OverviewPresentationModel } from "@/lib/overview-model";

export interface OverviewSummariesProps {
  model: OverviewPresentationModel;
}

/**
 * Network connectivity bar and Needs attention summary derived from the full Station snapshot.
 */
export function OverviewSummaries({ model }: OverviewSummariesProps) {
  const isLive = model.availability === "live";
  const total = model.totalStations ?? 0;
  const online = model.onlineStations ?? 0;
  const offline = model.offlineStations ?? 0;
  const percent = model.connectivityPercent;

  const connectivityLabel = !isLive
    ? "Unknown"
    : percent === null
      ? "N/A"
      : `${percent}%`;

  const connectivityAriaLabel = !isLive
    ? "Current station connectivity is unknown because Station Service is unavailable."
    : percent === null
      ? "Current station connectivity is not applicable because zero stations are registered."
      : `${percent}% current station connectivity: ${online} of ${total} stations online.`;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card as="section" aria-labelledby="connectivity-summary-title">
        <CardHeader>
          <div>
            <CardTitle id="connectivity-summary-title">
              Network connectivity
            </CardTitle>
            <CardDescription>
              Current reported station connectivity, not historical uptime or overall network health.
            </CardDescription>
          </div>
          <span
            className={`font-sans text-[1.5rem] font-bold leading-[2rem] tabular-nums ${
              isLive && percent !== null
                ? "text-[color:var(--vg-text-primary)]"
                : "text-[color:var(--vg-text-secondary)]"
            }`}
          >
            {connectivityLabel}
          </span>
        </CardHeader>

        <CardContent>
          <div
            role="img"
            aria-label={connectivityAriaLabel}
            className="h-3 w-full overflow-hidden rounded-full bg-[color:var(--vg-neutral-soft)]"
          >
            {isLive && percent !== null && total > 0 ? (
              <div
                className="h-full rounded-full bg-[color:var(--vg-success)] transition-[width] duration-[var(--vg-transition-normal)] motion-reduce:transition-none"
                style={{ width: `${percent}%` }}
              />
            ) : null}
          </div>

          <p className="mt-3 font-sans text-[0.8125rem] leading-[1.25rem] text-[color:var(--vg-text-secondary)]">
            {!isLive
              ? "Connectivity cannot be calculated while Station Service is unavailable."
              : percent === null
                ? "No stations are registered yet; connectivity is not applicable."
                : `${online} of ${total} registered ${total === 1 ? "station is" : "stations are"} currently reported online.`}
          </p>
        </CardContent>
      </Card>

      <Card as="section" aria-labelledby="attention-summary-title">
        <CardHeader>
          <div>
            <CardTitle id="attention-summary-title">
              Needs attention
            </CardTitle>
            <CardDescription>
              Reported connectivity anomalies requiring operator review.
            </CardDescription>
          </div>
          {model.conditionKind === "unavailable" ? (
            <StatusIndicator tone="warning" label="Status unknown" size="sm" />
          ) : model.conditionKind === "empty" ? (
            <StatusIndicator tone="neutral" label="No stations" size="sm" />
          ) : model.conditionKind === "attention" ? (
            <StatusIndicator
              tone="neutral"
              label={
                offline > 0
                  ? `${offline} offline`
                  : `${model.unknownStatusStations ?? 0} unknown`
              }
              size="sm"
            />
          ) : (
            <StatusIndicator tone="success" label="All stations online" size="sm" />
          )}
        </CardHeader>

        <CardContent>
          {model.conditionKind === "unavailable" ? (
            <div className="space-y-3">
              <p className="font-sans text-[0.875rem] leading-[1.375rem] text-[color:var(--vg-text-secondary)]">
                Station connectivity could not be verified while Station Service is unavailable.
              </p>
              <Link
                href="/attention"
                className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-sm)] font-sans text-[0.875rem] font-semibold leading-[1.25rem] text-[color:var(--vg-brand)] underline-offset-4 hover:text-[color:var(--vg-brand-hover)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
              >
                <span>Open Needs attention</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : model.conditionKind === "empty" ? (
            <div className="space-y-3">
              <p className="font-sans text-[0.875rem] leading-[1.375rem] text-[color:var(--vg-text-secondary)]">
                No charging stations are registered yet.
              </p>
              <Link
                href="/attention"
                className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-sm)] font-sans text-[0.875rem] font-semibold leading-[1.25rem] text-[color:var(--vg-brand)] underline-offset-4 hover:text-[color:var(--vg-brand-hover)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
              >
                <span>Open Needs attention</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : model.conditionKind === "attention" ? (
            <div className="space-y-3">
              <p className="font-sans text-[0.875rem] leading-[1.375rem] text-[color:var(--vg-text-primary)]">
                {offline > 0
                  ? `${offline} ${offline === 1 ? "station is" : "stations are"} currently reported offline. Disconnection does not establish a physical equipment fault.`
                  : "One or more stations reported an unrecognized status."}
              </p>
              <div className="flex flex-wrap items-center gap-4">
                {offline > 0 ? (
                  <Link
                    href="/stations?status=OFFLINE"
                    className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-sm)] font-sans text-[0.875rem] font-semibold leading-[1.25rem] text-[color:var(--vg-brand)] underline-offset-4 hover:text-[color:var(--vg-brand-hover)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                  >
                    <span>Inspect offline stations</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                ) : null}
                <Link
                  href="/attention"
                  className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-sm)] font-sans text-[0.875rem] font-semibold leading-[1.25rem] text-[color:var(--vg-brand)] underline-offset-4 hover:text-[color:var(--vg-brand-hover)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  <span>Open Needs attention</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="font-sans text-[0.875rem] leading-[1.375rem] text-[color:var(--vg-text-secondary)]">
                Every registered station is currently reported online. Open Needs attention to check incomplete sessions, or open individual stations to inspect connector states.
              </p>
              <Link
                href="/attention"
                className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-sm)] font-sans text-[0.875rem] font-semibold leading-[1.25rem] text-[color:var(--vg-brand)] underline-offset-4 hover:text-[color:var(--vg-brand-hover)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
              >
                <span>Open Needs attention</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
