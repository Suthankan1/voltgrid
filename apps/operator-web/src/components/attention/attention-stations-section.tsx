import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StationStatusIndicator } from "@/components/ui/status-indicator";
import type { AttentionStationsSectionModel } from "@/lib/attention-model";
import { AttentionRetryState } from "./attention-states";

export interface AttentionStationsSectionProps {
  section: AttentionStationsSectionModel;
}

/**
 * Offline station investigation queue derived from the authoritative full
 * Station Service connectivity snapshot.
 */
export function AttentionStationsSection({
  section,
}: AttentionStationsSectionProps) {
  return (
    <Card
      as="section"
      aria-labelledby="attention-stations-title"
      padding="none"
      className="flex flex-col overflow-hidden"
    >
      <div className="border-b border-[color:var(--vg-border)] p-5 sm:p-6">
        <CardHeader>
          <div className="min-w-0 flex-1">
            <CardTitle id="attention-stations-title">
              Offline stations
            </CardTitle>
            <CardDescription>
              Registered stations currently reported offline. Disconnection alone does not prove a physical fault or connector failure.
            </CardDescription>
          </div>
          <p className="font-sans text-[0.8125rem] font-medium tabular-nums text-[color:var(--vg-text-secondary)]">
            {section.availability === "unavailable"
              ? "Unavailable"
              : `${section.offlineCount} offline`}
          </p>
        </CardHeader>
      </div>

      {section.availability === "unavailable" ? (
        <div className="p-5 sm:p-6">
          <AttentionRetryState
            headingAs="h3"
            title="Unable to load station connectivity"
            message={section.errorMessage}
          />
        </div>
      ) : section.items.length === 0 ? (
        <div className="p-5 sm:p-6">
          <EmptyState
            headingAs="h3"
            kind="empty"
            title="No offline stations reported"
            description={
              section.unknownStatusCount > 0
                ? `${section.registeredCount} stations checked; ${section.unknownStatusCount} reported an unrecognized status.`
                : section.registeredCount === 0
                  ? "No charging stations are currently registered."
                  : `All ${section.registeredCount} registered ${section.registeredCount === 1 ? "station is" : "stations are"} currently reported online.`
            }
          />
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--vg-border)]">
          {section.items.map(item => (
            <li
              key={item.station.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StationStatusIndicator
                    status={item.station.status}
                    size="sm"
                  />
                  <Link
                    href={item.href}
                    className="min-w-0 break-words font-sans text-[0.9375rem] font-semibold text-[color:var(--vg-text-primary)] underline-offset-4 hover:text-[color:var(--vg-brand)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                  >
                    {item.station.name}
                  </Link>
                </div>
                <p className="break-all font-mono text-[0.75rem] text-[color:var(--vg-text-secondary)]">
                  ID: {item.station.id}
                </p>
              </div>

              <Link
                href={item.href}
                aria-label={`Inspect offline station ${item.station.name}`}
                className="inline-flex min-h-11 max-w-full flex-wrap items-center gap-1 rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3.5 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)] transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
              >
                <span>Inspect</span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] px-5 py-3.5 sm:px-6">
        <p className="font-sans text-[0.75rem] text-[color:var(--vg-text-secondary)]">
          {section.availability === "live" && section.hasMore
            ? `Showing ${section.items.length} of ${section.offlineCount} offline stations.`
            : "Connector faults appear within individual station details."}
        </p>
        <Link
          href="/stations?status=OFFLINE"
          className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-md)] px-2.5 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:bg-[color:var(--vg-brand-soft)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
        >
          <span>View all offline stations</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </Card>
  );
}
