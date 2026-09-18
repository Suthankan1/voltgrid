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
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#ef7d32]">
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

  const available = snapshot.connectors.filter(
    (connector) => connector.status === "AVAILABLE",
  ).length;

  const activeTransactions = snapshot.transactions.filter(
    (transaction) => transaction.status === "ACTIVE",
  ).length;

  const orderedTransactions = [...snapshot.transactions].sort(
    (left, right) =>
      new Date(right.startedAt).getTime() -
      new Date(left.startedAt).getTime(),
  );

  return (
    <div className="min-h-screen bg-[#f2f0ea] text-[#17191c]">
      <header className="border-b border-[#17191c]/15 bg-[#f7f5ef]">
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between px-6 lg:px-10">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#5f625f] transition-colors hover:text-[#2457ff]"
          >
            ← Network index
          </Link>

          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#898b88]">
              Station inspector
            </span>

            <span
              className={`h-2.5 w-2.5 ${
                station.status === "ONLINE"
                  ? "bg-[#16a36a]"
                  : "bg-[#9b9d99]"
              }`}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-10 lg:px-10">
        <section className="grid border-y border-[#17191c]/20 lg:grid-cols-[1.45fr_0.55fr]">
          <div className="py-10 lg:border-r lg:border-[#17191c]/20 lg:pr-12">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#2457ff]">
              {station.id}
            </p>

            <h1 className="mt-6 max-w-4xl text-[clamp(3.5rem,8vw,7.5rem)] font-medium leading-[0.85] tracking-[-0.075em]">
              {station.name}
            </h1>

            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-[#17191c]/15 pt-5">
              <StatusLabel
                label="Station"
                value={station.status}
                active={station.status === "ONLINE"}
              />

              <StatusLabel
                label="Connectors"
                value={String(snapshot.connectors.length)}
              />

              <StatusLabel
                label="Available"
                value={String(available)}
              />

              <StatusLabel
                label="Charging"
                value={String(activeTransactions)}
                active={activeTransactions > 0}
              />
            </div>
          </div>

          <div className="flex flex-col justify-between py-8 lg:pl-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#818480]">
                Network identity
              </p>

              <dl className="mt-7 divide-y divide-[#17191c]/15 border-y border-[#17191c]/15">
                <DataRow label="Station ID" value={station.id} />

                <DataRow
                  label="OCPP route"
                  value={`/ocpp/${station.id}`}
                />

                <DataRow
                  label="Protocol"
                  value="OCPP 2.0.1"
                />
              </dl>
            </div>

            <p className="mt-10 font-mono text-[10px] uppercase leading-5 tracking-[0.12em] text-[#959793]">
              Live operational record
              <br />
              Station Service / GraphQL
            </p>
          </div>
        </section>

        <section className="mt-14">
          <div className="flex items-end justify-between border-b-2 border-[#17191c] pb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7c7f7b]">
                Hardware topology
              </p>

              <h2 className="mt-2 text-3xl font-medium tracking-[-0.045em]">
                EVSE / connectors
              </h2>
            </div>

            <p className="font-mono text-xs text-[#747773]">
              {snapshot.connectors.length} endpoints
            </p>
          </div>

          {snapshot.connectors.length > 0 ? (
            <div>
              {snapshot.connectors.map((connector) => (
                <div
                  key={`${connector.evseId}-${connector.connectorId}`}
                  className="grid gap-5 border-b border-[#17191c]/15 px-2 py-6 sm:grid-cols-[90px_90px_1fr_210px] sm:items-center"
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

                    <span className="font-mono text-xs uppercase tracking-[0.1em]">
                      {connector.status}
                    </span>
                  </div>

                  <div className="sm:text-right">
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#969894]">
                      Last state change
                    </p>

                    <p className="mt-1 font-mono text-xs text-[#5f625f]">
                      {formatTimestamp(connector.statusUpdatedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-b border-[#17191c]/15 py-16">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8d908c]">
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
              <p className="font-mono text-xs">
                {snapshot.transactions.length} recorded
              </p>

              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#8d908c]">
                {activeTransactions} active
              </p>
            </div>
          </div>

          {orderedTransactions.length > 0 ? (
            <div>
              <div className="hidden grid-cols-[130px_1fr_100px_120px_170px] border-b border-[#17191c]/20 px-3 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[#858783] md:grid">
                <span>State</span>
                <span>Transaction</span>
                <span>EVSE / Port</span>
                <span>Sequence</span>
                <span className="text-right">Time</span>
              </div>

              {orderedTransactions.map((transaction) => (
                <article
                  key={transaction.transactionId}
                  className="group grid gap-5 border-b border-[#17191c]/15 px-3 py-6 transition-colors hover:bg-white/65 md:grid-cols-[130px_1fr_100px_120px_170px] md:items-center"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-3 w-3 ${
                        transaction.status === "ACTIVE"
                          ? "bg-[#2457ff]"
                          : "bg-[#9b9d99]"
                      }`}
                    />

                    <span className="font-mono text-[10px] uppercase tracking-[0.12em]">
                      {transaction.status}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm tracking-[-0.02em]">
                      {transaction.transactionId}
                    </p>

                    <p className="mt-1 text-xs text-[#858783] md:hidden">
                      EVSE {transaction.evseId} / connector{" "}
                      {transaction.connectorId}
                    </p>
                  </div>

                  <p className="hidden font-mono text-xs md:block">
                    {String(transaction.evseId).padStart(2, "0")}

                    <span className="mx-1 text-[#aaa9a3]">
                      /
                    </span>

                    {String(transaction.connectorId).padStart(2, "0")}
                  </p>

                  <div>
                    <p className="font-mono text-sm">
                      #{transaction.lastSequenceNumber}
                    </p>

                    <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-[#969894]">
                      last event
                    </p>
                  </div>

                  <div className="md:text-right">
                    <p className="font-mono text-[11px] text-[#5f625f]">
                      {formatTimestamp(transaction.startedAt)}
                    </p>

                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[#979995]">
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

function StatusLabel({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#92948f]">
        {label}
      </p>

      <div className="mt-1 flex items-center gap-2">
        {active !== undefined && (
          <span
            className={`h-2 w-2 ${
              active ? "bg-[#16a36a]" : "bg-[#9b9d99]"
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
    <div className="grid grid-cols-[110px_1fr] gap-4 py-3">
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
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}