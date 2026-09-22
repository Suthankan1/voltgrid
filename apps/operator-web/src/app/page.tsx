import Link from "next/link";

import { getStationSnapshot } from "@/lib/station-api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const snapshot = await getStationSnapshot();

  const stations = snapshot.stations;

  const totalStations = stations.length;

  const onlineStations = stations.filter(
    (station) => station.status === "ONLINE",
  ).length;

  const offlineStations =
    totalStations - onlineStations;

  const connectivity =
    totalStations === 0
      ? 0
      : Math.round(
          (onlineStations / totalStations) * 100,
        );

  const orderedStations = [...stations].sort(
    (left, right) => {
      if (left.status === right.status) {
        return left.name.localeCompare(right.name);
      }

      return left.status === "OFFLINE" ? -1 : 1;
    },
  );

  const condition =
    snapshot.state === "unavailable"
      ? {
          title: "Station data unavailable",
          detail: snapshot.message,
          tone: "unavailable" as const,
        }
      : totalStations === 0
        ? {
            title: "No stations registered",
            detail:
              "Station Service is reachable, but the network does not contain any registered charging stations.",
            tone: "neutral" as const,
          }
        : offlineStations > 0
          ? {
              title: "Attention required",
              detail: `${offlineStations} ${
                offlineStations === 1
                  ? "station is"
                  : "stations are"
              } currently offline.`,
              tone: "attention" as const,
            }
          : {
              title: "Network fully connected",
              detail:
                "Every registered charging station is currently online.",
              tone: "healthy" as const,
            };

  return (
    <div className="min-h-screen bg-[#f2f0ea] text-[#17191c]">
      <header className="border-b border-[#17191c]/15 bg-[#f7f5ef]">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex min-h-16 items-center justify-between px-5 sm:px-7 lg:px-10">
            <Link
              href="/"
              className="flex items-center gap-3"
            >
              <div className="grid h-9 w-9 place-items-center bg-[#17191c] text-sm font-bold tracking-tight text-white">
                VG
              </div>

              <div>
                <p className="text-[15px] font-semibold tracking-[-0.02em]">
                  VoltGrid
                </p>

                <p className="text-[10px] uppercase tracking-[0.16em] text-[#747774]">
                  Network operations
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-[#737674] sm:block">
                AWS / DEV
              </span>

              <span
                className={`h-2.5 w-2.5 ${
                  snapshot.state === "live"
                    ? "bg-[#16a36a]"
                    : "bg-[#ef7d32]"
                }`}
              />
            </div>
          </div>

          <nav className="flex overflow-x-auto border-t border-[#17191c]/10 px-5 sm:px-7 lg:px-10">
            <div className="relative flex min-w-fit items-center gap-3 border-x border-[#17191c]/10 bg-white px-5 py-3 text-sm">
              <span className="font-mono text-[9px] text-[#989a96]">
                01
              </span>

              Network

              <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#2457ff]" />
            </div>

            <Link
              href="/transactions"
              className="flex min-w-fit items-center gap-3 border-r border-[#17191c]/10 px-5 py-3 text-sm text-[#5f625f] transition-colors hover:bg-white/60 hover:text-[#17191c]"
            >
              <span className="font-mono text-[9px] text-[#989a96]">
                02
              </span>

              Transactions
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-8 sm:px-7 lg:px-10">
        <section className="border-y border-[#17191c]/20">
          <div className="grid gap-8 py-9 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#2457ff]">
                Network overview
              </p>

              <h1 className="mt-3 max-w-4xl text-[clamp(2.7rem,6vw,5.7rem)] font-medium leading-[0.9] tracking-[-0.065em]">
                Charging network
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-6 text-[#666967]">
                Monitor charging-station connectivity
                and investigate network availability
                from the Station Service read model.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`h-2.5 w-2.5 ${
                  snapshot.state === "live"
                    ? "bg-[#16a36a]"
                    : "bg-[#ef7d32]"
                }`}
              />

              <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#747774]">
                {snapshot.state === "live"
                  ? "Live station data"
                  : "Service unavailable"}
              </span>
            </div>
          </div>

          <div className="grid border-t border-[#17191c]/15 sm:grid-cols-3">
            <SummaryMetric
              value={totalStations}
              label="Registered stations"
              detail="network total"
            />

            <SummaryMetric
              value={onlineStations}
              label="Online"
              detail="currently connected"
              tone={
                onlineStations > 0
                  ? "healthy"
                  : "default"
              }
            />

            <SummaryMetric
              value={offlineStations}
              label="Offline"
              detail="requires attention"
              tone={
                offlineStations > 0
                  ? "attention"
                  : "default"
              }
            />
          </div>

          <div className="grid border-t border-[#17191c]/15 lg:grid-cols-[1fr_320px]">
            <div className="py-6 lg:border-r lg:border-[#17191c]/15 lg:pr-8">
              <div className="flex items-start gap-4">
                <span
                  className={`mt-1.5 h-3 w-3 shrink-0 ${conditionTone(
                    condition.tone,
                  )}`}
                />

                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#858783]">
                    Network condition
                  </p>

                  <p className="mt-2 text-lg font-medium tracking-[-0.03em]">
                    {condition.title}
                  </p>

                  <p className="mt-2 max-w-xl text-sm leading-6 text-[#686b68]">
                    {condition.detail}
                  </p>
                </div>
              </div>
            </div>

            <div className="py-6 lg:pl-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#858783]">
                    Connectivity
                  </p>

                  <p className="mt-2 font-mono text-3xl tracking-[-0.045em]">
                    {connectivity}%
                  </p>
                </div>

                <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#92948f]">
                  {onlineStations}/{totalStations} online
                </p>
              </div>

              <div className="mt-5 h-1.5 w-full overflow-hidden bg-[#d8d6cf]">
                <div
                  className="h-full bg-[#2457ff]"
                  style={{
                    width: `${connectivity}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-5 border-b-2 border-[#17191c] pb-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#777a78]">
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

            <div className="flex items-center gap-5 font-mono text-[9px] uppercase tracking-[0.11em]">
              <span className="text-[#747774]">
                {totalStations} registered
              </span>

              {offlineStations > 0 && (
                <span className="text-[#df4c35]">
                  {offlineStations} offline
                </span>
              )}
            </div>
          </div>

          <div className="hidden grid-cols-[150px_minmax(240px,1fr)_220px_180px] border-b border-[#17191c]/20 px-3 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[#777a78] sm:grid">
            <span>Status</span>
            <span>Station</span>
            <span>Identifier</span>

            <span className="text-right">
              Action
            </span>
          </div>

          {orderedStations.length > 0 ? (
            <div>
              {orderedStations.map((station) => {
                const offline =
                  station.status === "OFFLINE";

                return (
                  <article
                    key={station.id}
                    className={`grid gap-5 border-b px-3 py-5 transition-colors sm:grid-cols-[150px_minmax(240px,1fr)_220px_180px] sm:items-center ${
                      offline
                        ? "border-[#df4c35]/30 bg-[#df4c35]/[0.025]"
                        : "border-[#17191c]/15 hover:bg-white/65"
                    }`}
                  >
                    <div>
                      <p className="mb-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[#92948f] sm:hidden">
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
                          className={`font-mono text-[9px] uppercase tracking-[0.1em] ${
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
                      <p className="mb-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[#92948f] sm:hidden">
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
                      <p className="mb-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[#92948f] sm:hidden">
                        Identifier
                      </p>

                      <p className="font-mono text-xs text-[#626562]">
                        {station.id}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <Link
                        href={`/stations/${encodeURIComponent(
                          station.id,
                        )}`}
                        className="inline-flex items-center border border-[#17191c]/20 px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[#5f625f] transition-colors hover:border-[#17191c] hover:bg-white hover:text-[#17191c]"
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
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8b8d89]">
                  No station records
                </p>

                <p className="mt-3 text-sm leading-6 text-[#666967]">
                  {snapshot.state === "live"
                    ? "Station Service is reachable, but no charging stations are registered."
                    : snapshot.message}
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="mt-12 border-y border-[#17191c]/15">
          <div className="flex flex-wrap items-center justify-between gap-5 py-6">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#858783]">
                Charging sessions
              </p>

              <p className="mt-2 text-base font-medium tracking-[-0.025em]">
                Inspect transaction lifecycle and
                integrity across the network.
              </p>
            </div>

            <Link
              href="/transactions"
              className="bg-[#17191c] px-5 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#2457ff]"
            >
              Open transactions →
            </Link>
          </div>
        </section>

        <footer className="mt-12 flex flex-wrap justify-between gap-4 border-t border-[#17191c]/20 py-5 font-mono text-[8px] uppercase tracking-[0.12em] text-[#92948f]">
          <span>
            VoltGrid / Operator Console
          </span>

          <span>
            Station Service / GraphQL
          </span>
        </footer>
      </main>
    </div>
  );
}

function SummaryMetric({
  value,
  label,
  detail,
  tone = "default",
}: {
  value: number;
  label: string;
  detail: string;
  tone?:
    | "default"
    | "healthy"
    | "attention";
}) {
  return (
    <div className="border-b border-[#17191c]/15 py-6 sm:border-r sm:border-b-0 sm:px-6 sm:first:pl-0 sm:last:border-r-0">
      <div className="flex items-baseline gap-3">
        <p
          className={`font-mono text-3xl tracking-[-0.04em] ${
            tone === "healthy"
              ? "text-[#167451]"
              : tone === "attention"
                ? "text-[#c54435]"
                : ""
          }`}
        >
          {value}
        </p>

        {tone !== "default" && (
          <span
            className={`h-2 w-2 ${
              tone === "healthy"
                ? "bg-[#16a36a]"
                : "bg-[#c54435]"
            }`}
          />
        )}
      </div>

      <p className="mt-3 text-sm font-medium">
        {label}
      </p>

      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[#92948f]">
        {detail}
      </p>
    </div>
  );
}

function conditionTone(
  tone:
    | "unavailable"
    | "attention"
    | "healthy"
    | "neutral",
) {
  switch (tone) {
    case "unavailable":
      return "bg-[#ef7d32]";

    case "attention":
      return "bg-[#df4c35]";

    case "healthy":
      return "bg-[#16a36a]";

    case "neutral":
      return "bg-[#92948f]";
  }
}