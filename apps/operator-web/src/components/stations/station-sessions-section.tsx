import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionLifecycleIndicator } from "@/components/ui/status-indicator";
import type {
  SessionPresentationItem,
  StationDetailPresentationModel,
} from "@/lib/station-detail-model";
import { buildSessionsDirectoryHref } from "@/lib/sessions-directory-model";
import { StationDetailRetryState } from "./station-detail-retry-state";

export interface StationSessionsRecordsProps {
  sessions: readonly SessionPresentationItem[];
  caption: string;
}

/**
 * Shared responsive desktop table and mobile cards for station charging sessions.
 */
export function StationSessionsRecords({
  sessions,
  caption,
}: StationSessionsRecordsProps) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              <th scope="col" className="px-3 py-3 lg:px-4">Session</th>
              <th scope="col" className="px-3 py-3 lg:px-4">Lifecycle</th>
              <th scope="col" className="px-3 py-3 lg:px-4">Equipment</th>
              <th scope="col" className="px-3 py-3 lg:px-4">Start time</th>
              <th scope="col" className="px-3 py-3 lg:px-4">Timing</th>
              <th scope="col" className="px-3 py-3 text-right lg:px-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--vg-border)]">
            {sessions.map(item => {
              const { transaction } = item;
              const timingLabel =
                transaction.status === "ACTIVE"
                  ? "Ongoing session"
                  : item.durationLabel
                    ? `Duration ${item.durationLabel}`
                    : item.endedAtUtc ?? "Ended";

              return (
                <tr
                  key={transaction.transactionId}
                  className="transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-surface-subtle)]/60"
                >
                  <td className="max-w-[13rem] px-3 py-3.5 align-middle lg:px-4">
                    <Link
                      href={item.href}
                      className="inline-flex min-h-11 items-center break-all rounded-[var(--vg-radius-sm)] font-mono text-[0.8125rem] font-semibold text-[color:var(--vg-text-primary)] hover:text-[color:var(--vg-brand)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                    >
                      {transaction.transactionId}
                    </Link>
                  </td>
                  <td className="px-3 py-3.5 align-middle lg:px-4">
                    <SessionLifecycleIndicator status={transaction.status} size="sm" />
                  </td>
                  <td className="px-3 py-3.5 align-middle font-mono text-[0.8125rem] text-[color:var(--vg-text-secondary)] lg:px-4">
                    {item.compositeEndpoint}
                  </td>
                  <td className="px-3 py-3.5 align-middle font-mono text-[0.75rem] text-[color:var(--vg-text-secondary)] lg:px-4">
                    {item.startedAtUtc ?? transaction.startedAt}
                  </td>
                  <td className="px-3 py-3.5 align-middle font-sans text-[0.8125rem] text-[color:var(--vg-text-secondary)] lg:px-4">
                    {timingLabel}
                  </td>
                  <td className="px-3 py-3.5 text-right align-middle lg:px-4">
                    <Link
                      href={item.href}
                      aria-label={`Inspect session ${transaction.transactionId}`}
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
        {sessions.map(item => {
          const { transaction } = item;
          const timingLabel =
            transaction.status === "ACTIVE"
              ? "Ongoing session"
              : item.durationLabel
                ? `Ended · ${item.durationLabel}`
                : item.endedAtUtc ?? "Ended";

          return (
            <li key={transaction.transactionId} className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    href={item.href}
                    className="inline-flex min-h-11 items-center break-all rounded-[var(--vg-radius-sm)] font-mono text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)] hover:text-[color:var(--vg-brand)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                  >
                    {transaction.transactionId}
                  </Link>
                  <p className="mt-0.5 font-mono text-[0.8125rem] text-[color:var(--vg-text-secondary)]">
                    {item.compositeEndpoint}
                  </p>
                </div>
                <SessionLifecycleIndicator status={transaction.status} size="sm" />
              </div>

              <div className="space-y-1 font-sans text-[0.8125rem] text-[color:var(--vg-text-secondary)]">
                <p>
                  Started:{" "}
                  <span className="font-mono text-[color:var(--vg-text-primary)]">
                    {item.startedAtUtc ?? transaction.startedAt}
                  </span>
                </p>
                <p>{timingLabel}</p>
              </div>

              <div>
                <Link
                  href={item.href}
                  aria-label={`Inspect session ${transaction.transactionId}`}
                  className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3.5 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  <span>Open session</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export interface StationSessionsSectionProps {
  model: StationDetailPresentationModel;
}

/**
 * Station-scoped charging sessions tab showing all returned sessions,
 * UTC timing, valid durations, and safe composite detail links.
 */
export function StationSessionsSection({ model }: StationSessionsSectionProps) {
  const isLive = model.transactionsAvailability === "live";
  const total = model.totalSessionCount ?? 0;
  const active = model.activeSessionCount ?? 0;

  return (
    <Card
      as="section"
      aria-labelledby="station-sessions-title"
      padding="none"
      className="overflow-hidden"
    >
      <div className="border-b border-[color:var(--vg-border)] p-5 sm:p-6">
        <CardHeader>
          <div>
            <CardTitle id="station-sessions-title">
              Charging sessions
            </CardTitle>
            <CardDescription>
              Sessions recorded for this charging station. Active sessions remain open until an end event arrives; ended status does not confirm data completeness.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-sans text-[0.8125rem] font-medium text-[color:var(--vg-text-secondary)]">
              {isLive
                ? `${total} recorded (${active} active)`
                : "Unavailable"}
            </p>
            <Link
              href={buildSessionsDirectoryHref({ stationId: model.station.id })}
              className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3 py-2 font-sans text-[0.8125rem] font-semibold text-[color:var(--vg-brand)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
            >
              Inspect in Charging sessions →
            </Link>
          </div>
        </CardHeader>
      </div>

      {!isLive ? (
        <div className="p-5 sm:p-6">
          <StationDetailRetryState
            headingAs="h3"
            title="Unable to load charging sessions"
            message={model.transactionsError ?? "Charging session history could not be loaded."}
          />
        </div>
      ) : model.allSessions.length > 0 ? (
        <StationSessionsRecords
          sessions={model.allSessions}
          caption={`Charging sessions recorded for station ${model.station.id}`}
        />
      ) : (
        <div className="p-5 sm:p-6">
          <EmptyState
            kind="empty"
            headingAs="h3"
            title="No charging sessions yet"
            description="This charging station has not recorded any charging sessions yet."
          />
        </div>
      )}
    </Card>
  );
}
