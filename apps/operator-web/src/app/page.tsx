import { OverviewHeader } from "@/components/overview/overview-header";
import { OverviewMetrics } from "@/components/overview/overview-metrics";
import { OverviewStationPreview } from "@/components/overview/overview-station-preview";
import { OverviewSummaries } from "@/components/overview/overview-summaries";
import { ErrorState } from "@/components/ui/error-state";
import {
  buildOverviewModel,
  formatUtcRetrievalTime,
  normalizeOverviewFilters,
} from "@/lib/overview-model";
import { getStationSnapshot } from "@/lib/station-api";
import { localRegistrationEnabled } from "@/lib/station-registration";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    all?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const filters = normalizeOverviewFilters(params);
  const snapshot = await getStationSnapshot();
  const registrationEnabled = localRegistrationEnabled();
  const retrievedAtIso =
    snapshot.state === "live" ? new Date().toISOString() : null;
  const model = buildOverviewModel(snapshot, filters, { retrievedAtIso });
  const formattedRetrievedAt = model.retrievedAtIso
    ? formatUtcRetrievalTime(model.retrievedAtIso)
    : null;

  return (
    <div className="space-y-6">
      <OverviewHeader registrationEnabled={registrationEnabled} />
      <OverviewMetrics model={model} />
      <OverviewSummaries model={model} />
      <OverviewStationPreview
        model={model}
        registrationEnabled={registrationEnabled}
        errorFallback={
          model.errorMessage ? (
            <ErrorState
              headingAs="h3"
              title="Unable to load network overview"
              message={model.errorMessage}
              guidance="Check that Station Service is running, then use Refresh data in the top bar."
            />
          ) : null
        }
      />

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--vg-border)] pt-4 font-sans text-[0.75rem] leading-[1.125rem] text-[color:var(--vg-text-secondary)]">
        <span>
          {formattedRetrievedAt
            ? `Retrieved ${formattedRetrievedAt} · Reflects when Station Service was queried, not station heartbeat.`
            : "Station Service unavailable · No retrieval timestamp recorded."}
        </span>
        <span>Authoritative source: Station Service</span>
      </footer>
    </div>
  );
}
