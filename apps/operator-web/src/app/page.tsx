import Link from "next/link";

import { OverviewHeader } from "@/components/overview/overview-header";
import { OverviewMetrics } from "@/components/overview/overview-metrics";
import { OverviewSummaries } from "@/components/overview/overview-summaries";
import {
  buildOverviewModel,
  normalizeOverviewFilters,
} from "@/lib/overview-model";
import { getStationSnapshot } from "@/lib/station-api";
import { localRegistrationEnabled } from "@/lib/station-registration";

export const dynamic = "force-dynamic";

export default async function Home({searchParams}: {
  searchParams: Promise<{q?: string | string[]; status?: string | string[]; all?: string | string[]}>;
}) {
  const params = await searchParams;
  const filters = normalizeOverviewFilters(params);
  const query = filters.query;
  const status = filters.status;
  const snapshot = await getStationSnapshot();
  const registrationEnabled = localRegistrationEnabled();
  const model = buildOverviewModel(snapshot, filters, {
    retrievedAtIso: snapshot.state === "live" ? new Date().toISOString() : null,
  });

  const totalStations = model.totalStations ?? 0;
  const offlineStations = model.offlineStations ?? 0;
  const orderedStations = model.visibleStations;

  return (
    <div className="space-y-6">
      <OverviewHeader registrationEnabled={registrationEnabled} />
      <OverviewMetrics model={model} />
      <OverviewSummaries model={model} />

      <div className="text-[#17191c]">
        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-5 border-b-2 border-[#17191c] pb-5">
            <div>
              <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#777a78]">
                Fleet
              </p>

              <h2 className="mt-2 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">
                Charging stations
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#686b68]">
                Offline stations are promoted for
                investigation. Open a station to
                inspect its connectors and charging
                transactions.
              </p>
            </div>

            <div className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.11em]">
              <span className="text-[#747774]">
                {orderedStations.length} shown / {totalStations} registered
              </span>

              {offlineStations > 0 && (
                <span className="text-[#df4c35]">
                  {offlineStations} offline
                </span>
              )}
            </div>
          </div>

          <div className="hidden grid-cols-[150px_minmax(240px,1fr)_220px_180px] border-b border-[#17191c]/20 px-3 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[#777a78] lg:grid">
            <span>Status</span>
            <span>Station</span>
            <span>Identifier</span>

            <span className="text-right">
              Action
            </span>
          </div>

          <form key={JSON.stringify([query, status])} action="/" method="get" className="my-6 flex flex-wrap items-end gap-4">
            <label className="grid flex-1 gap-2">Search stations
              <input name="q" type="search" defaultValue={query} maxLength={255} placeholder="Station name or identifier" className="min-w-0 border p-3" />
            </label>
            <label className="grid gap-2">Connectivity
              <select aria-label="Connectivity" name="status" defaultValue={status} className="border p-3">
                <option value="">All stations</option><option value="ONLINE">Online</option><option value="OFFLINE">Offline</option>
              </select>
            </label>
            <button className="border px-5 py-3">Search fleet</button>
            <Link href="/" className="px-3 py-3 underline">Clear filters</Link>
            <Link href="/stations/new" className="px-3 py-3 underline">Register station</Link>
          </form>
          {orderedStations.length > 0 ? (
            <div>
              {orderedStations.map((station) => {
                const offline =
                  station.status === "OFFLINE";

                return (
                  <article
                    key={station.id}
                    className={`grid gap-5 border-b px-3 py-5 transition-colors lg:grid-cols-[150px_minmax(240px,1fr)_220px_180px] lg:items-center ${
                      offline
                        ? "border-[#df4c35]/30 bg-[#df4c35]/[0.025]"
                        : "border-[#17191c]/15 hover:bg-white/65"
                    }`}
                  >
                    <div>
                      <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#92948f] lg:hidden">
                        Status
                      </p>

                      <div className="inline-flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 ${
                            offline
                              ? "bg-[#df4c35]"
                              : "bg-[#16a36a]"
                          }`}
                        />

                        <span
                          className={`font-mono text-[11px] uppercase tracking-[0.1em] ${
                            offline
                              ? "text-[#b83c30]"
                              : "text-[#167451]"
                          }`}
                        >
                          {offline
                            ? "Offline"
                            : "Online"}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#92948f] lg:hidden">
                        Station
                      </p>

                      <Link
                        href={`/stations/${encodeURIComponent(
                          station.id,
                        )}`}
                        className="group inline-flex max-w-full items-center gap-3"
                      >
                        <span className="truncate text-base font-medium tracking-[-0.025em] transition-colors group-hover:text-[#2457ff]">
                          {station.name}
                        </span>

                        <span className="text-xs text-[#2457ff] transition-transform group-hover:translate-x-1">
                          →
                        </span>
                      </Link>

                      {offline && (
                        <p className="mt-1 text-xs text-[#9b5549]">
                          Connectivity requires review
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#92948f] lg:hidden">
                        Identifier
                      </p>

                      <p className="font-mono text-xs text-[#626562]">
                        {station.id}
                      </p>
                    </div>

                    <div className="lg:text-right">
                      <Link
                        href={`/stations/${encodeURIComponent(
                          station.id,
                        )}`}
                        className="inline-flex items-center border border-[#17191c]/20 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[#5f625f] transition-colors hover:border-[#17191c] hover:bg-white hover:text-[#17191c]"
                      >
                        {offline
                          ? "Investigate →"
                          : "Open station →"}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-52 place-items-center border-b border-[#17191c]/15">
              <div className="max-w-md px-6 text-center">
                <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#8b8d89]">
                  No station records
                </p>

                <p className="mt-3 text-sm leading-6 text-[#666967]">
                  {snapshot.state === "live"
                    ? query || status ? "No stations match the selected filters." : "Station Service is reachable, but no charging stations are registered."
                    : snapshot.message}
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="mt-12 border-y border-[#17191c]/15">
          <div className="flex flex-wrap items-center justify-between gap-5 py-6">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#858783]">
                Charging sessions
              </p>

              <p className="mt-2 text-base font-medium tracking-[-0.025em]">
                Inspect transaction lifecycle and
                integrity across the network.
              </p>
            </div>

            <Link
              href="/transactions"
              className="bg-[#17191c] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#2457ff]"
            >
              Open transactions →
            </Link>
          </div>
        </section>

        <Link href="/operations" className="mt-8 inline-block underline">View Operations status →</Link>

        <footer className="mt-12 flex flex-wrap justify-between gap-4 border-t border-[#17191c]/20 py-5 font-mono text-[11px] uppercase tracking-[0.12em] text-[#92948f]">
          <span>
            VoltGrid / Operator Console
          </span>

          <span>
            Station Service / GraphQL
          </span>
        </footer>
      </div>
    </div>
  );
}
