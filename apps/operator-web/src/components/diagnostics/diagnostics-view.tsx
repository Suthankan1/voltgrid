import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { DiagnosticsPresentationModel } from "@/lib/diagnostics-model";
import { DiagnosticsControls } from "./diagnostics-controls";
import { DiagnosticsRecords } from "./diagnostics-records";
import { DiagnosticsErrorState } from "./diagnostics-states";

export interface DiagnosticsViewProps {
  model: DiagnosticsPresentationModel;
}

/**
 * Diagnostics view displaying Operations Service asynchronous station-status
 * projection records, exact single-station lookup, cursor pagination, and
 * explicit asynchronous caveat without global counts or infrastructure claims.
 */
export function DiagnosticsView({ model }: DiagnosticsViewProps) {
  const scopeSummary =
    model.availability === "unavailable"
      ? "Unavailable"
      : model.availability === "not-found"
        ? "0 matching records"
        : model.mode === "station-lookup"
          ? "1 exact lookup record"
          : `${model.records.length} ${model.records.length === 1 ? "station" : "stations"} on this page`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diagnostics"
        description="Inspect recorded operational status information."
      />

      <Alert variant="info" announce="none" title="Asynchronous status projection">
        The Operations Service maintains an asynchronous station-status projection. Its records may differ from the authoritative Station Service connectivity snapshot. &ldquo;Projection updated&rdquo; records when Operations Service saved the projection row — not a station heartbeat, Kafka publish time, or network latency measurement.
      </Alert>

      <DiagnosticsControls
        filters={model.filters}
        hasActiveFilters={model.hasActiveFilters}
      />

      <Card
        as="section"
        aria-labelledby="diagnostics-records-title"
        padding="none"
        className="overflow-hidden"
      >
        <div className="border-b border-[color:var(--vg-border)] p-5 sm:p-6">
          <CardHeader>
            <div className="min-w-0 flex-1">
              <CardTitle id="diagnostics-records-title">
                Operational projection records
              </CardTitle>
              <CardDescription>
                {model.mode === "station-lookup"
                  ? `Direct stationStatus projection lookup for identifier ${model.filters.stationId}.`
                  : "Ordered ascending by station identifier via cursor pagination."}
              </CardDescription>
            </div>
            <div className="space-y-0.5 text-left sm:text-right">
              <p className="font-sans text-[0.8125rem] font-semibold text-[color:var(--vg-text-primary)]">
                {scopeSummary}
              </p>
              {model.retrievedAtUtc ? (
                <p className="font-mono text-[0.75rem] text-[color:var(--vg-text-secondary)]">
                  Retrieved {model.retrievedAtUtc}
                </p>
              ) : null}
            </div>
          </CardHeader>
        </div>

        {model.availability === "unavailable" ? (
          <div className="p-5 sm:p-6">
            <DiagnosticsErrorState
              message={
                model.errorMessage ??
                "Operations data could not be loaded. Try again shortly."
              }
              invalidCursor={model.invalidCursor}
              firstPageHref={model.firstPageHref}
            />
          </div>
        ) : model.availability === "not-found" ? (
          <div className="p-5 sm:p-6">
            <EmptyState
              headingAs="h3"
              kind="no-matches"
              title="No projection record found for this station"
              description={`Operations Service has no projected status record for station identifier ${model.filters.stationId}. This does not mean the station is unregistered in Station Service; it may not yet have processed status events.`}
              action={
                <Link
                  href={model.clearFiltersHref}
                  className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-4 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  View all projection records
                </Link>
              }
            />
          </div>
        ) : model.records.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState
              headingAs="h3"
              kind={model.hasActiveFilters || model.filters.after ? "no-matches" : "empty"}
              title={
                model.hasActiveFilters
                  ? "No projection records match the selected status"
                  : "No operational status records available"
              }
              description={
                model.hasActiveFilters
                  ? "No projected station status records matched the active Operations status filter on this page."
                  : "Operations Service returned zero projected status records. This does not imply zero stations are registered in Station Service."
              }
              action={
                model.hasActiveFilters || model.filters.after ? (
                  <Link
                    href={model.clearFiltersHref}
                    className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-4 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                  >
                    Reset filters
                  </Link>
                ) : null
              }
            />
          </div>
        ) : (
          <DiagnosticsRecords model={model} />
        )}
      </Card>
    </div>
  );
}
