import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { StationConnectionSection } from "@/components/stations/station-connection-section";
import { StationConnectorsSection } from "@/components/stations/station-connectors-section";
import { StationDetailHeader } from "@/components/stations/station-detail-header";
import { StationDetailRetryState } from "@/components/stations/station-detail-retry-state";
import { StationOverviewSection } from "@/components/stations/station-overview-section";
import { StationSessionsSection } from "@/components/stations/station-sessions-section";
import { decodePathIdentifier } from "@/lib/path-identifier";
import { sanitizeStationsReturnPath } from "@/lib/routes";
import { getStationPageData } from "@/lib/station-api";
import {
  buildStationDetailModel,
  normalizeStationDetailSection,
} from "@/lib/station-detail-model";

export const dynamic = "force-dynamic";

export default async function StationPage({
  params,
  searchParams,
}: {
  params: Promise<{
    stationId: string;
  }>;
  searchParams?: Promise<{
    section?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  const { stationId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const returnPath = sanitizeStationsReturnPath(
    resolvedSearchParams?.returnTo,
  );
  const activeSection = normalizeStationDetailSection(
    resolvedSearchParams?.section,
  );

  const decodedStationId = decodePathIdentifier(stationId);
  if (decodedStationId === null) {
    notFound();
  }

  const pageData = await getStationPageData(decodedStationId);

  if (pageData.state === "not-found") {
    notFound();
  }

  if (pageData.state === "unavailable") {
    const backHref = returnPath ?? "/stations";
    return (
      <div className="space-y-6">
        <div>
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--vg-radius-md)] px-2 py-1.5 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:bg-[color:var(--vg-brand-soft)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
          >
            ← Back to charging stations
          </Link>
        </div>

        <PageHeader
          title="Station record unavailable"
          description="Station Service data could not be loaded for this identifier."
        />

        <StationDetailRetryState
          headingAs="h2"
          title="Unable to load station details"
          message={pageData.message}
        />
      </div>
    );
  }

  const retrievedAtIso = new Date().toISOString();
  const model = buildStationDetailModel(pageData, {
    section: activeSection,
    returnPath,
    retrievedAtIso,
  });

  return (
    <div className="space-y-6">
      <StationDetailHeader model={model} />

      {model.activeSection === "connectors" ? (
        <StationConnectorsSection model={model} />
      ) : model.activeSection === "sessions" ? (
        <StationSessionsSection model={model} />
      ) : model.activeSection === "connection" ? (
        <StationConnectionSection model={model} />
      ) : (
        <StationOverviewSection model={model} />
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--vg-border)] pt-4 font-sans text-[0.75rem] leading-[1.125rem] text-[color:var(--vg-text-secondary)]">
        <span>
          {model.retrievedAtUtc
            ? `Retrieved ${model.retrievedAtUtc} · Reflects when Station Service was queried, separate from station heartbeat and connector timestamps.`
            : "Authoritative station record loaded without a formatted retrieval timestamp."}
        </span>
        <span>Authoritative source: Station Service</span>
      </footer>
    </div>
  );
}
