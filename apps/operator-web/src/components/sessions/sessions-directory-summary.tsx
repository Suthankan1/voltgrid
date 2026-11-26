import { MetricCard } from "@/components/ui/metric-card";
import type { SessionsDirectoryModel } from "@/lib/sessions-directory-model";

export interface SessionsDirectorySummaryProps {
  model: SessionsDirectoryModel;
}

/**
 * High-level session summary metrics derived strictly from validated
 * server totals and explicit page scope—never fabricated globals or financials.
 */
export function SessionsDirectorySummary({
  model,
}: SessionsDirectorySummaryProps) {
  const isLive = model.availability === "live";
  const { pagination } = model;

  const pageScopeValue = !isLive
    ? null
    : model.rows.length > 0
      ? `${pagination.rangeStart}–${pagination.rangeEnd}`
      : "0";

  const pageScopeDescription = !isLive
    ? "Server pagination unavailable"
    : pagination.displayTotalPages > 0
      ? `Page ${pagination.displayPage} of ${pagination.displayTotalPages} (${model.filters.size} per page)`
      : "No pages in current filter scope";

  return (
    <section
      aria-label="Charging session summary"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <MetricCard
        label={model.hasActiveFilters ? "Matching sessions" : "Recorded sessions"}
        value={model.totalMatchingSessions}
        description={
          !isLive
            ? "Station Service total unavailable"
            : model.hasActiveFilters
              ? "Server-filtered match total"
              : "Total recorded across network history"
        }
      />

      <MetricCard
        label="Missing data (network-wide)"
        value={model.networkMissingDataCount}
        description="Unfiltered sessions with INCOMPLETE receipts"
        href={
          model.networkMissingDataCount !== null &&
          model.networkMissingDataCount > 0 &&
          !(
            model.filters.integrityStatus === "INCOMPLETE" &&
            !model.filters.stationId &&
            !model.filters.transactionId
          )
            ? "/sessions?integrityStatus=INCOMPLETE"
            : undefined
        }
        linkLabel="Inspect missing-data sessions"
      />

      <MetricCard
        label="Server page scope"
        value={pageScopeValue}
        description={pageScopeDescription}
      />
    </section>
  );
}
