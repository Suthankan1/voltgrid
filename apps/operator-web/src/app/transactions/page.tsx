import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getNetworkTransactionPage,
  type TransactionDataStatus,
} from "@/lib/station-api";

import { TransactionLedger } from "./transaction-ledger";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type TransactionsSearchParams = {
  page?: string | string[];
  station?: string | string[];
  q?: string | string[];
  integrity?: string | string[];
};

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<TransactionsSearchParams>;
}) {
  const params = await searchParams;

  const requestedPage = parsePage(params.page);

  const stationId = parseOptionalFilter(
    params.station,
  );

  const transactionId = parseOptionalFilter(
    params.q,
  );

  const integrityStatus =
    parseIntegrityStatus(
      params.integrity,
    );

  const snapshot = await getNetworkTransactionPage(
    requestedPage,
    PAGE_SIZE,
    {
      stationId,
      transactionId,
      integrityStatus,
    },
  );

  if (snapshot.state === "live") {
    const lastPage = Math.max(
      snapshot.totalPages - 1,
      0,
    );

    if (requestedPage > lastPage) {
      redirect(
        buildTransactionsHref(
          lastPage,
          stationId,
          transactionId,
          integrityStatus,
        ),
      );
    }
  }

  const transactions = snapshot.transactions;

  const activeTransactions =
    transactions.filter(
      (record) =>
        record.transaction.status === "ACTIVE",
    );

  const endedTransactions =
    transactions.filter(
      (record) =>
        record.transaction.status === "ENDED",
    );

  const incompleteTransactions =
    transactions.filter(
      (record) =>
        record.completeness.status ===
        "INCOMPLETE",
    );

  const unknownTransactions =
    transactions.filter(
      (record) =>
        record.completeness.status ===
        "UNKNOWN",
    );

  const orderedTransactions = [
    ...activeTransactions,
    ...endedTransactions,
  ];

  const filtersActive =
    stationId !== undefined ||
    transactionId !== undefined ||
    integrityStatus !== undefined;

  const condition =
    snapshot.state === "unavailable"
      ? {
          title: "Transaction data unavailable",
          detail: snapshot.message,
          tone: "unavailable" as const,
        }
      : incompleteTransactions.length > 0
        ? {
            title: "Integrity review required",
            detail: `${incompleteTransactions.length} ${
              incompleteTransactions.length === 1
                ? "transaction on this page has"
                : "transactions on this page have"
            } missing event receipts.`,
            tone: "attention" as const,
          }
        : activeTransactions.length > 0
          ? {
              title: "Charging activity detected",
              detail: `${activeTransactions.length} ${
                activeTransactions.length === 1
                  ? "transaction is"
                  : "transactions are"
              } currently active on this page.`,
              tone: "live" as const,
            }
          : unknownTransactions.length > 0
            ? {
                title: "Historical data available",
                detail: `${unknownTransactions.length} ${
                  unknownTransactions.length === 1
                    ? "transaction has"
                    : "transactions have"
                } insufficient receipt history for integrity verification.`,
                tone: "neutral" as const,
              }
            : {
                title: "Transaction history healthy",
                detail:
                  "No active sessions or integrity issues are visible on this page.",
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
        <section className="border-y border-[#17191c]/20">
          <div className="grid gap-8 py-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#2457ff]">
                Network sessions
              </p>

              <h1 className="mt-3 max-w-3xl text-[clamp(2.5rem,6vw,5.5rem)] font-medium leading-[0.9] tracking-[-0.065em]">
                Transaction operations
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-6 text-[#666967]">
                Inspect charging lifecycle state,
                transaction integrity and network
                history from the Station Service
                read model.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`h-2.5 w-2.5 ${conditionTone(
                  condition.tone,
                )}`}
              />

              <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#747774]">
                {snapshot.state === "live"
                  ? "Live data"
                  : "Service unavailable"}
              </span>
            </div>
          </div>

          <div className="grid border-t border-[#17191c]/15 sm:grid-cols-3">
            <SummaryMetric
              value={activeTransactions.length}
              label="Active sessions"
              detail="current page"
              tone={
                activeTransactions.length > 0
                  ? "live"
                  : "default"
              }
            />

            <SummaryMetric
              value={incompleteTransactions.length}
              label="Integrity issues"
              detail="current page"
              tone={
                incompleteTransactions.length > 0
                  ? "attention"
                  : "default"
              }
            />

            <SummaryMetric
              value={snapshot.totalElements}
              label={
                filtersActive
                  ? "Matching transactions"
                  : "Network transactions"
              }
              detail={
                filtersActive
                  ? "server-filtered history"
                  : "total history"
              }
            />
          </div>

          <div className="grid border-t border-[#17191c]/15 lg:grid-cols-[220px_1fr]">
            <div className="py-5 lg:border-r lg:border-[#17191c]/15 lg:pr-6">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#858783]">
                Session condition
              </p>
            </div>

            <div className="py-5 lg:pl-7">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 ${conditionTone(
                    condition.tone,
                  )}`}
                />

                <div>
                  <p className="text-base font-medium tracking-[-0.025em]">
                    {condition.title}
                  </p>

                  <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#686b68]">
                    {condition.detail}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <TransactionLedger
          key={`${stationId ?? ""}:${transactionId ?? ""}:${integrityStatus ?? ""}`}
          transactions={orderedTransactions}
          page={snapshot.page}
          totalPages={snapshot.totalPages}
          totalElements={snapshot.totalElements}
          hasNext={snapshot.hasNext}
          stationFilter={stationId}
          queryFilter={transactionId}
          integrityFilter={integrityStatus}
          unavailableMessage={
            snapshot.state === "unavailable"
              ? snapshot.message
              : undefined
          }
        />
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
  tone?: "default" | "live" | "attention";
}) {
  return (
    <div className="border-b border-[#17191c]/15 px-0 py-6 last:border-b-0 sm:border-r sm:border-b-0 sm:px-6 sm:first:pl-0 sm:last:border-r-0">
      <div className="flex items-baseline gap-3">
        <p
          className={`font-mono text-3xl tracking-[-0.04em] ${
            tone === "live"
              ? "text-[#2457ff]"
              : tone === "attention"
                ? "text-[#c54435]"
                : "text-[#17191c]"
          }`}
        >
          {value}
        </p>

        {tone !== "default" && (
          <span
            className={`h-2 w-2 ${
              tone === "live"
                ? "bg-[#2457ff]"
                : "bg-[#c54435]"
            }`}
          />
        )}
      </div>

      <p className="mt-3 text-sm font-medium">
        {label}
      </p>

      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#92948f]">
        {detail}
      </p>
    </div>
  );
}

function conditionTone(
  tone:
    | "unavailable"
    | "attention"
    | "live"
    | "neutral"
    | "healthy",
) {
  switch (tone) {
    case "unavailable":
      return "bg-[#ef7d32]";

    case "attention":
      return "bg-[#c54435]";

    case "live":
      return "bg-[#2457ff]";

    case "healthy":
      return "bg-[#16a36a]";

    case "neutral":
      return "bg-[#92948f]";
  }
}

function parsePage(
  value: string | string[] | undefined,
) {
  const candidate =
    Array.isArray(value)
      ? value[0]
      : value;

  if (!candidate) {
    return 0;
  }

  const parsed = Number(candidate);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0
  ) {
    return 0;
  }

  return parsed;
}

function parseOptionalFilter(
  value: string | string[] | undefined,
): string | undefined {
  const candidate =
    Array.isArray(value)
      ? value[0]
      : value;

  if (!candidate) {
    return undefined;
  }

  const normalized = candidate.trim();

  return normalized.length > 0
    ? normalized
    : undefined;
}

function parseIntegrityStatus(
  value: string | string[] | undefined,
): TransactionDataStatus | undefined {
  const candidate =
    Array.isArray(value)
      ? value[0]
      : value;

  switch (candidate) {
    case "IN_PROGRESS":
    case "COMPLETE":
    case "INCOMPLETE":
    case "UNKNOWN":
      return candidate;

    default:
      return undefined;
  }
}

function buildTransactionsHref(
  page: number,
  stationId?: string,
  transactionId?: string,
  integrityStatus?: TransactionDataStatus,
) {
  const params = new URLSearchParams();

  params.set(
    "page",
    String(page),
  );

  if (stationId) {
    params.set(
      "station",
      stationId,
    );
  }

  if (transactionId) {
    params.set(
      "q",
      transactionId,
    );
  }

  if (integrityStatus) {
    params.set(
      "integrity",
      integrityStatus,
    );
  }

  return `/transactions?${params.toString()}`;
}