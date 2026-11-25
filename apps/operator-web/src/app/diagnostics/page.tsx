import { DiagnosticsView } from "@/components/diagnostics/diagnostics-view";
import {
  buildDiagnosticsModel,
  normalizeDiagnosticsParams,
  type RawDiagnosticsSearchParams,
} from "@/lib/diagnostics-model";
import {
  getDiagnosticsPage,
  getStationOperationalStatus,
} from "@/lib/operations-api";

export const dynamic = "force-dynamic";

export default async function DiagnosticsPage({
  searchParams,
}: {
  searchParams: Promise<RawDiagnosticsSearchParams>;
}) {
  const resolved = await searchParams;
  const filters = normalizeDiagnosticsParams(resolved);
  const retrievedAtIso = new Date().toISOString();

  const source = filters.stationId
    ? {
        mode: "station-lookup" as const,
        snapshot: await getStationOperationalStatus(filters.stationId),
      }
    : {
        mode: "cursor-page" as const,
        snapshot: await getDiagnosticsPage({
          after: filters.after ?? undefined,
          status: filters.status || undefined,
        }),
      };

  const model = buildDiagnosticsModel(filters, source, { retrievedAtIso });

  return <DiagnosticsView model={model} />;
}
