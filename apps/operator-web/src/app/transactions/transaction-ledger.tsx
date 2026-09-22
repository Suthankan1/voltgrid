"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  NetworkTransaction,
  TransactionDataStatus,
} from "@/lib/station-api";

type LifecycleFilter =
  | "ALL"
  | "ACTIVE";

type TransactionLedgerProps = {
  transactions: NetworkTransaction[];
  page: number;
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
  stationFilter?: string;
  queryFilter?: string;
  integrityFilter?: TransactionDataStatus;
  unavailableMessage?: string;
};

const integrityOptions: Array<{
  label: string;
  value?: TransactionDataStatus;
}> = [
  {
    label: "All",
  },
  {
    label: "In progress",
    value: "IN_PROGRESS",
  },
  {
    label: "Complete",
    value: "COMPLETE",
  },
  {
    label: "Incomplete",
    value: "INCOMPLETE",
  },
  {
    label: "Unknown",
    value: "UNKNOWN",
  },
];

export function TransactionLedger({
  transactions,
  page,
  totalPages,
  totalElements,
  hasNext,
  stationFilter,
  queryFilter,
  integrityFilter,
  unavailableMessage,
}: TransactionLedgerProps) {
  const [lifecycleFilter, setLifecycleFilter] =
    useState<LifecycleFilter>("ALL");

  const visibleTransactions = useMemo(() => {
    if (lifecycleFilter === "ACTIVE") {
      return transactions.filter(
        (record) =>
          record.transaction.status === "ACTIVE",
      );
    }

    return transactions;
  }, [
    lifecycleFilter,
    transactions,
  ]);

  const serverFiltersActive =
    stationFilter !== undefined ||
    queryFilter !== undefined ||
    integrityFilter !== undefined;

  const displayedPage =
    totalPages === 0
      ? 0
      : page + 1;

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b-2 border-[#17191c] pb-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7c7f7b]">
            Session ledger
          </p>

          <h2 className="mt-2 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">
            Network transactions
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#686b68]">
            Search network history, review
            transaction integrity and inspect
            individual charging sessions.
          </p>
        </div>

        <div className="text-left sm:text-right">
          <p className="font-mono text-2xl tracking-[-0.04em]">
            {totalElements}
          </p>

          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#858783]">
            {serverFiltersActive
              ? "matching transactions"
              : "network transactions"}
          </p>
        </div>
      </div>

      <div className="border-b border-[#17191c]/20">
        <div className="grid gap-7 py-6 xl:grid-cols-[220px_1fr]">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#858783]">
              Page lifecycle
            </p>

            <p className="mt-2 text-xs leading-5 text-[#777a76]">
              Changes only the records already
              loaded on this page.
            </p>
          </div>

          <div className="flex flex-wrap">
            <LifecycleButton
              label="All"
              active={
                lifecycleFilter === "ALL"
              }
              onClick={() =>
                setLifecycleFilter("ALL")
              }
            />

            <LifecycleButton
              label="Active"
              active={
                lifecycleFilter === "ACTIVE"
              }
              onClick={() =>
                setLifecycleFilter("ACTIVE")
              }
              last
            />
          </div>
        </div>

        <div className="grid gap-7 border-t border-[#17191c]/10 py-6 xl:grid-cols-[220px_1fr]">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#858783]">
              Network integrity
            </p>

            <p className="mt-2 text-xs leading-5 text-[#777a76]">
              Filters the complete transaction
              history on the server.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {integrityOptions.map(
              (option) => {
                const active =
                  integrityFilter ===
                  option.value;

                return (
                  <Link
                    key={
                      option.value ??
                      "ALL"
                    }
                    href={buildTransactionPageHref(
                      0,
                      stationFilter,
                      queryFilter,
                      option.value,
                    )}
                    className={`border px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
                      active
                        ? "border-[#17191c] bg-[#17191c] text-white"
                        : "border-[#17191c]/20 text-[#626562] hover:border-[#17191c]/50 hover:bg-white"
                    }`}
                  >
                    {option.label}
                  </Link>
                );
              },
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-[#17191c]/20 py-6">
        <form
          action="/transactions"
          method="get"
          className="grid gap-4 lg:grid-cols-[minmax(180px,0.7fr)_minmax(240px,1fr)_auto_auto]"
        >
          <input
            type="hidden"
            name="page"
            value="0"
          />

          {integrityFilter && (
            <input
              type="hidden"
              name="integrity"
              value={integrityFilter}
            />
          )}

          <label>
            <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.13em] text-[#858783]">
              Station
            </span>

            <input
              type="search"
              name="station"
              defaultValue={
                stationFilter ?? ""
              }
              placeholder="STATION-003"
              autoComplete="off"
              className="h-11 w-full border border-[#17191c]/25 bg-transparent px-3 font-mono text-xs outline-none transition-colors placeholder:text-[#aaa9a3] focus:border-[#2457ff]"
            />
          </label>

          <label>
            <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.13em] text-[#858783]">
              Transaction
            </span>

            <input
              type="search"
              name="q"
              defaultValue={
                queryFilter ?? ""
              }
              placeholder="Search transaction ID"
              autoComplete="off"
              className="h-11 w-full border border-[#17191c]/25 bg-transparent px-3 font-mono text-xs outline-none transition-colors placeholder:text-[#aaa9a3] focus:border-[#2457ff]"
            />
          </label>

          <button
            type="submit"
            className="h-11 self-end bg-[#17191c] px-5 font-mono text-[9px] uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#2457ff]"
          >
            Apply filters
          </button>

          <Link
            href="/transactions"
            className="flex h-11 items-center justify-center self-end border border-[#17191c]/20 px-5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#686b68] transition-colors hover:border-[#17191c]/50 hover:bg-white hover:text-[#17191c]"
          >
            Reset
          </Link>
        </form>

        {serverFiltersActive && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[#92948f]">
              Active filters
            </span>

            {stationFilter && (
              <FilterChip
                label={`Station · ${stationFilter}`}
                href={buildTransactionPageHref(
                  0,
                  undefined,
                  queryFilter,
                  integrityFilter,
                )}
              />
            )}

            {queryFilter && (
              <FilterChip
                label={`Transaction · ${queryFilter}`}
                href={buildTransactionPageHref(
                  0,
                  stationFilter,
                  undefined,
                  integrityFilter,
                )}
              />
            )}

            {integrityFilter && (
              <FilterChip
                label={`Integrity · ${formatIntegrityStatus(
                  integrityFilter,
                )}`}
                href={buildTransactionPageHref(
                  0,
                  stationFilter,
                  queryFilter,
                  undefined,
                )}
              />
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#17191c]/10 pt-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.11em] text-[#747774]">
            {visibleTransactions.length}
            <span className="mx-2 text-[#aaa9a3]">
              /
            </span>
            {transactions.length}
            <span className="ml-2 text-[#92948f]">
              shown on this page
            </span>
          </p>

          <p className="max-w-xl text-xs leading-5 text-[#858783]">
            Station, transaction and integrity
            filters run across network history.
            Lifecycle is a quick view of the
            current page.
          </p>
        </div>
      </div>

      <div className="hidden grid-cols-[minmax(240px,1.6fr)_160px_120px_150px_120px_220px] border-b border-[#17191c]/20 px-3 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[#858783] lg:grid">
        <span>Transaction</span>
        <span>Station</span>
        <span>Lifecycle</span>
        <span>Integrity</span>
        <span>Sequence</span>

        <span className="text-right">
          Timing
        </span>
      </div>

      {visibleTransactions.length > 0 ? (
        visibleTransactions.map(
          (record) => (
            <TransactionRow
              key={`${record.transaction.stationId}-${record.transaction.transactionId}`}
              record={record}
            />
          ),
        )
      ) : (
        <div className="grid min-h-52 place-items-center border-b border-[#17191c]/15">
          <div className="max-w-md px-6 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8d908c]">
              {unavailableMessage
                ? "Transaction data unavailable"
                : transactions.length > 0
                  ? "No transactions in this view"
                  : serverFiltersActive
                    ? "No matching transactions"
                    : "No transactions available"}
            </p>

            <p className="mt-3 text-sm leading-6 text-[#686b68]">
              {unavailableMessage ??
                (transactions.length > 0
                  ? "Switch the lifecycle view to show the other records on this page."
                  : serverFiltersActive
                    ? "No transaction matches the current network filters."
                    : "No charging transactions are available in the current network history.")}
            </p>
          </div>
        </div>
      )}

      {!unavailableMessage && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#17191c]/20 py-5">
          <PaginationLink
            direction="previous"
            page={page}
            enabled={page > 0}
            stationFilter={stationFilter}
            queryFilter={queryFilter}
            integrityFilter={
              integrityFilter
            }
          />

          <div className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f625f]">
              Page {displayedPage} of{" "}
              {totalPages}
            </p>

            <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#989a96]">
              {totalElements}{" "}
              {totalElements === 1
                ? "transaction"
                : "transactions"}
              {serverFiltersActive
                ? " match current network filters"
                : " across network history"}
            </p>
          </div>

          <PaginationLink
            direction="next"
            page={page}
            enabled={hasNext}
            stationFilter={stationFilter}
            queryFilter={queryFilter}
            integrityFilter={
              integrityFilter
            }
          />
        </div>
      )}
    </section>
  );
}

function LifecycleButton({
  label,
  active,
  onClick,
  last = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  last?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-10 border-y border-l border-[#17191c]/25 px-5 font-mono text-[9px] uppercase tracking-[0.11em] transition-colors ${
        last
          ? "border-r"
          : ""
      } ${
        active
          ? "bg-[#17191c] text-white"
          : "bg-transparent text-[#626562] hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}

function FilterChip({
  label,
  href,
}: {
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 border border-[#17191c]/20 bg-white/60 px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.09em] text-[#626562] transition-colors hover:border-[#17191c]/45 hover:text-[#17191c]"
    >
      {label}

      <span
        aria-hidden="true"
        className="text-[#92948f]"
      >
        ×
      </span>
    </Link>
  );
}

function TransactionRow({
  record,
}: {
  record: NetworkTransaction;
}) {
  const transaction =
    record.transaction;

  const completeness =
    record.completeness;

  const active =
    transaction.status === "ACTIVE";

  const incomplete =
    completeness.status ===
    "INCOMPLETE";

  return (
    <article
      className={`grid gap-5 border-b px-3 py-5 transition-colors lg:grid-cols-[minmax(240px,1.6fr)_160px_120px_150px_120px_220px] lg:items-center ${
        incomplete
          ? "border-[#c54435]/25 bg-[#c54435]/[0.025]"
          : active
            ? "border-[#2457ff]/25 bg-[#2457ff]/[0.025]"
            : "border-[#17191c]/15 hover:bg-white/65"
      }`}
    >
      <div className="min-w-0">
        <p className="mb-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[#92948f] lg:hidden">
          Transaction
        </p>

        <Link
          href={`/stations/${encodeURIComponent(
            transaction.stationId,
          )}/transactions/${encodeURIComponent(
            transaction.transactionId,
          )}`}
          className="group inline-flex max-w-full items-center gap-3"
        >
          <span className="truncate font-mono text-sm font-medium group-hover:text-[#2457ff]">
            {transaction.transactionId}
          </span>

          <span className="shrink-0 text-xs text-[#2457ff] transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>

        <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.09em] text-[#92948f]">
          EVSE{" "}
          {String(
            transaction.evseId,
          ).padStart(2, "0")}
          <span className="mx-1.5">
            ·
          </span>
          Connector{" "}
          {String(
            transaction.connectorId,
          ).padStart(2, "0")}
        </p>
      </div>

      <div>
        <p className="mb-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[#92948f] lg:hidden">
          Station
        </p>

        <Link
          href={`/stations/${encodeURIComponent(
            transaction.stationId,
          )}`}
          className="font-mono text-xs text-[#5f625f] transition-colors hover:text-[#2457ff]"
        >
          {transaction.stationId}
        </Link>
      </div>

      <div>
        <p className="mb-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[#92948f] lg:hidden">
          Lifecycle
        </p>

        <StatusBadge
          status={
            transaction.status
          }
        />
      </div>

      <div>
        <p className="mb-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[#92948f] lg:hidden">
          Integrity
        </p>

        <IntegrityBadge
          status={
            completeness.status
          }
          missingSequenceNumbers={
            completeness.missingSequenceNumbers
          }
        />
      </div>

      <div>
        <p className="mb-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[#92948f] lg:hidden">
          Sequence
        </p>

        <p className="font-mono text-xs">
          {formatSequenceRange(
            completeness.firstSequenceNumber,
            completeness.lastSequenceNumber,
          )}
        </p>
      </div>

      <div className="lg:text-right">
        <p className="mb-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[#92948f] lg:hidden">
          Timing
        </p>

        <p className="font-mono text-[10px] text-[#5f625f]">
          {formatTimestamp(
            transaction.startedAt,
          )}
        </p>

        <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.09em] text-[#969894]">
          {transaction.endedAt
            ? `Ended ${formatTimestamp(
                transaction.endedAt,
              )}`
            : "Session open"}
        </p>
      </div>
    </article>
  );
}

function StatusBadge({
  status,
}: {
  status: "ACTIVE" | "ENDED";
}) {
  const active =
    status === "ACTIVE";

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 ${
          active
            ? "bg-[#2457ff]"
            : "bg-[#8f918e]"
        }`}
      />

      <span
        className={`font-mono text-[9px] uppercase tracking-[0.1em] ${
          active
            ? "text-[#2457ff]"
            : "text-[#5f625f]"
        }`}
      >
        {active
          ? "Active"
          : "Ended"}
      </span>
    </div>
  );
}

function IntegrityBadge({
  status,
  missingSequenceNumbers,
}: {
  status: TransactionDataStatus;
  missingSequenceNumbers: number[];
}) {
  return (
    <div>
      <div className="inline-flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 ${integrityTone(
            status,
          )}`}
        />

        <span
          className={`font-mono text-[9px] uppercase tracking-[0.1em] ${
            status === "INCOMPLETE"
              ? "text-[#b83c30]"
              : status === "COMPLETE"
                ? "text-[#167451]"
                : status === "IN_PROGRESS"
                  ? "text-[#2457ff]"
                  : "text-[#656865]"
          }`}
        >
          {formatIntegrityStatus(
            status,
          )}
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

function PaginationLink({
  direction,
  page,
  enabled,
  stationFilter,
  queryFilter,
  integrityFilter,
}: {
  direction:
    | "previous"
    | "next";
  page: number;
  enabled: boolean;
  stationFilter?: string;
  queryFilter?: string;
  integrityFilter?: TransactionDataStatus;
}) {
  const previous =
    direction === "previous";

  const label =
    previous
      ? "← Previous"
      : "Next →";

  const targetPage =
    previous
      ? page - 1
      : page + 1;

  if (!enabled) {
    return (
      <span className="border border-[#17191c]/10 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[#aaa9a3]">
        {label}
      </span>
    );
  }

  return (
    <Link
      href={buildTransactionPageHref(
        targetPage,
        stationFilter,
        queryFilter,
        integrityFilter,
      )}
      className="border border-[#17191c]/25 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors hover:border-[#17191c] hover:bg-white"
    >
      {label}
    </Link>
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
      if (
        missingSequenceNumbers.length ===
        0
      ) {
        return "receipt gap detected";
      }

      if (
        missingSequenceNumbers.length ===
        1
      ) {
        return `missing #${missingSequenceNumbers[0]}`;
      }

      return `missing ${missingSequenceNumbers
        .map(
          (sequenceNumber) =>
            `#${sequenceNumber}`,
        )
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

function formatSequenceRange(
  firstSequenceNumber:
    | number
    | null,
  lastSequenceNumber: number,
) {
  if (
    firstSequenceNumber === null
  ) {
    return `— → ${lastSequenceNumber}`;
  }

  if (
    firstSequenceNumber ===
    lastSequenceNumber
  ) {
    return `#${lastSequenceNumber}`;
  }

  return `${firstSequenceNumber} → ${lastSequenceNumber}`;
}

function formatTimestamp(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
      timeZoneName: "short",
    },
  ).format(date);
}

function buildTransactionPageHref(
  page: number,
  stationFilter?: string,
  queryFilter?: string,
  integrityFilter?: TransactionDataStatus,
) {
  const params =
    new URLSearchParams();

  params.set(
    "page",
    String(page),
  );

  if (stationFilter) {
    params.set(
      "station",
      stationFilter,
    );
  }

  if (queryFilter) {
    params.set(
      "q",
      queryFilter,
    );
  }

  if (integrityFilter) {
    params.set(
      "integrity",
      integrityFilter,
    );
  }

  return `/transactions?${params.toString()}`;
}