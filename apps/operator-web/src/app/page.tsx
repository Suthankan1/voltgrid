import Link from "next/link";

import { getStationSnapshot } from "@/lib/station-api";

export const dynamic = "force-dynamic";

const primaryNavigation = [
  { label: "Network", active: true },
  { label: "Stations", active: false },
  { label: "Transactions", active: false },
  { label: "Operations", active: false },
];

export default async function Home() {
  const snapshot = await getStationSnapshot();

  const stations = snapshot.stations;
  const totalStations = stations.length;
  const onlineStations = stations.filter(
    (station) => station.status === "ONLINE",
  ).length;

  const availability =
    totalStations === 0
      ? 0
      : Math.round((onlineStations / totalStations) * 100);

  return (
    <div className="min-h-screen bg-[#f2f0ea] text-[#17191c]">
      <header className="border-b border-[#17191c]/15 bg-[#f7f5ef]">
        <div className="mx-auto flex min-h-20 max-w-[1600px] items-stretch">
          <div className="flex min-w-64 items-center gap-3 border-r border-[#17191c]/15 px-6">
            <div className="grid h-9 w-9 place-items-center bg-[#17191c] text-sm font-bold tracking-tight text-white">
              VG
            </div>

            <div>
              <p className="text-[15px] font-semibold tracking-[-0.02em]">
                VoltGrid
              </p>

              <p className="text-[11px] uppercase tracking-[0.16em] text-[#6d706f]">
                Network operations
              </p>
            </div>
          </div>

          <nav className="hidden flex-1 items-stretch md:flex">
            {primaryNavigation.map((item) => (
              <a
                key={item.label}
                href="#"
                className={`relative flex items-center border-r border-[#17191c]/10 px-7 text-sm transition-colors ${
                  item.active
                    ? "bg-white text-[#17191c]"
                    : "text-[#666967] hover:bg-white/60 hover:text-[#17191c]"
                }`}
              >
                {item.label}

                {item.active && (
                  <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#2457ff]" />
                )}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 px-5">
            <span className="hidden text-[11px] uppercase tracking-[0.14em] text-[#737674] sm:block">
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
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-8 sm:px-7 lg:px-10">
        <section className="border-y border-[#17191c]/20">
          <div className="grid lg:grid-cols-[1.55fr_0.45fr]">
            <div className="border-b border-[#17191c]/20 py-10 lg:border-r lg:border-b-0 lg:pr-12">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#2457ff]">
                  Live network
                </span>

                <div className="h-px w-10 bg-[#2457ff]" />
              </div>

              <div className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-4">
                <div>
                  <p className="text-[clamp(4rem,9vw,8rem)] font-medium leading-[0.8] tracking-[-0.075em]">
                    {onlineStations}
                    <span className="mx-2 text-[#a7a7a0]">/</span>
                    {totalStations}
                  </p>

                  <p className="mt-5 text-sm text-[#666967]">
                    stations online
                  </p>
                </div>

                <div className="mb-1 border-l border-[#17191c]/20 pl-5">
                  <p className="font-mono text-2xl tracking-[-0.04em]">
                    {availability}%
                  </p>

                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#777a78]">
                    availability
                  </p>
                </div>
              </div>

              <div className="mt-10 flex h-2 w-full overflow-hidden bg-[#d8d6cf]">
                <div
                  className="bg-[#2457ff] transition-[width]"
                  style={{ width: `${availability}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col justify-between py-8 lg:pl-8">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#777a78]">
                  Data link
                </p>

                <div className="mt-5 flex items-center gap-3">
                  <span
                    className={`h-3 w-3 ${
                      snapshot.state === "live"
                        ? "bg-[#16a36a]"
                        : "bg-[#ef7d32]"
                    }`}
                  />

                  <p className="text-xl font-medium tracking-[-0.03em]">
                    {snapshot.state === "live"
                      ? "Station API linked"
                      : "Station API unavailable"}
                  </p>
                </div>

                <p className="mt-3 max-w-sm text-sm leading-6 text-[#6d706f]">
                  {snapshot.state === "live"
                    ? "This view is reading live station state from VoltGrid Station Service."
                    : snapshot.message}
                </p>
              </div>

              <div className="mt-10 font-mono text-[11px] uppercase leading-5 tracking-[0.12em] text-[#8a8c89]">
                <p>Source / GraphQL</p>
                <p>Refresh / request-time</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#17191c] pb-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#777a78]">
                Fleet ledger
              </p>

              <h1 className="mt-2 text-3xl font-medium tracking-[-0.045em]">
                Charging stations
              </h1>
            </div>

            <p className="text-sm text-[#707370]">
              {totalStations} registered
            </p>
          </div>

          <div className="hidden grid-cols-[110px_1fr_160px_120px] border-b border-[#17191c]/20 px-3 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#777a78] sm:grid">
            <span>State</span>
            <span>Station</span>
            <span>Identifier</span>
            <span className="text-right">Link</span>
          </div>

          {stations.length > 0 ? (
            <div>
              {stations.map((station, index) => (
                <article
                  key={station.id}
                  className="grid gap-4 border-b border-[#17191c]/15 px-3 py-5 transition-colors hover:bg-white/65 sm:grid-cols-[110px_1fr_160px_120px] sm:items-center"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 ${
                        station.status === "ONLINE"
                          ? "bg-[#16a36a]"
                          : "bg-[#a8aaa7]"
                      }`}
                    />

                    <span className="font-mono text-[11px] uppercase tracking-[0.1em]">
                      {station.status}
                    </span>
                  </div>

                  <div>
                    <p className="font-medium tracking-[-0.02em]">
                      {station.name}
                    </p>

                    <p className="mt-1 text-xs text-[#7b7d7a] sm:hidden">
                      {station.id}
                    </p>
                  </div>

                  <p className="hidden font-mono text-xs text-[#626562] sm:block">
                    {station.id}
                  </p>

                  <div className="flex items-center justify-between sm:justify-end">
                    <span className="font-mono text-[10px] text-[#999b98] sm:hidden">
                      #{String(index + 1).padStart(2, "0")}
                    </span>

                    <Link
                      href={`/stations/${encodeURIComponent(station.id)}`}
                      className="text-sm font-medium text-[#2457ff] transition-opacity hover:opacity-60"
                    >
                      Inspect →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center border-b border-[#17191c]/15">
              <div className="max-w-sm px-6 text-center">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#8b8d89]">
                  No station records
                </p>

                <p className="mt-3 text-sm leading-6 text-[#666967]">
                  {snapshot.state === "live"
                    ? "The Station Service is reachable, but no charging stations are currently registered."
                    : snapshot.message}
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="mt-14 grid border-y border-[#17191c]/20 md:grid-cols-3">
          <ServiceCell
            index="01"
            name="Station"
            detail="OCPP / GraphQL"
            active={snapshot.state === "live"}
          />

          <ServiceCell
            index="02"
            name="Authorization"
            detail="Internal gRPC"
            active
          />

          <ServiceCell
            index="03"
            name="Operations"
            detail="Projection / GraphQL"
            active
            last
          />
        </section>
      </main>
    </div>
  );
}

function ServiceCell({
  index,
  name,
  detail,
  active,
  last = false,
}: {
  index: string;
  name: string;
  detail: string;
  active: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`flex min-h-36 flex-col justify-between p-5 ${
        last
          ? ""
          : "border-b border-[#17191c]/20 md:border-r md:border-b-0"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-[#92948f]">
          {index}
        </span>

        <span
          className={`h-2.5 w-2.5 ${
            active ? "bg-[#16a36a]" : "bg-[#ef7d32]"
          }`}
        />
      </div>

      <div>
        <p className="text-lg font-medium tracking-[-0.025em]">
          {name}
        </p>

        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#7d807d]">
          {detail}
        </p>
      </div>
    </div>
  );
}