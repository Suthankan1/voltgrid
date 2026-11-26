import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SessionsDirectoryHeader } from "@/components/sessions/sessions-directory-header";
import {
  SessionsDirectoryErrorState,
  SessionsDirectoryLoading,
} from "@/components/sessions/sessions-directory-states";
import { SessionsDirectorySummary } from "@/components/sessions/sessions-directory-summary";
import { SessionsDirectoryView } from "@/components/sessions/sessions-directory-view";
import {
  buildSessionsDirectoryHref,
  buildSessionsDirectoryModel,
  buildVerifiedStationNameMap,
  normalizeSessionsDirectoryFilters,
  type RawSessionsSearchParams,
  type SessionsDirectoryFilters,
} from "@/lib/sessions-directory-model";
import {
  getNetworkTransactionPage,
  getStationSnapshot,
} from "@/lib/station-api";

export const dynamic = "force-dynamic";

async function SessionsDirectoryContent({
  filters,
}: {
  filters: SessionsDirectoryFilters;
}) {
  const needsMissingSummaryQuery = !(
    filters.stationId === null &&
    filters.transactionId === null &&
    filters.integrityStatus === "INCOMPLETE"
  );

  const [pageSnapshot, stationSnapshot, missingDataSnapshot] = await Promise.all([
    getNetworkTransactionPage(filters.page, filters.size, {
      stationId: filters.stationId ?? undefined,
      transactionId: filters.transactionId ?? undefined,
      integrityStatus: filters.integrityStatus ?? undefined,
    }),
    getStationSnapshot(),
    needsMissingSummaryQuery
      ? getNetworkTransactionPage(0, 1, { integrityStatus: "INCOMPLETE" })
      : Promise.resolve(null),
  ]);

  const retrievedAtIso =
    pageSnapshot.state === "live" ? new Date().toISOString() : null;

  const model = buildSessionsDirectoryModel(pageSnapshot, filters, {
    stationNames: buildVerifiedStationNameMap(stationSnapshot),
    networkMissingDataSnapshot: missingDataSnapshot,
    retrievedAtIso,
  });

  if (model.availability === "live" && model.pagination.isOutOfRange) {
    redirect(
      buildSessionsDirectoryHref({
        ...filters,
        page: model.pagination.clampedPage,
      }),
    );
  }

  return (
    <div className="space-y-6">
      <SessionsDirectoryHeader />
      <SessionsDirectorySummary model={model} />
      <SessionsDirectoryView
        key={model.selfHref}
        model={model}
        errorFallback={
          model.errorMessage ? (
            <SessionsDirectoryErrorState message={model.errorMessage} />
          ) : null
        }
      />

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--vg-border)] pt-4 font-sans text-[0.75rem] leading-[1.125rem] text-[color:var(--vg-text-secondary)]">
        <span>
          {model.retrievedAtUtc
            ? `Retrieved ${model.retrievedAtUtc} · Reflects when Station Service was queried, not session start or end timestamps.`
            : "Station Service unavailable · No retrieval timestamp recorded."}
        </span>
        <span>Authoritative source: Station Service</span>
      </footer>
    </div>
  );
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<RawSessionsSearchParams>;
}) {
  const params = await searchParams;
  const filters = normalizeSessionsDirectoryFilters(params);

  return (
    <Suspense fallback={<SessionsDirectoryLoading />}>
      <SessionsDirectoryContent filters={filters} />
    </Suspense>
  );
}
