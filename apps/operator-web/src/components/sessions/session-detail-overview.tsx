import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import {
  getSessionCompletenessDisplay,
  getSessionLifecycleDisplay,
} from "@/components/ui/status-indicator";
import {
  buildCanonicalSessionDetailHref,
  type SessionDetailPresentationModel,
} from "@/lib/session-detail-model";
import { SessionDetailRetryState } from "./session-detail-states";

export interface SessionDetailOverviewProps {
  model: SessionDetailPresentationModel;
}

/**
 * Operator overview for a charging session, summarizing lifecycle, sequence
 * completeness, timing, and recorded sample counts without fabricated values.
 */
export function SessionDetailOverview({ model }: SessionDetailOverviewProps) {
  const { transaction, sequenceModel } = model;
  const lifecycle = getSessionLifecycleDisplay(model.lifecycleStatus);
  const completeness =
    sequenceModel.availability === "live"
      ? getSessionCompletenessDisplay(sequenceModel.completeness.status)
      : null;

  const measurementsHref = buildCanonicalSessionDetailHref(
    transaction.stationId,
    transaction.transactionId,
    { section: "measurements", returnTo: model.sessionsReturnHref },
  );
  const technicalHref = buildCanonicalSessionDetailHref(
    transaction.stationId,
    transaction.transactionId,
    { section: "technical", returnTo: model.sessionsReturnHref },
  );

  const sampleValue =
    model.measurementsAvailability === "live"
      ? model.totalSampleCount
      : null;

  const sampleDetail =
    model.measurementsAvailability === "unavailable"
      ? "Measurement query unavailable"
      : model.totalSampleCount === 0
        ? "No MeterValues persisted"
        : `${model.streams.length} ${model.streams.length === 1 ? "stream" : "streams"} recorded`;

  const completenessDetail =
    sequenceModel.availability === "unavailable"
      ? "Completeness query unavailable"
      : sequenceModel.missingCount > 0
        ? `${sequenceModel.missingCount} missing sequence ${sequenceModel.missingCount === 1 ? "number" : "numbers"}`
        : sequenceModel.expectedSpanCount !== null
          ? `${sequenceModel.expectedSpanCount} sequence ${sequenceModel.expectedSpanCount === 1 ? "event" : "events"} spanned`
          : completeness?.meaning;

  return (
    <div className="space-y-6">
      {sequenceModel.availability === "live" &&
      sequenceModel.completeness.status === "INCOMPLETE" ? (
        <Alert
          variant="warning"
          announce="none"
          title="Telemetry gaps recorded in this session"
        >
          Station Service detected {sequenceModel.missingCount} missing OCPP sequence{" "}
          {sequenceModel.missingCount === 1 ? "number" : "numbers"}. Review{" "}
          <Link
            href={technicalHref}
            className="font-semibold underline underline-offset-4"
          >
            Technical details
          </Link>{" "}
          for the sequence range breakdown.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Session lifecycle"
          value={lifecycle.label}
          description={lifecycle.meaning}
        />

        <MetricCard
          label="Sequence completeness"
          value={completeness?.label ?? null}
          description={completenessDetail}
          href={technicalHref}
          linkLabel="Review technical details"
        />

        <MetricCard
          label="Duration"
          value={
            model.durationState === "unavailable" ? null : model.durationLabel
          }
          description={
            model.durationState === "ongoing"
              ? "Stop event has not arrived"
              : model.durationState === "ended"
                ? "Start to recorded stop event"
                : "Valid end timestamp unavailable"
          }
        />

        <MetricCard
          label="Recorded samples"
          value={sampleValue}
          description={sampleDetail}
          href={measurementsHref}
          linkLabel="Inspect measurements"
        />
      </div>

      <Card as="section" aria-labelledby="session-overview-timeline-title" padding="md">
        <CardHeader className="mb-4">
          <div className="min-w-0">
            <CardTitle id="session-overview-timeline-title">
              Session timing and charging point
            </CardTitle>
            <CardDescription>
              Persisted Station Service transaction bounds and assigned connector endpoint.
            </CardDescription>
          </div>
          <Link
            href={model.stationHref}
            className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface)] px-3.5 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] hover:bg-[color:var(--vg-brand-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
          >
            Open station details
          </Link>
        </CardHeader>

        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-4">
            <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              Started at (UTC)
            </dt>
            <dd className="mt-1 font-mono text-[0.875rem] text-[color:var(--vg-text-primary)]">
              {model.startedAtUtc ?? "Unavailable"}
            </dd>
          </div>

          <div className="rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-4">
            <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              Ended at (UTC)
            </dt>
            <dd className="mt-1 font-mono text-[0.875rem] text-[color:var(--vg-text-primary)]">
              {transaction.endedAt === null
                ? "Ongoing (no stop event)"
                : (model.endedAtUtc ?? "Unavailable")}
            </dd>
          </div>

          <div className="rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-4">
            <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
              Charging endpoint
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
        </dl>
      </Card>

      {model.measurementsAvailability === "unavailable" &&
      model.measurementsError ? (
        <SessionDetailRetryState
          headingAs="h2"
          title="Unable to load session measurements"
          message={model.measurementsError}
        />
      ) : null}

      {sequenceModel.availability === "unavailable" ? (
        <SessionDetailRetryState
          headingAs="h2"
          title="Unable to load sequence completeness"
          message={sequenceModel.message}
        />
      ) : null}
    </div>
  );
}
