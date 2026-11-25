import Link from "next/link";
import { CopyValueButton } from "@/components/stations/copy-value-button";
import { OperationsStatusIndicator } from "@/components/ui/status-indicator";
import type {
  DiagnosticsPresentationModel,
  DiagnosticsRecordRow,
} from "@/lib/diagnostics-model";

export interface DiagnosticsRecordsProps {
  model: DiagnosticsPresentationModel;
}

function TechnicalDisclosure({ record }: { record: DiagnosticsRecordRow }) {
  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-[var(--vg-radius-sm)] px-1 font-sans text-[0.8125rem] font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)] [&::-webkit-details-marker]:hidden">
        <span>Technical event details</span>
        <span aria-hidden="true" className="text-[0.75rem]">
          ▾
        </span>
      </summary>

      <div className="mt-2 space-y-2 rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-3 text-[0.75rem]">
        <div>
          <p className="font-sans font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
            Last event ID
          </p>
          <p className="mt-0.5 break-all font-mono text-[color:var(--vg-text-primary)]">
            {record.lastEventId ?? "Not returned"}
          </p>
          {record.lastEventId ? (
            <div className="mt-1.5">
              <CopyValueButton
                value={record.lastEventId}
                label="Copy event ID"
                ariaLabel={`Copy last event identifier for ${record.stationId}`}
              />
            </div>
          ) : null}
        </div>

        <div className="grid gap-2 border-t border-[color:var(--vg-border)] pt-2">
          <div>
            <p className="font-sans font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              Raw timestamps (ISO-8601)
            </p>
            <p className="mt-0.5 break-all font-mono text-[color:var(--vg-text-secondary)]">
              Changed: {record.statusChangedAt}
            </p>
            <p className="break-all font-mono text-[color:var(--vg-text-secondary)]">
              Updated: {record.updatedAt}
            </p>
          </div>
        </div>
      </div>
    </details>
  );
}

/**
 * Responsive desktop table and mobile stacked records for Operations Service
 * station status projection entries with explicit cursor pagination controls.
 */
export function DiagnosticsRecords({ model }: DiagnosticsRecordsProps) {
  return (
    <div className="space-y-4">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[44rem] table-fixed border-collapse text-left">
          <caption className="sr-only">
            Projected charging station statuses recorded by Operations Service
          </caption>
          <thead>
            <tr className="border-b border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              <th scope="col" className="w-56 px-4 py-3">
                Station ID
              </th>
              <th scope="col" className="w-36 px-4 py-3">
                Projected status
              </th>
              <th scope="col" className="px-4 py-3">
                Status changed (UTC)
              </th>
              <th scope="col" className="px-4 py-3">
                Projection updated (UTC)
              </th>
              <th scope="col" className="w-56 px-4 py-3">
                Event evidence
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--vg-border)]">
            {model.records.map(record => (
              <tr
                key={record.stationId}
                className="align-top transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-surface-subtle)]/70"
              >
                <td className="px-4 py-3.5">
                  <div className="space-y-1.5">
                    <Link
                      href={record.stationHref}
                      className="inline-block break-all rounded-[var(--vg-radius-sm)] font-mono text-[0.875rem] font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                    >
                      {record.stationId}
                    </Link>
                    <div>
                      <CopyValueButton
                        value={record.stationId}
                        label="Copy station ID"
                        ariaLabel={`Copy station identifier ${record.stationId}`}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <OperationsStatusIndicator
                    status={record.currentStatus}
                    size="sm"
                  />
                </td>
                <td className="px-4 py-3.5 font-mono text-[0.8125rem] text-[color:var(--vg-text-primary)]">
                  {record.statusChangedAtUtc ?? record.statusChangedAt}
                </td>
                <td className="px-4 py-3.5 font-mono text-[0.8125rem] text-[color:var(--vg-text-secondary)]">
                  {record.updatedAtUtc ?? record.updatedAt}
                </td>
                <td className="px-4 py-3.5">
                  <TechnicalDisclosure record={record} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-[color:var(--vg-border)] md:hidden">
        {model.records.map(record => (
          <li key={record.stationId} className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Link
                  href={record.stationHref}
                  className="inline-block break-all font-mono text-[0.875rem] font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  {record.stationId}
                </Link>
              </div>
              <OperationsStatusIndicator
                status={record.currentStatus}
                size="sm"
              />
            </div>

            <dl className="space-y-1.5 text-[0.8125rem]">
              <div>
                <dt className="font-sans text-[0.75rem] font-medium text-[color:var(--vg-text-secondary)]">
                  Status changed (UTC)
                </dt>
                <dd className="font-mono text-[color:var(--vg-text-primary)]">
                  {record.statusChangedAtUtc ?? record.statusChangedAt}
                </dd>
              </div>
              <div>
                <dt className="font-sans text-[0.75rem] font-medium text-[color:var(--vg-text-secondary)]">
                  Projection updated (UTC)
                </dt>
                <dd className="font-mono text-[color:var(--vg-text-secondary)]">
                  {record.updatedAtUtc ?? record.updatedAt}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-3">
              <CopyValueButton
                value={record.stationId}
                label="Copy station ID"
                ariaLabel={`Copy station identifier ${record.stationId}`}
              />
            </div>

            <TechnicalDisclosure record={record} />
          </li>
        ))}
      </ul>

      {model.mode === "cursor-page" ? (
        <nav
          aria-label="Diagnostics cursor pagination"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] px-5 py-3.5 sm:px-6"
        >
          <p className="font-sans text-[0.75rem] text-[color:var(--vg-text-secondary)]">
            Showing {model.records.length} projected{" "}
            {model.records.length === 1 ? "record" : "records"} on this cursor page. Operations Service does not expose a global total count.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {model.firstPageHref ? (
              <Link
                href={model.firstPageHref}
                className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3.5 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
              >
                First page
              </Link>
            ) : null}

            {model.nextHref ? (
              <Link
                href={model.nextHref}
                className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-md)] bg-[color:var(--vg-brand)] px-4 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-inverse)] hover:bg-[color:var(--vg-brand-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
              >
                <span>Next page</span>
                <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-neutral-soft)] px-3.5 py-2 font-sans text-[0.8125rem] font-medium text-[color:var(--vg-neutral)]"
              >
                No next page
              </span>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
