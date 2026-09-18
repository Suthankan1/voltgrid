import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getStationDetail,
  type ConnectorStatus,
} from "@/lib/station-api";

export const dynamic = "force-dynamic";

export default async function StationPage({
  params,
}: {
  params: Promise<{
    stationId: string;
  }>;
}) {
  const { stationId } = await params;

  const snapshot = await getStationDetail(
    decodeURIComponent(stationId),
  );

  if (snapshot.state === "live" && !snapshot.station) {
    notFound();
  }

  if (snapshot.state === "unavailable") {
    return (
      <main className="min-h-screen bg-[#f2f0ea] px-6 py-10 text-[#17191c]">
        <div className="mx-auto max-w-[1500px]">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#2457ff]"
          >
            ← Network
          </Link>

          <div className="mt-16 border-y border-[#17191c]/20 py-14">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#ef7d32]">
              Data link interrupted
            </p>

            <h1 className="mt-5 max-w-2xl text-5xl font-medium tracking-[-0.055em]">
              Station record unavailable
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-6 text-[#676a67]">
              {snapshot.message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const station = snapshot.station!;

  const availableConnectors = snapshot.connectors.filter(
    (connector) => connector.status === "AVAILABLE",
  ).length;

  const connectorAlerts = snapshot.connectors.filter(
    (connector) =>
      connector.status === "FAULTED" ||
      connector.status === "UNAVAILABLE",
  );

  const activeTransactions = snapshot.transactions.filter(
    (transaction) => transaction.status === "ACTIVE",
  ).length;

  const stationNeedsAttention =
    station.status === "OFFLINE" ||
    connectorAlerts.length > 0;

  const orderedConnectors = [...snapshot.connectors].sort(
    (left, right) => {
      const priority = (status: ConnectorStatus) => {
        switch (status) {
          case "FAULTED":
            return 0;
          case "UNAVAILABLE":
            return 1;
          case "OCCUPIED":
            return 2;
          case "RESERVED":
            return 3;
          case "AVAILABLE":
            return 4;
        }
      };

      return priority(left.status) - priority(right.status);
    },
  );

  const orderedTransactions = [...snapshot.transactions].sort(
    (left, right) =>
      new Date(right.startedAt).getTime() -
      new Date(left.startedAt).getTime(),
  );

  return (
    <div className="min-h-screen bg-[#f2f0ea] text-[#17191c]">
      <header className="border-b border-[#17191c]/15 bg-[#f7f5ef]">
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between px-5 sm:px-7 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="grid h-8 w-8 shrink-0 place-items-center bg-[#17191c] text-[10px] font-bold text-white"
            >
              VG
            </Link>

            <span className="text-[#aaa9a3]">/</span>

            <Link
              href="/#fleet"
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6d706f] hover:text-[#2457ff]"
            >
              Fleet
            </Link>

            <span className="hidden text-[#aaa9a3] sm:inline">/</span>

            <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[#17191c] sm:block">
              {station.id}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-[#898b88] sm:block">
              Station dossier
            </span>

            <span
              className={`h-2.5 w-2.5 ${
                station.status === "ONLINE"
                  ? "bg-[#16a36a]"
                  : "bg-[#df4c35]"
              }`}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-8 sm:px-7 lg:px-10">
        <section className="grid border-y border-[#17191c]/20 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="py-9 lg:border-r lg:border-[#17191c]/20 lg:pr-12">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#2457ff]">
                Station / {station.id}
              </span>

              <span className="h-px w-10 bg-[#2457ff]" />
            </div>

            <h1 className="mt-6 max-w-4xl text-[clamp(2.8rem,6vw,5.4rem)] font-medium leading-[0.9] tracking-[-0.065em]">
              {station.name}
            </h1>

            <div className="mt-9 flex flex-wrap gap-x-9 gap-y-5 border-t border-[#17191c]/15 pt-5">
              <StatusMetric
                label="Connectivity"
                value={station.status}
                tone={
                  station.status === "ONLINE"
                    ? "healthy"
                    : "alert"
                }
              />

              <StatusMetric
                label="Connectors"
                value={String(snapshot.connectors.length)}
              />

              <StatusMetric
                label="Available"
                value={String(availableConnectors)}
              />

              <StatusMetric
                label="Active sessions"
                value={String(activeTransactions)}
                tone={
                  activeTransactions > 0
                    ? "active"
                    : undefined
                }
              />

              <StatusMetric
                label="History"
                value={String(snapshot.transactions.length)}
              />
            </div>
          </div>

          <div className="flex flex-col justify-between py-8 lg:pl-8">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#818480]">
                Network identity
              </p>

              <dl className="mt-6 divide-y divide-[#17191c]/15 border-y border-[#17191c]/15">
                <DataRow label="Station ID" value={station.id} />

                <DataRow
                  label="OCPP route"
                  value={`/ocpp/${station.id}`}
                />

                <DataRow label="Protocol" value="OCPP 2.0.1" />
              </dl>
            </div>

            <p className="mt-9 font-mono text-[9px] uppercase leading-5 tracking-[0.12em] text-[#959793]">
              Station Service
              <br />
              Live GraphQL operational record
            </p>
          </div>
        </section>

        <section className="mt-9">
          <div
            className={`flex flex-wrap items-center justify-between gap-5 border-y py-5 ${
              stationNeedsAttention
                ? "border-[#df4c35]/35"
                : "border-[#17191c]/20"
            }`}
          >
            <div className="flex items-center gap-4">
              <span
                className={`h-3 w-3 ${
                  stationNeedsAttention
                    ? "bg-[#df4c35]"
                    : "bg-[#16a36a]"
                }`}
              />

              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#858783]">
                  Hardware condition
                </p>

                <p className="mt-1 font-medium tracking-[-0.02em]">
                  {station.status === "OFFLINE"
                    ? "Station connectivity requires attention"
                    : connectorAlerts.length > 0
                      ? `${connectorAlerts.length} ${
                          connectorAlerts.length === 1
                            ? "connector requires"
                            : "connectors require"
                        } attention`
                      : "No immediate station alerts"}
                </p>
              </div>
            </div>

            <p className="max-w-lg text-sm leading-6 text-[#747774]">
              {station.status === "OFFLINE"
                ? "The station is currently reported offline."
                : connectorAlerts.length > 0
                  ? "Faulted and unavailable connectors are promoted to the top of the hardware topology."
                  : "Station connectivity and reported connector states do not currently indicate a hardware alert."}
            </p>
          </div>
        </section>

        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#17191c] pb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7c7f7b]">
                Hardware topology
              </p>

              <h2 className="mt-2 text-3xl font-medium tracking-[-0.045em]">
                EVSE / connectors
              </h2>
            </div>

            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#747773]">
              {snapshot.connectors.length} endpoints
            </p>
          </div>

          {orderedConnectors.length > 0 ? (
            <div>
              {orderedConnectors.map((connector) => {
                const alert =
                  connector.status === "FAULTED" ||
                  connector.status === "UNAVAILABLE";

                return (
                  <article
                    key={`${connector.evseId}-${connector.connectorId}`}
                    className={`grid gap-5 border-b px-2 py-6 sm:grid-cols-[90px_90px_1fr_220px] sm:items-center ${
                      alert
                        ? "border-[#df4c35]/30 bg-[#df4c35]/[0.025]"
                        : "border-[#17191c]/15"
                    }`}
                  >
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#91938f]">
                        EVSE
                      </p>

                      <p className="mt-1 text-xl font-medium">
                        {String(connector.evseId).padStart(2, "0")}
                      </p>
                    </div>

                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#91938f]">
                        Port
                      </p>

                      <p className="mt-1 text-xl font-medium">
                        {String(connector.connectorId).padStart(2, "0")}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`h-3 w-3 ${connectorStatusColor(
                          connector.status,
                        )}`}
                      />

                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.1em]">
                          {connector.status}
                        </p>

                        {alert && (
                          <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#df4c35]">
                            attention
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#969894]">
                        Last state change
                      </p>

                      <p className="mt-1 font-mono text-[10px] text-[#5f625f]">
                        {formatTimestamp(connector.statusUpdatedAt)}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="border-b border-[#17191c]/15 py-14">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8d908c]">
                No connector topology reported
              </p>
            </div>
          )}
        </section>

        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#17191c] pb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7c7f7b]">
                Session tape
              </p>

              <h2 className="mt-2 text-3xl font-medium tracking-[-0.045em]">
                Charging transactions
              </h2>
            </div>

            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em]">
                {snapshot.transactions.length} recorded
              </p>

              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#8d908c]">
                {activeTransactions} active
              </p>
            </div>
          </div>

          {orderedTransactions.length > 0 ? (
            <div>
              <div className="hidden grid-cols-[120px_1fr_110px_100px_200px] border-b border-[#17191c]/20 px-3 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[#858783] md:grid">
                <span>State</span>
                <span>Transaction</span>
                <span>Endpoint</span>
                <span>Sequence</span>
                <span className="text-right">Lifecycle</span>
              </div>

              {orderedTransactions.map((transaction) => (
                <article
                  key={transaction.transactionId}
                  className="grid gap-5 border-b border-[#17191c]/15 px-3 py-6 transition-colors hover:bg-white/65 md:grid-cols-[120px_1fr_110px_100px_200px] md:items-center"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-3 w-3 ${
                        transaction.status === "ACTIVE"
                          ? "bg-[#2457ff]"
                          : "bg-[#8f918e]"
                      }`}
                    />

                    <span className="font-mono text-[10px] uppercase tracking-[0.12em]">
                      {transaction.status}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <Link
                      href={`/stations/${encodeURIComponent(
                        station.id,
                      )}/transactions/${encodeURIComponent(
                        transaction.transactionId,
                      )}`}
                      className="group inline-flex max-w-full items-center gap-3"
                    >
                      <span className="truncate font-mono text-sm tracking-[-0.02em] group-hover:text-[#2457ff]">
                        {transaction.transactionId}
                      </span>

                      <span className="shrink-0 text-xs text-[#2457ff] transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </Link>

                    <p className="mt-1 text-xs text-[#858783] md:hidden">
                      EVSE {transaction.evseId} / connector{" "}
                      {transaction.connectorId}
                    </p>
                  </div>

                  <p className="hidden font-mono text-xs md:block">
                    {String(transaction.evseId).padStart(2, "0")}
                    <span className="mx-1 text-[#aaa9a3]">/</span>
                    {String(transaction.connectorId).padStart(2, "0")}
                  </p>

                  <div>
                    <p className="font-mono text-sm">
                      #{transaction.lastSequenceNumber}
                    </p>

                    <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#969894]">
                      latest
                    </p>
                  </div>

                  <div className="md:text-right">
                    <p className="font-mono text-[10px] text-[#5f625f]">
                      {formatTimestamp(transaction.startedAt)}
                    </p>

                    <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#979995]">
                      {transaction.endedAt
                        ? `ended ${formatTimestamp(
                            transaction.endedAt,
                          )}`
                        : "session open"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center border-b border-[#17191c]/15">
              <div className="px-6 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8d908c]">
                  No session history
                </p>

                <p className="mt-3 text-sm text-[#686b68]">
                  This station has not reported a charging transaction yet.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatusMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "healthy" | "alert" | "active";
}) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#92948f]">
        {label}
      </p>

      <div className="mt-1 flex items-center gap-2">
        {tone && (
          <span
            className={`h-2 w-2 ${
              tone === "healthy"
                ? "bg-[#16a36a]"
                : tone === "alert"
                  ? "bg-[#df4c35]"
                  : "bg-[#2457ff]"
            }`}
          />
        )}

        <p className="text-lg font-medium tracking-[-0.03em]">
          {value}
        </p>
      </div>
    </div>
  );
}

function DataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[105px_1fr] gap-4 py-3">
      <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#969894]">
        {label}
      </dt>

      <dd className="break-all font-mono text-xs">
        {value}
      </dd>
    </div>
  );
}

function connectorStatusColor(status: ConnectorStatus) {
  switch (status) {
    case "AVAILABLE":
      return "bg-[#16a36a]";

    case "OCCUPIED":
      return "bg-[#2457ff]";

    case "RESERVED":
      return "bg-[#d59b22]";

    case "FAULTED":
      return "bg-[#df4c35]";

    case "UNAVAILABLE":
      return "bg-[#8f918e]";
  }
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}