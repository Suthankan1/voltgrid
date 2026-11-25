import Link from "next/link";
import { CopyValueButton } from "@/components/stations/copy-value-button";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SessionCompletenessIndicator } from "@/components/ui/status-indicator";
import type { SessionDetailPresentationModel } from "@/lib/session-detail-model";
import { SessionDetailRetryState } from "./session-detail-states";

export interface SessionDetailTechnicalProps {
  model: SessionDetailPresentationModel;
}

/**
 * Technical identifiers, copy controls, persisted transaction sequence numbers,
 * and bounded sequence completeness audit for a charging session.
 */
export function SessionDetailTechnical({ model }: SessionDetailTechnicalProps) {
  const { transaction, sequenceModel } = model;

  return (
    <div className="space-y-6">
      <Card as="section" aria-labelledby="session-technical-ids-title" padding="md">
        <CardHeader className="mb-4">
          <div className="min-w-0">
            <CardTitle id="session-technical-ids-title">
              Identifiers and transaction bounds
            </CardTitle>
            <CardDescription>
              Composite OCPP session identifiers, copy actions, and persisted Station Service fields.
            </CardDescription>
          </div>
        </CardHeader>

        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-4">
            <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              Session (Transaction) ID
            </dt>
            <dd className="space-y-2">
              <p className="break-all font-mono text-[0.875rem] font-medium text-[color:var(--vg-text-primary)]">
                {transaction.transactionId}
              </p>
              <CopyValueButton
                value={transaction.transactionId}
                size="md"
                label="Copy session ID"
              />
            </dd>
          </div>

          <div className="space-y-2 rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-4">
            <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              Station ID
            </dt>
            <dd className="space-y-2">
              <p className="break-all font-mono text-[0.875rem] font-medium text-[color:var(--vg-text-primary)]">
                <Link
                  href={model.stationHref}
                  className="text-[color:var(--vg-brand)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  {transaction.stationId}
                </Link>
              </p>
              <CopyValueButton
                value={transaction.stationId}
                size="md"
                label="Copy station ID"
              />
            </dd>
          </div>

          <div className="rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-4">
            <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              EVSE &amp; Connector
            </dt>
            <dd className="mt-1 font-sans text-[0.9375rem] font-medium text-[color:var(--vg-text-primary)]">
              {model.compositeEndpoint}
            </dd>
          </div>

          <div className="rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-4">
            <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              Session last sequence number
            </dt>
            <dd className="mt-1 font-mono text-[0.9375rem] tabular-nums text-[color:var(--vg-text-primary)]">
              {transaction.lastSequenceNumber}
            </dd>
          </div>

          <div className="rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-4">
            <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              Started timestamp (raw / UTC)
            </dt>
            <dd className="mt-1 space-y-0.5">
              <p className="font-mono text-[0.8125rem] text-[color:var(--vg-text-primary)]">
                {model.startedAtUtc ?? "Unavailable"}
              </p>
              <p className="break-all font-mono text-[0.75rem] text-[color:var(--vg-text-secondary)]">
                {transaction.startedAt}
              </p>
            </dd>
          </div>

          <div className="rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-4">
            <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              Ended timestamp (raw / UTC)
            </dt>
            <dd className="mt-1 space-y-0.5">
              <p className="font-mono text-[0.8125rem] text-[color:var(--vg-text-primary)]">
                {transaction.endedAt === null
                  ? "Ongoing (null)"
                  : (model.endedAtUtc ?? "Unavailable")}
              </p>
              {transaction.endedAt ? (
                <p className="break-all font-mono text-[0.75rem] text-[color:var(--vg-text-secondary)]">
                  {transaction.endedAt}
                </p>
              ) : null}
            </dd>
          </div>
        </dl>
      </Card>

      {sequenceModel.availability === "unavailable" ? (
        <SessionDetailRetryState
          headingAs="h2"
          title="Unable to verify sequence completeness"
          message={sequenceModel.message}
        />
      ) : (
        <Card
          as="section"
          aria-labelledby="session-technical-completeness-title"
          padding="md"
        >
          <div className="space-y-4">
            <CardHeader>
              <div className="min-w-0 flex-1">
                <CardTitle id="session-technical-completeness-title">
                  OCPP sequence completeness audit
                </CardTitle>
                <CardDescription>
                  Continuity verification across persisted OCPP TransactionEvent sequence receipts.
                </CardDescription>
              </div>
              <SessionCompletenessIndicator
                status={sequenceModel.completeness.status}
                size="md"
              />
            </CardHeader>

            {sequenceModel.hasRangeInconsistency ? (
              <Alert
                variant="warning"
                announce="none"
                title="Reported sequence bounds differ"
              >
                <ul className="list-disc space-y-1 pl-4">
                  {sequenceModel.inconsistencyReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}

            {sequenceModel.hasUnboundedStart ? (
              <Alert
                variant="info"
                announce="none"
                title="Start sequence number not recorded"
              >
                Station Service did not record an initial STARTED sequence receipt for this session, so contiguous range coverage cannot be bounded.
              </Alert>
            ) : null}

            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-4">
                <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
                  First sequence
                </dt>
                <dd className="mt-1 font-mono text-[0.9375rem] tabular-nums text-[color:var(--vg-text-primary)]">
                  {sequenceModel.completeness.firstSequenceNumber ??
                    "Not recorded"}
                </dd>
              </div>

              <div className="rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-4">
                <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
                  Completeness last sequence
                </dt>
                <dd className="mt-1 font-mono text-[0.9375rem] tabular-nums text-[color:var(--vg-text-primary)]">
                  {sequenceModel.completeness.lastSequenceNumber}
                </dd>
              </div>

              <div className="rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-4">
                <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
                  Session last sequence
                </dt>
                <dd className="mt-1 font-mono text-[0.9375rem] tabular-nums text-[color:var(--vg-text-primary)]">
                  {transaction.lastSequenceNumber}
                </dd>
              </div>

              <div className="rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-4">
                <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
                  Missing sequence numbers
                </dt>
                <dd className="mt-1 font-mono text-[0.9375rem] tabular-nums text-[color:var(--vg-text-primary)]">
                  {sequenceModel.missingCount}
                </dd>
              </div>
            </dl>

            {sequenceModel.railItems.length > 0 ? (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-sans text-[0.8125rem] font-semibold text-[color:var(--vg-text-primary)]">
                    Sequence coverage window
                  </p>
                  {sequenceModel.expectedSpanCount !== null ? (
                    <p className="font-sans text-[0.75rem] text-[color:var(--vg-text-secondary)]">
                      {sequenceModel.recordedInRangeCount} recorded /{" "}
                      {sequenceModel.expectedSpanCount} expected
                      {sequenceModel.railTruncated
                        ? " (bounded window shown)"
                        : ""}
                    </p>
                  ) : null}
                </div>

                <ul
                  aria-label="OCPP sequence coverage"
                  className="flex flex-wrap gap-1.5"
                >
                  {sequenceModel.railItems.map(item =>
                    item.kind === "ellipsis" ? (
                      <li
                        key={item.key}
                        aria-hidden="true"
                        className="inline-flex h-8 min-w-8 items-center justify-center rounded-[var(--vg-radius-sm)] border border-dashed border-[color:var(--vg-border)] px-2 font-mono text-[0.75rem] text-[color:var(--vg-text-secondary)]"
                      >
                        …
                      </li>
                    ) : (
                      <li
                        key={item.key}
                        aria-label={`Sequence ${item.sequenceNumber}: ${item.status}`}
                        className={`inline-flex h-8 min-w-8 items-center justify-center rounded-[var(--vg-radius-sm)] border px-2 font-mono text-[0.75rem] tabular-nums ${
                          item.status === "missing"
                            ? "border-[color:var(--vg-warning)]/40 bg-[color:var(--vg-warning-soft)] font-semibold text-[color:var(--vg-warning)]"
                            : "border-[color:var(--vg-success)]/25 bg-[color:var(--vg-success-soft)] text-[color:var(--vg-success)]"
                        }`}
                      >
                        {item.sequenceNumber}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}

            {sequenceModel.missingCount > 0 ? (
              <div className="space-y-2 border-t border-[color:var(--vg-border)] pt-4">
                <p className="font-sans text-[0.8125rem] font-semibold text-[color:var(--vg-text-primary)]">
                  Missing sequence numbers reported
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sequenceModel.missingPreview.map(seq => (
                    <span
                      key={seq}
                      className="rounded-full border border-[color:var(--vg-warning)]/30 bg-[color:var(--vg-warning-soft)] px-2.5 py-0.5 font-mono text-[0.75rem] font-semibold tabular-nums text-[color:var(--vg-warning)]"
                    >
                      Seq {seq}
                    </span>
                  ))}
                  {sequenceModel.missingOverflowCount > 0 ? (
                    <span className="rounded-full border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] px-2.5 py-0.5 font-sans text-[0.75rem] text-[color:var(--vg-text-secondary)]">
                      +{sequenceModel.missingOverflowCount} more
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      )}
    </div>
  );
}
