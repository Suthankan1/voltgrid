import Link from "next/link";

import { getStationSnapshot } from "@/lib/station-api";

export const dynamic = "force-dynamic";

const navigation = [
  { label: "Condition", href: "#condition" },
  { label: "Attention", href: "#attention" },
  { label: "Fleet", href: "#fleet" },
  { label: "Transactions", href: "/transactions" },
];

export default async function Home() {
  const snapshot = await getStationSnapshot();

  const stations = snapshot.stations;
  const totalStations = stations.length;

  const onlineStations = stations.filter(
    (station) => station.status === "ONLINE",
  ).length;

  const offlineStations = totalStations - onlineStations;

  const connectivity =
    totalStations === 0
      ? 0
      : Math.round((onlineStations / totalStations) * 100);

  const orderedStations = [...stations].sort((left, right) => {
    if (left.status === right.status) {
      return left.name.localeCompare(right.name);
    }

    return left.status === "OFFLINE" ? -1 : 1;
  });

  const condition =
    snapshot.state === "unavailable"
      ? {
          label: "Data interrupted",
          description:
            "VoltGrid cannot currently read station state from Station Service.",
          tone: "alert" as const,
        }
      : totalStations === 0
        ? {
            label: "No fleet registered",
            description:
              "Station Service is reachable, but there are no registered charging stations.",
            tone: "neutral" as const,
          }
        : offlineStations > 0
          ? {
              label: "Attention required",
              description: `${offlineStations} registered ${
                offlineStations === 1 ? "station is" : "stations are"
              } currently offline.`,
              tone: "alert" as const,
            }
          : {
              label: "Fleet connected",
              description:
                "Every registered station is currently reporting online.",
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
            {navigation.map((item, index) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex min-w-fit items-center gap-3 border-r border-[#17191c]/10 px-5 py-3 text-sm text-[#5f625f] transition-colors first:border-l hover:bg-white/60 hover:text-[#17191c]"
              >
                <span className="font-mono text-[9px] text-[#989a96]">
                  0{index + 1}
                </span>

                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-8 sm:px-7 lg:px-10">
        <section
          id="condition"
          className="scroll-mt-6 border-y border-[#17191c]/20"
        >
          <div className="grid lg:grid-cols-[1.45fr_0.55fr]">
            <div className="border-b border-[#17191c]/20 py-9 lg:border-r lg:border-b-0 lg:pr-12">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#2457ff]">
                  Fleet connectivity
                </span>

                <span className="h-px w-10 bg-[#2457ff]" />
              </div>

              <div className="mt-7 flex flex-wrap items-end gap-x-8 gap-y-5">
                <p className="text-[clamp(3.8rem,8vw,7rem)] font-medium leading-[0.82] tracking-[-0.075em]">
                  {onlineStations}
                  <span className="mx-2 text-[#aaa9a2]">/</span>
                  {totalStations}
                </p>

                <div className="border-l border-[#17191c]/20 pl-5">
                  <p className="font-mono text-xl tracking-[-0.04em]">
                    {connectivity}%
                  </p>

                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.13em] text-[#858783]">
                    connected
                  </p>
                </div>
              </div>

              <p className="mt-5 text-sm text-[#666967]">
                registered stations currently online
              </p>

              <div className="mt-8 flex h-1.5 w-full overflow-hidden bg-[#d8d6cf]">
                <div
                  className="bg-[#2457ff]"
                  style={{ width: `${connectivity}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col justify-between py-8 lg:pl-8">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#818480]">
                  Network condition
                </p>

                <div className="mt-5 flex items-start gap-3">
                  <span
                    className={`mt-1 h-3 w-3 shrink-0 ${
                      condition.tone === "healthy"
                        ? "bg-[#16a36a]"
                        : condition.tone === "alert"
                          ? "bg-[#df4c35]"
                          : "bg-[#8f918e]"
                    }`}
                  />

                  <div>
                    <p className="text-xl font-medium tracking-[-0.03em]">
                      {condition.label}
                    </p>

                    <p className="mt-3 max-w-sm text-sm leading-6 text-[#676a67]">
                      {condition.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-10 font-mono text-[9px] uppercase leading-5 tracking-[0.12em] text-[#91938f]">
                <p>Source / Station Service GraphQL</p>
                <p>View / request-time snapshot</p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="attention"
          className="scroll-mt-6 mt-10"
        >
          <div className="flex flex-wrap items-center justify-between gap-5 border-y border-[#17191c]/20 py-5">
            <div className="flex items-center gap-4">
              <span
                className={`h-3 w-3 ${
                  snapshot.state === "unavailable" || offlineStations > 0
                    ? "bg-[#df4c35]"
                    : "bg-[#16a36a]"
                }`}
              />

              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#858783]">
                  Attention
                </p>

                <p className="mt-1 font-medium tracking-[-0.02em]">
                  {snapshot.state === "unavailable"
                    ? "Station data link requires attention"
                    : offlineStations > 0
                      ? `${offlineStations} ${
                          offlineStations === 1 ? "station" : "stations"
                        } offline`
                      : "No station connectivity alerts"}
                </p>
              </div>
            </div>

            <p className="max-w-lg text-sm leading-6 text-[#747774]">
              {snapshot.state === "unavailable"
                ? snapshot.message
                : offlineStations > 0
                  ? "Offline stations are promoted to the top of the fleet ledger for investigation."
                  : "All registered stations are currently connected."}
            </p>
          </div>
        </section>

        <section
          id="fleet"
          className="scroll-mt-6 mt-12"
        >
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#17191c] pb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#777a78]">
                Fleet ledger
              </p>

              <h1 className="mt-2 text-3xl font-medium tracking-[-0.045em]">
                Charging stations
              </h1>
            </div>

            <div className="flex gap-5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#777a78]">
              <span>{totalStations} registered</span>

              {offlineStations > 0 && (
                <span className="text-[#df4c35]">
                  {offlineStations} offline
                </span>
              )}
            </div>
          </div>

          <div className="hidden grid-cols-[120px_1fr_180px_150px] border-b border-[#17191c]/20 px-3 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[#777a78] sm:grid">
            <span>Connectivity</span>
            <span>Station</span>
            <span>Identifier</span>
            <span className="text-right">Action</span>
          </div>

          {orderedStations.length > 0 ? (
            <div>
              {orderedStations.map((station, index) => (
                <article
                  key={station.id}
                  className={`grid gap-4 border-b px-3 py-5 transition-colors sm:grid-cols-[120px_1fr_180px_150px] sm:items-center ${
                    station.status === "OFFLINE"
                      ? "border-[#df4c35]/30 bg-[#df4c35]/[0.025]"
                      : "border-[#17191c]/15 hover:bg-white/65"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 ${
                        station.status === "ONLINE"
                          ? "bg-[#16a36a]"
                          : "bg-[#df4c35]"
                      }`}
                    />

                    <span className="font-mono text-[10px] uppercase tracking-[0.1em]">
                      {station.status}
                    </span>
                  </div>

                  <div>
                    <p className="font-medium tracking-[-0.02em]">
                      {station.name}
                    </p>

                    <p className="mt-1 font-mono text-[10px] text-[#7b7d7a] sm:hidden">
                      {station.id}
                    </p>
                  </div>

                  <p className="hidden font-mono text-xs text-[#626562] sm:block">
                    {station.id}
                  </p>

                  <div className="flex items-center justify-between sm:justify-end">
                    <span className="font-mono text-[9px] text-[#999b98] sm:hidden">
                      #{String(index + 1).padStart(2, "0")}
                    </span>

                    <Link
                      href={`/stations/${encodeURIComponent(station.id)}`}
                      className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#2457ff] transition-opacity hover:opacity-60"
                    >
                      Open dossier →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="grid min-h-52 place-items-center border-b border-[#17191c]/15">
              <div className="max-w-sm px-6 text-center">
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

        <footer className="mt-14 flex flex-wrap justify-between gap-4 border-t border-[#17191c]/20 py-5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#92948f]">
          <span>VoltGrid / Operator Console</span>
          <span>Station state / live GraphQL read</span>
        </footer>
      </main>
    </div>
  );
}