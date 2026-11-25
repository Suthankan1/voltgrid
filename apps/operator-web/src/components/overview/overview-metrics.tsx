import { MetricCard } from "@/components/ui/metric-card";
import type { OverviewPresentationModel } from "@/lib/overview-model";

function StationsIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
      <rect x="4" y="3" width="9" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 6.5h4M13 8.5h2a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-3 0v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 17h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function OnlineIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" className="text-[color:var(--vg-success)]">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path d="m7 10.25 2.1 2.1 4-4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OfflineIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" className="text-[color:var(--vg-neutral)]">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 10h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export interface OverviewMetricsProps {
  model: OverviewPresentationModel;
}

/**
 * Three primary network metric cards derived from the full Station Service snapshot.
 * Links target existing filtered views on `/` until UI-104 introduces `/stations`.
 */
export function OverviewMetrics({ model }: OverviewMetricsProps) {
  const isLive = model.availability === "live";
  const hasStations = isLive && (model.totalStations ?? 0) > 0;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <MetricCard
        label="Total stations"
        value={model.totalStations}
        icon={<StationsIcon />}
        description={
          isLive
            ? "Registered in Station Service"
            : "Authoritative snapshot unavailable"
        }
        href={hasStations ? "/#stations" : undefined}
        linkLabel="Browse stations"
      />
      <MetricCard
        label="Online"
        value={model.onlineStations}
        icon={<OnlineIcon />}
        description={
          isLive
            ? "Currently reported connected"
            : "Authoritative snapshot unavailable"
        }
        href={
          isLive && (model.onlineStations ?? 0) > 0
            ? "/?status=ONLINE#stations"
            : undefined
        }
        linkLabel="View online stations"
      />
      <MetricCard
        label="Offline"
        value={model.offlineStations}
        icon={<OfflineIcon />}
        description={
          isLive
            ? "Currently reported disconnected"
            : "Authoritative snapshot unavailable"
        }
        href={
          isLive && (model.offlineStations ?? 0) > 0
            ? "/?status=OFFLINE#stations"
            : undefined
        }
        linkLabel="Inspect offline stations"
      />
    </div>
  );
}
