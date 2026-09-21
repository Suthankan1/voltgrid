"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
} from "react";

import type {
  NetworkTransaction,
  TransactionDataStatus,
} from "@/lib/station-api";

type LedgerFilter =
  | "ALL"
  | "ACTIVE";

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
}: {
  transactions: NetworkTransaction[];
  page: number;
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
  stationFilter?: string;
  queryFilter?: string;
  integrityFilter?: TransactionDataStatus;
  unavailableMessage?: string;
}) {
  const [filter, setFilter] =
    useState<LedgerFilter>("ALL");

  const filteredTransactions =
    useMemo(() => {
      if (filter === "ALL") {
        return transactions;
      }

      return transactions.filter(
        (record) =>
          record.transaction.status ===
          "ACTIVE",
      );
    }, [
      filter,
      transactions,
    ]);

  const displayedPage =
    totalPages === 0
      ? 0
      : page + 1;

  const filtersActive =
    Boolean(stationFilter) ||
    Boolean(queryFilter) ||
    Boolean(integrityFilter);

  return (
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

        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#747773]">
            Page {displayedPage} /{" "}
            {totalPages}
          </p>

          <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#999b97]">
            {totalElements}{" "}
            {totalElements === 1
              ? "record"
              : "records"}
            {filtersActive
              ? " matching server filters"
              : " total"}
          </p>
        </div>
      </div>

      <div className="border-b border-[#17191c]/20 py-5">
        <div className="grid gap-5 xl:grid-cols-[auto_auto_1fr_auto] xl:items-end">
          <div>
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.13em] text-[#858783]">
              Page lifecycle
            </p>

            <div className="flex">
              <FilterButton
                label="All"
                active={filter === "ALL"}
                onClick={() =>
                  setFilter("ALL")
                }
              />

              <FilterButton
                label="Active"
                active={
                  filter === "ACTIVE"
                }
                onClick={() =>
                  setFilter("ACTIVE")
                }
                last
              />
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.13em] text-[#858783]">
              Network integrity
            </p>

            <div className="flex">
              <Link
                href={buildTransactionPageHref(
                  0,
                  stationFilter,
                  queryFilter,
                )}
                className={`grid h-10 place-items-center border-y border-l border-[#17191c]/25 px-4 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
                  !integrityFilter
                    ? "bg-[#17191c] text-white"
                    : "bg-transparent text-[#626562] hover:bg-white"
                }`}
              >
                All
              </Link>

              <Link
                href={buildTransactionPageHref(
                  0,
                  stationFilter,
                  queryFilter,
                  "INCOMPLETE",
                )}
                className={`grid h-10 place-items-center border border-[#17191c]/25 px-4 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
                  integrityFilter === "INCOMPLETE"
                    ? "bg-[#17191c] text-white"
                    : "bg-transparent text-[#626562] hover:bg-white"
                }`}
              >
                Incomplete
              </Link>
            </div>
          </div>

          <form
            action="/transactions"
            method="get"
            className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px_auto]"
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
                Transaction ID
              </span>

              <input
                name="q"
                type="search"
                defaultValue={
                  queryFilter ?? ""
                }
                placeholder="Search all transactions…"
                className="h-10 w-full border border-[#17191c]/25 bg-transparent px-3 font-mono text-xs outline-none transition-colors placeholder:text-[#a0a29e] focus:border-[#2457ff]"
              />
            </label>

            <label>
              <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.13em] text-[#858783]">
                Station ID
              </span>

              <input
                name="station"
                type="search"
                defaultValue={
                  stationFilter ?? ""
                }
                placeholder="Exact station ID…"
                className="h-10 w-full border border-[#17191c]/25 bg-transparent px-3 font-mono text-xs outline-none transition-colors placeholder:text-[#a0a29e] focus:border-[#2457ff]"
              />
            </label>

            <div>
              <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.13em] text-transparent">
                Actions
              </p>

              <div className="flex h-10">
                <button
                  type="submit"
                  className="border border-[#17191c] bg-[#17191c] px-4 font-mono text-[9px] uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#2a2d30]"
                >
                  Apply
                </button>

                <Link
                  href="/transactions"
                  className="grid place-items-center border-y border-r border-[#17191c]/25 px-4 font-mono text-[9px] uppercase tracking-[0.12em] text-[#626562] transition-colors hover:bg-white"
                >
                  Clear
                </Link>
              </div>
            </div>
          </form>

          <div className="xl:text-right">
            <p className="font-mono text-xl">
              {filteredTransactions.length}

              <span className="mx-2 text-[#aaa9a3]">
                /
              </span>

              {transactions.length}
            </p>

            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#858783]">
              shown on this page
            </p>
          </div>
        </div>

        <p className="mt-4 font-mono text-[8px] uppercase leading-5 tracking-[0.1em] text-[#989a96]">
          Station, transaction and integrity
          filters run server-side across network
          history. Active only changes the
          currently loaded page.
        </p>
      </div>

      <div className="hidden grid-cols-[100px_140px_1fr_170px_110px_90px_190px] border-b border-[#17191c]/20 px-3 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[#858783] lg:grid">
        <span>State</span>
        <span>Integrity</span>
        <span>Transaction</span>
        <span>Station</span>
        <span>Endpoint</span>
        <span>Sequence</span>

        <span className="text-right">
          Started
        </span>
      </div>

      {filteredTransactions.length > 0 ? (
        filteredTransactions.map(
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
                  ? "No transactions in this page view"
                  : filtersActive
                    ? "No matching transactions"
                    : "No transactions on this page"}
            </p>

            <p className="mt-3 text-sm leading-6 text-[#686b68]">
              {unavailableMessage ??
                (transactions.length > 0
                  ? "Change the page-local lifecycle view to show more records from this loaded page."
                  : filtersActive
                    ? "No network transaction matches the current server-side filters."
                    : "There are no transaction records in the currently loaded page.")}
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
            integrityFilter={integrityFilter}
          />

          <div className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f625f]">
              Page {displayedPage} of{" "}
              {totalPages}
            </p>

            <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#989a96]">
              {totalElements}{" "}
              {totalElements === 1
                ? "record"
                : "records"}
              {filtersActive
                ? " match current server filters"
                : " across network history"}
            </p>
          </div>

          <PaginationLink
            direction="next"
            page={page}
            enabled={hasNext}
            stationFilter={stationFilter}
            queryFilter={queryFilter}
            integrityFilter={integrityFilter}
          />
        </div>
      )}
    </section>
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
  direction: "previous" | "next";
  page: number;
  enabled: boolean;
  stationFilter?: string;
  queryFilter?: string;
  integrityFilter?: TransactionDataStatus;
}) {
  const previous =
    direction === "previous";

  const label = previous
    ? "← Previous"
    : "Next →";

  const targetPage = previous
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

function FilterButton({
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
      onClick={onClick}
      className={`h-10 border-y border-l border-[#17191c]/25 px-4 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
        last ? "border-r" : ""
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
        {String(
          transaction.evseId,
        ).padStart(2, "0")}

        <span className="mx-1 text-[#aaa9a3]">
          /
        </span>

        {String(
          transaction.connectorId,
        ).padStart(2, "0")}
      </p>

      <p className="font-mono text-sm">
        #{transaction.lastSequenceNumber}
      </p>

      <div className="lg:text-right">
        <p className="font-mono text-[10px] text-[#5f625f]">
          {formatTimestamp(
            transaction.startedAt,
          )}
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
        return `gap #${missingSequenceNumbers[0]}`;
      }

      return `gaps ${missingSequenceNumbers
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

function formatTimestamp(
  value: string,
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
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
  const params = new URLSearchParams();

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
