import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OverviewErrorState } from "@/components/overview/overview-error-state";
import { OverviewHeader } from "@/components/overview/overview-header";
import { OverviewLoading } from "@/components/overview/overview-loading";
import { OverviewMetrics } from "@/components/overview/overview-metrics";
import { OverviewStationPreview } from "@/components/overview/overview-station-preview";
import { OverviewSummaries } from "@/components/overview/overview-summaries";
import {
  buildOverviewModel,
  formatUtcRetrievalTime,
} from "@/lib/overview-model";
import { getStationSnapshot } from "@/lib/station-api";
import { localRegistrationEnabled } from "@/lib/station-registration";
import { resolveLegacyOverviewRedirectTarget } from "@/lib/stations-directory-model";

export const dynamic = "force-dynamic";

async function OverviewContent() {
  const snapshot = await getStationSnapshot();
  const registrationEnabled = localRegistrationEnabled();
  const retrievedAtIso =
    snapshot.state === "live" ? new Date().toISOString() : null;
  const model = buildOverviewModel(snapshot, { retrievedAtIso });
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
            <OverviewErrorState message={model.errorMessage} />
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
  const legacyRedirect = resolveLegacyOverviewRedirectTarget(params);
  if (legacyRedirect) {
    redirect(legacyRedirect);
  }

  return (
    <Suspense fallback={<OverviewLoading />}>
      <OverviewContent />
    </Suspense>
  );
}
