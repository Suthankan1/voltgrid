import Link from "next/link";
import { CopyValueButton } from "@/components/stations/copy-value-button";
import {
  SessionCompletenessIndicator,
  SessionLifecycleIndicator,
} from "@/components/ui/status-indicator";
import type { SessionDirectoryRow } from "@/lib/sessions-directory-model";

export interface SessionsDirectoryRecordsProps {
  rows: readonly SessionDirectoryRow[];
  caption: string;
}

function formatTimingSummary(row: SessionDirectoryRow): string {
  if (row.transaction.status === "ACTIVE") {
    return "Ongoing session";
  }
  if (row.durationLabel) {
    return `Duration ${row.durationLabel}`;
  }
  return row.endedAtUtc ? `Ended ${row.endedAtUtc}` : "Ended";
}

/**
 * Accessible desktop table and responsive mobile cards presenting composite
 * `(stationId, transactionId)` session records with separated lifecycle and
 * completeness domains, copyable identifiers, and zero nested interactive elements.
 */
export function SessionsDirectoryRecords({
  rows,
  caption,
}: SessionsDirectoryRecordsProps) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              <th scope="col" className="px-3 py-3 lg:px-4">Session</th>
              <th scope="col" className="px-3 py-3 lg:px-4">Station</th>
              <th scope="col" className="px-3 py-3 lg:px-4">Equipment</th>
              <th scope="col" className="px-3 py-3 lg:px-4">Lifecycle</th>
              <th scope="col" className="px-3 py-3 lg:px-4">Data completeness</th>
              <th scope="col" className="px-3 py-3 lg:px-4">Started (UTC)</th>
              <th scope="col" className="px-3 py-3 lg:px-4">Timing</th>
              <th scope="col" className="px-3 py-3 text-right lg:px-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--vg-border)]">
            {rows.map(row => {
              const { transaction, completeness } = row;
              const timingSummary = formatTimingSummary(row);

              return (
                <tr
                  key={row.compositeKey}
                  className="transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-surface-subtle)]/60"
                >
                  <td className="max-w-[15rem] px-3 py-3.5 align-middle lg:px-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={row.sessionHref}
                        className="inline-flex min-h-11 items-center break-all rounded-[var(--vg-radius-sm)] font-mono text-[0.8125rem] font-semibold text-[color:var(--vg-text-primary)] hover:text-[color:var(--vg-brand)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                      >
                        {transaction.transactionId}
                      </Link>
                      <CopyValueButton
                        value={transaction.transactionId}
                        label="Copy"
                        ariaLabel={`Copy session identifier ${transaction.transactionId}`}
                      />
                    </div>
                  </td>

                  <td className="max-w-[14rem] px-3 py-3.5 align-middle lg:px-4">
                    <Link
                      href={row.stationHref}
                      className="inline-flex min-h-11 flex-col justify-center break-words rounded-[var(--vg-radius-sm)] hover:text-[color:var(--vg-brand)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                    >
                      {row.stationName ? (
                        <>
                          <span className="font-sans text-[0.875rem] font-medium text-[color:var(--vg-text-primary)]">
                            {row.stationName}
                          </span>
                          <span className="break-all font-mono text-[0.75rem] text-[color:var(--vg-text-secondary)]">
                            {transaction.stationId}
                          </span>
                        </>
                      ) : (
                        <span className="break-all font-mono text-[0.8125rem] font-medium text-[color:var(--vg-text-primary)]">
                          {transaction.stationId}
                        </span>
                      )}
                    </Link>
                  </td>

                  <td className="px-3 py-3.5 align-middle font-mono text-[0.8125rem] text-[color:var(--vg-text-secondary)] lg:px-4">
                    {row.compositeEquipment}
                  </td>

                  <td className="px-3 py-3.5 align-middle lg:px-4">
                    <SessionLifecycleIndicator
                      status={transaction.status}
                      size="sm"
                    />
                  </td>

                  <td className="px-3 py-3.5 align-middle lg:px-4">
                    <div className="space-y-1">
                      <SessionCompletenessIndicator
                        status={completeness.status}
                        size="sm"
                      />
                      <p className="font-sans text-[0.75rem] leading-[1.125rem] text-[color:var(--vg-text-secondary)]">
                        {completeness.detailLabel}
                      </p>
                    </div>
                  </td>

                  <td className="px-3 py-3.5 align-middle font-mono text-[0.75rem] text-[color:var(--vg-text-secondary)] lg:px-4">
                    {row.startedAtUtc ?? transaction.startedAt}
                  </td>

                  <td className="px-3 py-3.5 align-middle font-sans text-[0.8125rem] text-[color:var(--vg-text-secondary)] lg:px-4">
                    <span>{timingSummary}</span>
                    {row.durationLabel && row.endedAtUtc ? (
                      <span className="block font-mono text-[0.75rem] text-[color:var(--vg-text-secondary)]">
                        {row.endedAtUtc}
                      </span>
                    ) : null}
                  </td>

                  <td className="px-3 py-3.5 text-right align-middle lg:px-4">
                    <Link
                      href={row.sessionHref}
                      aria-label={`Inspect session ${transaction.transactionId} at ${transaction.stationId}`}
                      className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-[var(--vg-radius-md)] px-2.5 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] hover:bg-[color:var(--vg-brand-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                    >
                      <span>Open</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-[color:var(--vg-border)] md:hidden">
        {rows.map(row => {
          const { transaction, completeness } = row;
          const timingSummary = formatTimingSummary(row);

          return (
            <li key={row.compositeKey} className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    href={row.sessionHref}
                    className="inline-flex min-h-11 items-center break-all rounded-[var(--vg-radius-sm)] font-mono text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)] hover:text-[color:var(--vg-brand)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                  >
                    {transaction.transactionId}
                  </Link>
                  <p className="mt-0.5 font-mono text-[0.8125rem] text-[color:var(--vg-text-secondary)]">
                    {row.compositeEquipment}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <SessionLifecycleIndicator
                    status={transaction.status}
                    size="sm"
                  />
                  <SessionCompletenessIndicator
                    status={completeness.status}
                    size="sm"
                  />
                </div>
              </div>

              <div className="space-y-1 font-sans text-[0.8125rem] text-[color:var(--vg-text-secondary)]">
                <p className="break-words">
                  Station:{" "}
                  <Link
                    href={row.stationHref}
                    className="font-medium text-[color:var(--vg-brand)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                  >
                    {row.stationName ? (
                      <>
                        {row.stationName}{" "}
                        <span className="break-all font-mono text-[0.75rem]">
                          ({transaction.stationId})
                        </span>
                      </>
                    ) : (
                      <span className="break-all font-mono">
                        {transaction.stationId}
                      </span>
                    )}
                  </Link>
                </p>
                <p>Completeness detail: {completeness.detailLabel}</p>
                <p className="break-words">
                  Started:{" "}
                  <span className="font-mono text-[color:var(--vg-text-primary)]">
                    {row.startedAtUtc ?? transaction.startedAt}
                  </span>
                </p>
                <p>{timingSummary}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Link
                  href={row.sessionHref}
                  aria-label={`Inspect session ${transaction.transactionId} at ${transaction.stationId}`}
                  className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3.5 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  <span>Open session</span>
                  <span aria-hidden="true">→</span>
                </Link>
                <CopyValueButton
                  value={transaction.transactionId}
                  label="Copy ID"
                  size="md"
                  ariaLabel={`Copy session identifier ${transaction.transactionId}`}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
