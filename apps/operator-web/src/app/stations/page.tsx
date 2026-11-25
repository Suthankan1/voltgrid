import { StationsDirectoryHeader } from "@/components/stations/stations-directory-header";
import { StationsDirectorySummary } from "@/components/stations/stations-directory-summary";
import { StationsDirectoryView } from "@/components/stations/stations-directory-view";
import { ErrorState } from "@/components/ui/error-state";
import { getStationSnapshot } from "@/lib/station-api";
import { localRegistrationEnabled } from "@/lib/station-registration";
import {
  buildStationsDirectoryModel,
  formatUtcRetrievalTime,
  normalizeStationDirectoryFilters,
} from "@/lib/stations-directory-model";

export const dynamic = "force-dynamic";

export default async function StationsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const filters = normalizeStationDirectoryFilters(params);
  const snapshot = await getStationSnapshot();
  const registrationEnabled = localRegistrationEnabled();
  const retrievedAtIso =
    snapshot.state === "live" ? new Date().toISOString() : null;
  const model = buildStationsDirectoryModel(snapshot, filters, {
    retrievedAtIso,
  });
  const formattedRetrievedAt = model.retrievedAtIso
    ? formatUtcRetrievalTime(model.retrievedAtIso)
    : null;

  return (
    <div className="space-y-6">
      <StationsDirectoryHeader registrationEnabled={registrationEnabled} />
      <StationsDirectorySummary model={model} />
      <StationsDirectoryView
        model={model}
        registrationEnabled={registrationEnabled}
        errorFallback={
          model.errorMessage ? (
            <ErrorState
              headingAs="h3"
              title="Unable to load charging stations"
              message={model.errorMessage}
              guidance="Check that Station Service is running, then refresh this page."
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
