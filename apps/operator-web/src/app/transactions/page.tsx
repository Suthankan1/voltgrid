import Link from "next/link";

import {
  getNetworkTransactions,
  type NetworkTransaction,
  type TransactionDataStatus,
} from "@/lib/station-api";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const snapshot = await getNetworkTransactions();

  const transactions = snapshot.transactions;

  const activeTransactions = transactions.filter(
    (record) => record.transaction.status === "ACTIVE",
  );

  const endedTransactions = transactions.filter(
    (record) => record.transaction.status === "ENDED",
  );

  const incompleteTransactions = transactions.filter(
    (record) => record.completeness.status === "INCOMPLETE",
  );

  const unknownTransactions = transactions.filter(
    (record) => record.completeness.status === "UNKNOWN",
  );

  const orderedTransactions = [
    ...activeTransactions,
    ...endedTransactions,
  ];

  const condition =
    snapshot.state === "unavailable"
      ? {
          label: "Session data unavailable",
          detail: snapshot.message,
          tone: "unavailable" as const,
        }
      : incompleteTransactions.length > 0
        ? {
            label: `${incompleteTransactions.length} ${
              incompleteTransactions.length === 1
                ? "record requires"
                : "records require"
            } attention`,
            detail:
              "One or more ended transaction records contain missing event receipts.",
            tone: "attention" as const,
          }
        : activeTransactions.length > 0
          ? {
              label: `${activeTransactions.length} ${
                activeTransactions.length === 1
                  ? "session"
                  : "sessions"
              } charging`,
              detail:
                "Active sessions are promoted to the top of the network ledger.",
              tone: "live" as const,
            }
          : {
              label: "No active charging sessions",
              detail:
                unknownTransactions.length > 0
                  ? `${unknownTransactions.length} historical ${
                      unknownTransactions.length === 1
                        ? "record has"
                        : "records have"
                    } insufficient receipt history for integrity assessment.`
                  : "No transaction currently has an active charging lifecycle.",
              tone: "neutral" as const,
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

              <Metric
                value={transactions.length}
                label="total records"
              />

              <Metric
                value={incompleteTransactions.length}
                label="incomplete"
                attention={incompleteTransactions.length > 0}
              />
            </div>
          </div>

          <div className="flex flex-col justify-between py-8 lg:pl-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#818480]">
                Session condition
              </p>

              <div className="mt-5 flex items-start gap-3">
                <span
                  className={`mt-1 h-3 w-3 shrink-0 ${conditionTone(
                    condition.tone,
                  )}`}
                />

                <div>
                  <p className="text-xl font-medium tracking-[-0.03em]">
                    {condition.label}
                  </p>

                  <p className="mt-3 max-w-sm text-sm leading-6 text-[#676a67]">
                    {condition.detail}
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-10 font-mono text-[9px] uppercase leading-5 tracking-[0.12em] text-[#91938f]">
              Station Service / GraphQL
              <br />
              Network transaction + integrity read model
            </p>
          </div>
        </section>

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

          <div className="hidden grid-cols-[100px_140px_1fr_170px_110px_90px_190px] border-b border-[#17191c]/20 px-3 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[#858783] lg:grid">
            <span>State</span>
            <span>Integrity</span>
            <span>Transaction</span>
            <span>Station</span>
            <span>Endpoint</span>
            <span>Sequence</span>
            <span className="text-right">Started</span>
          </div>

          {orderedTransactions.length > 0 ? (
            orderedTransactions.map((record) => (
              <TransactionRow
                key={`${record.transaction.stationId}-${record.transaction.transactionId}`}
                record={record}
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

function Metric({
  value,
  label,
  attention = false,
}: {
  value: number;
  label: string;
  attention?: boolean;
}) {
  return (
    <div className="border-l border-[#17191c]/20 pl-6">
      <p
        className={`font-mono text-xl ${
          attention ? "text-[#c54435]" : ""
        }`}
      >
        {value}
      </p>

      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.13em] text-[#858783]">
        {label}
      </p>
    </div>
  );
}

function TransactionRow({
  record,
}: {
  record: NetworkTransaction;
}) {
  const transaction = record.transaction;
  const completeness = record.completeness;

  const active = transaction.status === "ACTIVE";
  const incomplete =
    completeness.status === "INCOMPLETE";

  return (
    <article
      className={`grid gap-5 border-b px-3 py-5 transition-colors lg:grid-cols-[100px_140px_1fr_170px_110px_90px_190px] lg:items-center ${
        incomplete
          ? "border-[#c54435]/25 bg-[#c54435]/[0.025]"
          : active
            ? "border-[#2457ff]/25 bg-[#2457ff]/[0.025]"
            : "border-[#17191c]/15 hover:bg-white/65"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`h-3 w-3 ${
            active
              ? "bg-[#2457ff]"
              : "bg-[#8f918e]"
          }`}
        />

        <span className="font-mono text-[10px] uppercase tracking-[0.1em]">
          {transaction.status}
        </span>
      </div>

      <IntegrityCell
        status={completeness.status}
        missingSequenceNumbers={
          completeness.missingSequenceNumbers
        }
      />

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
        <span className="mx-1 text-[#aaa9a3]">
          /
        </span>
        {String(transaction.connectorId).padStart(
          2,
          "0",
        )}
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
            ? `ended ${formatTimestamp(
                transaction.endedAt,
              )}`
            : "session open"}
        </p>
      </div>
    </article>
  );
}

function IntegrityCell({
  status,
  missingSequenceNumbers,
}: {
  status: TransactionDataStatus;
  missingSequenceNumbers: number[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 ${integrityTone(
            status,
          )}`}
        />

        <span
          className={`font-mono text-[9px] uppercase tracking-[0.1em] ${
            status === "INCOMPLETE"
              ? "text-[#b83c30]"
              : "text-[#656865]"
          }`}
        >
          {formatIntegrityStatus(status)}
        </span>
      </div>

      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.08em] text-[#989a96]">
        {integrityDetail(
          status,
          missingSequenceNumbers,
        )}
      </p>
    </div>
  );
}

function formatIntegrityStatus(
  status: TransactionDataStatus,
) {
  switch (status) {
    case "IN_PROGRESS":
      return "In progress";
    case "COMPLETE":
      return "Complete";
    case "INCOMPLETE":
      return "Incomplete";
    case "UNKNOWN":
      return "Unknown";
  }
}

function integrityDetail(
  status: TransactionDataStatus,
  missingSequenceNumbers: number[],
) {
  switch (status) {
    case "IN_PROGRESS":
      return "receiving events";

    case "COMPLETE":
      return "sequence verified";

    case "INCOMPLETE":
      if (missingSequenceNumbers.length === 0) {
        return "receipt gap detected";
      }

      if (missingSequenceNumbers.length === 1) {
        return `gap #${missingSequenceNumbers[0]}`;
      }

      return `gaps ${missingSequenceNumbers
        .map((sequenceNumber) => `#${sequenceNumber}`)
        .join(", ")}`;

    case "UNKNOWN":
      return "insufficient history";
  }
}

function integrityTone(
  status: TransactionDataStatus,
) {
  switch (status) {
    case "IN_PROGRESS":
      return "bg-[#2457ff]";
    case "COMPLETE":
      return "bg-[#16a36a]";
    case "INCOMPLETE":
      return "bg-[#c54435]";
    case "UNKNOWN":
      return "bg-[#a1a39f]";
  }
}

function conditionTone(
  tone:
    | "unavailable"
    | "attention"
    | "live"
    | "neutral",
) {
  switch (tone) {
    case "unavailable":
      return "bg-[#ef7d32]";
    case "attention":
      return "bg-[#c54435]";
    case "live":
      return "bg-[#2457ff]";
    case "neutral":
      return "bg-[#92948f]";
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