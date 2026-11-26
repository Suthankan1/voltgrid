import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  SessionCompletenessIndicator,
  SessionLifecycleIndicator,
} from "@/components/ui/status-indicator";
import type { AttentionSessionsSectionModel } from "@/lib/attention-model";
import { AttentionRetryState } from "./attention-states";

export interface AttentionSessionsSectionProps {
  section: AttentionSessionsSectionModel;
}

/**
 * Incomplete charging-session preview backed by server-paginated
 * `networkTransactionPage(integrityStatus: INCOMPLETE)` without N+1 detail calls.
 */
export function AttentionSessionsSection({
  section,
}: AttentionSessionsSectionProps) {
  return (
    <Card
      as="section"
      aria-labelledby="attention-sessions-title"
      padding="none"
      className="flex flex-col overflow-hidden"
    >
      <div className="border-b border-[color:var(--vg-border)] p-5 sm:p-6">
        <CardHeader>
          <div className="min-w-0 flex-1">
            <CardTitle id="attention-sessions-title">
              Sessions with missing data
            </CardTitle>
            <CardDescription>
              Charging sessions where Station Service detected gaps in received OCPP sequence numbers. Missing sequences do not imply failed charging or missing meter samples.
            </CardDescription>
          </div>
          <p className="font-sans text-[0.8125rem] font-medium tabular-nums text-[color:var(--vg-text-secondary)]">
            {section.availability === "unavailable"
              ? "Unavailable"
              : `${section.incompleteCount} missing data`}
          </p>
        </CardHeader>
      </div>

      {section.availability === "unavailable" ? (
        <div className="p-5 sm:p-6">
          <AttentionRetryState
            headingAs="h3"
            title="Unable to load incomplete sessions"
            message={section.errorMessage}
          />
        </div>
      ) : section.items.length === 0 ? (
        <div className="p-5 sm:p-6">
          <EmptyState
            headingAs="h3"
            kind="empty"
            title="No incomplete session records found"
            description="Station Service returned zero charging sessions with missing OCPP event sequence numbers."
          />
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--vg-border)]">
          {section.items.map(item => (
            <li
              key={`${item.transaction.stationId}:${item.transaction.transactionId}`}
              className="space-y-3 px-5 py-4 sm:px-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    href={item.sessionHref}
                    className="inline-block break-all font-mono text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)] underline-offset-4 hover:text-[color:var(--vg-brand)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                  >
                    {item.transaction.transactionId}
                  </Link>
                  <p className="font-sans text-[0.8125rem] text-[color:var(--vg-text-secondary)]">
                    Station:{" "}
                    <Link
                      href={item.stationHref}
                      className="break-words font-medium text-[color:var(--vg-text-primary)] underline-offset-4 hover:text-[color:var(--vg-brand)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                    >
                      {item.stationDisplayName}
                    </Link>
                    {item.stationDisplayName !== item.transaction.stationId ? (
                      <span className="ml-1.5 break-all font-mono text-[0.75rem]">
                        ({item.transaction.stationId})
                      </span>
                    ) : null}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <SessionLifecycleIndicator
                    status={item.transaction.status}
                    size="sm"
                  />
                  <SessionCompletenessIndicator
                    status={item.completeness.status}
                    size="sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                  <p className="font-sans text-[0.75rem] text-[color:var(--vg-text-secondary)]">
                    {item.startedAtUtc
                      ? `Started ${item.startedAtUtc} · `
                      : ""}
                    {item.missingCount} missing sequence{" "}
                    {item.missingCount === 1 ? "number" : "numbers"}
                  </p>
                  {item.missingPreview.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {item.missingPreview.map(seq => (
                        <span
                          key={seq}
                          className="rounded-full border border-[color:var(--vg-warning)]/30 bg-[color:var(--vg-warning-soft)] px-2 py-0.5 font-mono text-[0.6875rem] font-semibold tabular-nums text-[color:var(--vg-warning)]"
                        >
                          Seq {seq}
                        </span>
                      ))}
                      {item.missingOverflowCount > 0 ? (
                        <span className="rounded-full border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] px-2 py-0.5 font-sans text-[0.6875rem] text-[color:var(--vg-text-secondary)]">
                          +{item.missingOverflowCount} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <Link
                  href={item.sessionHref}
                  aria-label={`Sequence details for session ${item.transaction.transactionId} at ${item.transaction.stationId}`}
                  className="inline-flex min-h-11 max-w-full flex-wrap items-center gap-1 rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3.5 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)] transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  <span>Sequence details</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] px-5 py-3.5 sm:px-6">
        <p className="font-sans text-[0.75rem] text-[color:var(--vg-text-secondary)]">
          {section.availability === "live" && section.hasMore
            ? `Showing ${section.items.length} of ${section.incompleteCount} sessions with missing data.`
            : "Inspect technical details on each session to view the sequence audit."}
        </p>
        <Link
          href="/sessions?integrityStatus=INCOMPLETE"
          className="inline-flex min-h-11 items-center gap-1 rounded-[var(--vg-radius-md)] px-2.5 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:bg-[color:var(--vg-brand-soft)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
        >
          <span>View all sessions with missing data</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </Card>
  );
}
