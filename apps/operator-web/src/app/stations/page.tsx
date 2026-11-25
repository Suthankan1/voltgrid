import { Suspense } from "react";
import { StationsDirectoryErrorState } from "@/components/stations/stations-directory-error-state";
import { StationsDirectoryHeader } from "@/components/stations/stations-directory-header";
import { StationsDirectoryLoading } from "@/components/stations/stations-directory-loading";
import { StationsDirectorySummary } from "@/components/stations/stations-directory-summary";
import { StationsDirectoryView } from "@/components/stations/stations-directory-view";
import { getStationSnapshot } from "@/lib/station-api";
import { localRegistrationEnabled } from "@/lib/station-registration";
import {
  buildStationsDirectoryModel,
  formatUtcRetrievalTime,
  normalizeStationDirectoryFilters,
  type StationDirectoryFilters,
} from "@/lib/stations-directory-model";

export const dynamic = "force-dynamic";

async function StationsDirectoryContent({
  filters,
}: {
  filters: StationDirectoryFilters;
}) {
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
            <StationsDirectoryErrorState message={model.errorMessage} />
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

  return (
    <Suspense fallback={<StationsDirectoryLoading />}>
      <StationsDirectoryContent filters={filters} />
    </Suspense>
  );
}
