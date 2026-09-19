import Link from "next/link";

import {
  getNetworkTransactions,
  type ChargingTransaction,
} from "@/lib/station-api";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const snapshot = await getNetworkTransactions();

  const transactions = snapshot.transactions;

  const activeTransactions = transactions.filter(
    (transaction) => transaction.status === "ACTIVE",
  );

  const endedTransactions = transactions.filter(
    (transaction) => transaction.status === "ENDED",
  );

  const orderedTransactions = [
    ...activeTransactions,
    ...endedTransactions,
  ];

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
            <Link
              href="/"
              className="flex min-w-fit items-center gap-3 border-x border-[#17191c]/10 px-5 py-3 text-sm text-[#5f625f] transition-colors hover:bg-white/60 hover:text-[#17191c]"
            >
              <span className="font-mono text-[9px] text-[#989a96]">
                01
              </span>

              Network
            </Link>

            <div className="relative flex min-w-fit items-center gap-3 border-r border-[#17191c]/10 bg-white px-5 py-3 text-sm">
              <span className="font-mono text-[9px] text-[#989a96]">
                02
              </span>

              Transactions

              <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#2457ff]" />
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-8 sm:px-7 lg:px-10">
        <section className="grid border-y border-[#17191c]/20 lg:grid-cols-[1.45fr_0.55fr]">
          <div className="py-9 lg:border-r lg:border-[#17191c]/20 lg:pr-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#2457ff]">
              Network sessions
            </p>

            <div className="mt-7 flex flex-wrap items-end gap-x-10 gap-y-5">
              <div>
                <p className="text-[clamp(3.8rem,8vw,7rem)] font-medium leading-[0.82] tracking-[-0.075em]">
                  {activeTransactions.length}
                </p>

                <p className="mt-4 text-sm text-[#666967]">
                  active charging sessions
                </p>
              </div>

              <div className="border-l border-[#17191c]/20 pl-6">
                <p className="font-mono text-xl">
                  {transactions.length}
                </p>

                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.13em] text-[#858783]">
                  total records
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between py-8 lg:pl-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#818480]">
                Session condition
              </p>

              <div className="mt-5 flex items-start gap-3">
                <span
                  className={`mt-1 h-3 w-3 shrink-0 ${
                    snapshot.state === "live"
                      ? activeTransactions.length > 0
                        ? "bg-[#2457ff]"
                        : "bg-[#16a36a]"
                      : "bg-[#ef7d32]"
                  }`}
                />

                <div>
                  <p className="text-xl font-medium tracking-[-0.03em]">
                    {snapshot.state === "unavailable"
                      ? "Session data unavailable"
                      : activeTransactions.length > 0
                        ? `${activeTransactions.length} ${
                            activeTransactions.length === 1
                              ? "session"
                              : "sessions"
                          } charging`
                        : "No active charging sessions"}
                  </p>

                  {snapshot.state === "unavailable" && (
                    <p className="mt-3 max-w-sm text-sm leading-6 text-[#676a67]">
                      {snapshot.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <p className="mt-10 font-mono text-[9px] uppercase leading-5 tracking-[0.12em] text-[#91938f]">
              Station Service / GraphQL
              <br />
              Network transaction read model
            </p>
          </div>
        </section>

        {activeTransactions.length > 0 && (
          <section className="mt-12">
            <div className="flex items-end justify-between border-b-2 border-[#17191c] pb-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#2457ff]">
                  Live sessions
                </p>

                <h2 className="mt-2 text-3xl font-medium tracking-[-0.045em]">
                  Charging now
                </h2>
              </div>

              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#747773]">
                {activeTransactions.length} active
              </p>
            </div>

            <div>
              {activeTransactions.map((transaction) => (
                <TransactionRow
                  key={`${transaction.stationId}-${transaction.transactionId}`}
                  transaction={transaction}
                  live
                />
              ))}
            </div>
          </section>
        )}

        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#17191c] pb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7c7f7b]">
                Session ledger
              </p>

              <h2 className="mt-2 text-3xl font-medium tracking-[-0.045em]">
                Network transactions
              </h2>
            </div>

            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#747773]">
              Active promoted
            </p>
          </div>

          <div className="hidden grid-cols-[110px_1fr_180px_120px_100px_200px] border-b border-[#17191c]/20 px-3 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[#858783] lg:grid">
            <span>State</span>
            <span>Transaction</span>
            <span>Station</span>
            <span>Endpoint</span>
            <span>Sequence</span>
            <span className="text-right">Started</span>
          </div>

          {orderedTransactions.length > 0 ? (
            orderedTransactions.map((transaction) => (
              <TransactionRow
                key={`ledger-${transaction.stationId}-${transaction.transactionId}`}
                transaction={transaction}
              />
            ))
          ) : (
            <div className="grid min-h-52 place-items-center border-b border-[#17191c]/15">
              <div className="max-w-md px-6 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8d908c]">
                  No transaction records
                </p>

                <p className="mt-3 text-sm leading-6 text-[#686b68]">
                  {snapshot.state === "live"
                    ? "No charging transactions have been recorded across the network yet."
                    : snapshot.message}
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function TransactionRow({
  transaction,
  live = false,
}: {
  transaction: ChargingTransaction;
  live?: boolean;
}) {
  return (
    <article
      className={`grid gap-5 border-b px-3 py-5 transition-colors lg:grid-cols-[110px_1fr_180px_120px_100px_200px] lg:items-center ${
        live
          ? "border-[#2457ff]/25 bg-[#2457ff]/[0.025]"
          : "border-[#17191c]/15 hover:bg-white/65"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`h-3 w-3 ${
            transaction.status === "ACTIVE"
              ? "bg-[#2457ff]"
              : "bg-[#8f918e]"
          }`}
        />

        <span className="font-mono text-[10px] uppercase tracking-[0.1em]">
          {transaction.status}
        </span>
      </div>

      <div className="min-w-0">
        <Link
          href={`/stations/${encodeURIComponent(
            transaction.stationId,
          )}/transactions/${encodeURIComponent(
            transaction.transactionId,
          )}`}
          className="group inline-flex max-w-full items-center gap-3"
        >
          <span className="truncate font-mono text-sm group-hover:text-[#2457ff]">
            {transaction.transactionId}
          </span>

          <span className="shrink-0 text-xs text-[#2457ff] transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>

        <p className="mt-1 font-mono text-[9px] text-[#858783] lg:hidden">
          {transaction.stationId}
        </p>
      </div>

      <Link
        href={`/stations/${encodeURIComponent(
          transaction.stationId,
        )}`}
        className="hidden font-mono text-xs text-[#5f625f] hover:text-[#2457ff] lg:block"
      >
        {transaction.stationId}
      </Link>

      <p className="font-mono text-xs">
        {String(transaction.evseId).padStart(2, "0")}
        <span className="mx-1 text-[#aaa9a3]">/</span>
        {String(transaction.connectorId).padStart(2, "0")}
      </p>

      <p className="font-mono text-sm">
        #{transaction.lastSequenceNumber}
      </p>

      <div className="lg:text-right">
        <p className="font-mono text-[10px] text-[#5f625f]">
          {formatTimestamp(transaction.startedAt)}
        </p>

        <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#969894]">
          {transaction.endedAt
            ? `ended ${formatTimestamp(transaction.endedAt)}`
            : "session open"}
        </p>
      </div>
    </article>
  );
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