import Link from "next/link";
import { redirect } from "next/navigation";

import { getNetworkTransactionPage } from "@/lib/station-api";

import { TransactionLedger } from "./transaction-ledger";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type TransactionsPageProps = {
  searchParams: Promise<{
    page?: string | string[];
  }>;
};

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const params = await searchParams;

  const requestedPage = parsePage(
    params.page,
  );

  const snapshot =
    await getNetworkTransactionPage(
      requestedPage,
      PAGE_SIZE,
    );

  if (snapshot.state === "live") {
    const lastPage = Math.max(
      snapshot.totalPages - 1,
      0,
    );

    if (requestedPage > lastPage) {
      redirect(
        `/transactions?page=${lastPage}`,
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
            } attention on this page`,
            detail:
              "The current page contains ended transaction records with missing event receipts.",
            tone: "attention" as const,
          }
        : activeTransactions.length > 0
          ? {
              label: `${activeTransactions.length} ${
                activeTransactions.length === 1
                  ? "session"
                  : "sessions"
              } charging on this page`,
              detail:
                "Active sessions are promoted within the currently loaded transaction page.",
              tone: "live" as const,
            }
          : {
              label:
                "No active charging sessions on this page",
              detail:
                unknownTransactions.length > 0
                  ? `${unknownTransactions.length} ${
                      unknownTransactions.length === 1
                        ? "record has"
                        : "records have"
                    } insufficient receipt history on this page.`
                  : "The currently loaded transaction page contains no active charging lifecycle.",
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
                  active on this page
                </p>
              </div>

              <Metric
                value={
                  snapshot.totalElements
                }
                label="total records"
              />

              <Metric
                value={
                  incompleteTransactions.length
                }
                label="incomplete on page"
                attention={
                  incompleteTransactions.length > 0
                }
              />
            </div>
          </div>

          <div className="flex flex-col justify-between py-8 lg:pl-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#818480]">
                Page condition
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
              Paginated transaction + integrity
              read model
            </p>
          </div>
        </section>

        <TransactionLedger
          transactions={orderedTransactions}
          page={snapshot.page}
          totalPages={snapshot.totalPages}
          totalElements={
            snapshot.totalElements
          }
          hasNext={snapshot.hasNext}
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
          attention
            ? "text-[#c54435]"
            : ""
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