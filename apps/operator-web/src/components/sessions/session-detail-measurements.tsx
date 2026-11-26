"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import type {
  SessionDetailPresentationModel,
  SessionMeasurementStream,
} from "@/lib/session-detail-model";
import { SessionDetailRetryState } from "./session-detail-states";

export interface SessionDetailMeasurementsProps {
  model: SessionDetailPresentationModel;
}

function StreamDetailsMetadata({ stream }: { stream: SessionMeasurementStream }) {
  return (
    <dl className="grid min-w-0 gap-3 rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="min-w-0">
        <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
          Measurand &amp; unit
        </dt>
        <dd className="mt-1 break-all font-mono text-[0.8125rem] text-[color:var(--vg-text-primary)]">
          {stream.measurandLabel}
          {stream.unit ? ` (${stream.displayUnit ?? stream.unit})` : " (no unit)"}
        </dd>
      </div>

      <div className="min-w-0">
        <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
          Phase &amp; location
        </dt>
        <dd className="mt-1 break-words font-sans text-[0.875rem] text-[color:var(--vg-text-primary)]">
          {[stream.phaseLabel ?? "All/unspecified phase", stream.locationLabel ?? "Unspecified location"].join(" · ")}
        </dd>
      </div>

      <div className="min-w-0">
        <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
          Sampling context
        </dt>
        <dd className="mt-1 break-all font-mono text-[0.8125rem] text-[color:var(--vg-text-primary)]">
          {stream.contextLabel ?? "Unspecified"}
        </dd>
      </div>

      <div className="min-w-0">
        <dt className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
          Latest normalized reading
        </dt>
        <dd className="mt-1 break-words font-mono text-[0.875rem] font-semibold tabular-nums text-[color:var(--vg-text-primary)]">
          {stream.latestSample?.normalizedReadingLabel ?? "Unavailable"}
        </dd>
      </div>
    </dl>
  );
}

function SessionMeasurementChart({ stream }: { stream: SessionMeasurementStream }) {
  const allPoints = stream.plotSegments.flat();
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const activeIndexRaw = allPoints.findIndex(point => point.id === selectedPointId);
  const activeIndex =
    activeIndexRaw >= 0 ? activeIndexRaw : Math.max(0, allPoints.length - 1);
  const activePoint = allPoints[activeIndex] ?? null;

  if (allPoints.length === 0) {
    return (
      <EmptyState
        headingAs="h3"
        kind="empty"
        title="No numeric chart points available"
        description="Recorded samples in this stream have non-numeric values or invalid timestamps and cannot be plotted on the time-series axis. Inspect the full recorded sample rows in the raw measurement table below."
      />
    );
  }

  const padLeft = 64;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 38;
  const plotRight = stream.chartWidth - padRight;
  const plotBottom = stream.chartHeight - padBottom;

  return (
    <div className="space-y-4">
      {stream.isCumulativeRegister ? (
        <Alert
          variant="info"
          announce="none"
          title="Cumulative meter register stream"
        >
          This stream records the meter&apos;s cumulative running register value at each timestamp, not instantaneous charging power or a derived session total.
        </Alert>
      ) : null}

      {stream.gapBreakCount > 0 ? (
        <Alert
          variant="warning"
          announce="none"
          title="Telemetry gaps break the plotted line"
        >
          Connecting segments break across {stream.gapBreakCount} missing sequence{" "}
          {stream.gapBreakCount === 1 ? "interval" : "intervals"}. Missing periods are never interpolated.
        </Alert>
      ) : null}

      <div className="overflow-hidden rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-3 sm:p-4">
        <svg
          role="img"
          aria-label={`Time-series measurement chart for ${stream.label} with ${stream.plottableSamples} recorded samples`}
          viewBox={`0 0 ${stream.chartWidth} ${stream.chartHeight}`}
          className="h-auto w-full select-none"
        >
          {/* Horizontal grid lines */}
          {stream.yTicks.map((tick, index) => (
            <g key={`y-${index}-${tick.label}`}>
              <line
                x1={padLeft}
                y1={tick.position}
                x2={plotRight}
                y2={tick.position}
                stroke="var(--vg-border)"
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={tick.position + 4}
                textAnchor="end"
                fill="var(--vg-text-secondary)"
                fontSize="11"
                fontFamily="var(--vg-font-mono)"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Explicit signed zero baseline */}
          {stream.zeroLineY !== null ? (
            <line
              x1={padLeft}
              y1={stream.zeroLineY}
              x2={plotRight}
              y2={stream.zeroLineY}
              stroke="var(--vg-text-secondary)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ) : null}

          {/* Axes frame */}
          <line
            x1={padLeft}
            y1={padTop}
            x2={padLeft}
            y2={plotBottom}
            stroke="var(--vg-border-control)"
            strokeWidth="1"
          />
          <line
            x1={padLeft}
            y1={plotBottom}
            x2={plotRight}
            y2={plotBottom}
            stroke="var(--vg-border-control)"
            strokeWidth="1"
          />

          {/* Plot unit caption */}
          {stream.displayUnit ? (
            <text
              x={padLeft}
              y={12}
              textAnchor="start"
              fill="var(--vg-text-secondary)"
              fontSize="11"
              fontFamily="var(--vg-font-mono)"
            >
              {stream.displayUnit}
            </text>
          ) : null}

          {/* X-axis UTC ticks */}
          {stream.xTicks.map((tick, index) => (
            <text
              key={`x-${index}-${tick.label}`}
              x={tick.position}
              y={plotBottom + 20}
              textAnchor={
                stream.xTicks.length === 1
                  ? "middle"
                  : index === 0
                    ? "start"
                    : index === stream.xTicks.length - 1
                      ? "end"
                      : "middle"
              }
              fill="var(--vg-text-secondary)"
              fontSize="11"
              fontFamily="var(--vg-font-mono)"
            >
              {tick.label}
            </text>
          ))}

          {/* Connected line segments broken cleanly across documented sequence gaps */}
          {stream.plotSegments.map((segment, segIdx) => {
            if (segment.length < 2) {
              return null;
            }
            const pointsAttr = segment.map(pt => `${pt.x},${pt.y}`).join(" ");
            return (
              <polyline
                key={`seg-${segIdx}`}
                fill="none"
                stroke="var(--vg-brand)"
                strokeWidth="2.25"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={pointsAttr}
              />
            );
          })}

          {/* Recorded sample point markers */}
          {allPoints.map(pt => {
            const isSelected = activePoint?.id === pt.id;
            return (
              <g key={pt.id}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={stream.isDownsampled ? (isSelected ? 4.5 : 2.5) : isSelected ? 5.5 : 4}
                  fill={isSelected ? "var(--vg-brand)" : "var(--vg-surface)"}
                  stroke="var(--vg-brand)"
                  strokeWidth="2"
                />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={12}
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => setSelectedPointId(pt.id)}
                >
                  <title>
                    {`Seq ${pt.sequenceNumber} · ${pt.sampledAtUtc} · ${pt.formattedDisplayValue} (raw: ${pt.rawReadingLabel})`}
                  </title>
                </circle>
              </g>
            );
          })}
        </svg>

        {activePoint ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--vg-border)] pt-3 font-sans text-[0.8125rem] text-[color:var(--vg-text-secondary)]">
            <div aria-live="polite" className="min-w-0 space-y-0.5">
              <p>
                Selected reading:{" "}
                <strong className="font-mono font-semibold text-[color:var(--vg-text-primary)]">
                  {activePoint.formattedDisplayValue}
                </strong>{" "}
                <span className="font-mono text-[0.75rem]">
                  (raw {activePoint.rawReadingLabel})
                </span>
              </p>
              <p className="font-mono text-[0.75rem]">
                Seq {activePoint.sequenceNumber} · {activePoint.sampledAtUtc}
              </p>
            </div>

            {allPoints.length > 1 ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={activeIndex <= 0}
                  onClick={() => {
                    const prev = allPoints[activeIndex - 1];
                    if (prev) setSelectedPointId(prev.id);
                  }}
                  className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3 py-1.5 font-sans text-[0.75rem] font-semibold text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  Previous point
                </button>
                <button
                  type="button"
                  disabled={activeIndex >= allPoints.length - 1}
                  onClick={() => {
                    const next = allPoints[activeIndex + 1];
                    if (next) setSelectedPointId(next.id);
                  }}
                  className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3 py-1.5 font-sans text-[0.75rem] font-semibold text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  Next point
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 font-sans text-[0.75rem] leading-[1.125rem] text-[color:var(--vg-text-secondary)]">
        <p>Only recorded measurements are displayed.</p>
        <div className="flex flex-wrap gap-3">
          {stream.hasDuplicateTimestamps ? (
            <span>Multiple samples share a timestamp.</span>
          ) : null}
          {stream.isDownsampled ? (
            <span>
              Chart displays {stream.renderedPointCount} representative points of{" "}
              {stream.plottableSamples} plottable samples; all{" "}
              {stream.totalSamples} recorded samples remain in the table below.
            </span>
          ) : null}
          {stream.unplottableSamples > 0 ? (
            <span>
              {stream.unplottableSamples} non-numeric or unplottable{" "}
              {stream.unplottableSamples === 1 ? "sample remains" : "samples remain"} in the raw table below.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Measurement inspection section enforcing conservative stream grouping,
 * OCPP unitMultiplier fidelity without double conversion, gap-aware SVG charting,
 * and complete raw measurement preservation.
 */
export function SessionDetailMeasurements({
  model,
}: SessionDetailMeasurementsProps) {
  const [selectedStreamKey, setSelectedStreamKey] = useState<string>(
    model.streams[0]?.key ?? "",
  );

  if (
    model.measurementsAvailability === "unavailable" &&
    model.measurementsError
  ) {
    return (
      <SessionDetailRetryState
        headingAs="h2"
        title="Unable to load session measurements"
        message={model.measurementsError}
      />
    );
  }

  if (model.totalSampleCount === 0) {
    return (
      <Card as="section" aria-labelledby="session-measurements-empty-title" padding="md">
        <h2 id="session-measurements-empty-title" className="sr-only">
          Session measurements
        </h2>
        <EmptyState
          headingAs="h3"
          kind="empty"
          title="No meter measurements were recorded"
          description="Station Service has no persisted MeterValues telemetry for this charging session. Only recorded measurements are displayed; missing periods or unrecorded totals are never invented."
        />
      </Card>
    );
  }

  const activeStream =
    model.streams.find(stream => stream.key === selectedStreamKey) ??
    model.streams[0]!;

  return (
    <div className="space-y-6">
      <Card as="section" aria-labelledby="session-measurements-chart-title" padding="md">
        <div className="space-y-4">
          <CardHeader>
            <div className="min-w-0 flex-1">
              <CardTitle id="session-measurements-chart-title">
                Telemetry stream chart
              </CardTitle>
              <CardDescription>
                Streams remain separated by measurand, unit, phase, location, and sampling context.
              </CardDescription>
            </div>
            <p className="font-sans text-[0.8125rem] font-medium text-[color:var(--vg-text-secondary)]">
              {model.streams.length}{" "}
              {model.streams.length === 1 ? "compatible stream" : "compatible streams"}
            </p>
          </CardHeader>

          {model.streams.length > 1 ? (
            <div className="min-w-0 max-w-xl">
              <FormField
                label="Compatible measurement stream"
                htmlFor="session-measurement-stream-select"
                description="Switch between distinct measurand, unit, phase, location, or sampling context series."
              >
                {fieldProps => (
                  <Select
                    {...fieldProps}
                    value={activeStream.key}
                    onChange={event => setSelectedStreamKey(event.target.value)}
                    options={model.streams.map(stream => ({
                      value: stream.key,
                      label: `${stream.label} (${stream.totalSamples})`,
                    }))}
                  />
                )}
              </FormField>
            </div>
          ) : null}

          <StreamDetailsMetadata stream={activeStream} />
          <SessionMeasurementChart stream={activeStream} />
        </div>
      </Card>

      <Card
        as="section"
        aria-labelledby="session-measurements-table-title"
        padding="none"
        className="overflow-hidden"
      >
        <div className="border-b border-[color:var(--vg-border)] p-5 sm:p-6">
          <CardHeader>
            <div className="min-w-0 flex-1">
              <CardTitle id="session-measurements-table-title">
                Recorded raw meter samples
              </CardTitle>
              <CardDescription>
                Complete chronological sample log with raw persisted OCPP values and unit multipliers preserved.
              </CardDescription>
            </div>
            <p className="font-sans text-[0.8125rem] font-medium tabular-nums text-[color:var(--vg-text-secondary)]">
              {model.totalSampleCount}{" "}
              {model.totalSampleCount === 1 ? "sample" : "samples"}
            </p>
          </CardHeader>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[44rem] table-fixed border-collapse text-left">
            <caption className="sr-only">
              Chronological raw OCPP MeterValues recorded for this session
            </caption>
            <thead>
              <tr className="border-b border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
                <th scope="col" className="w-20 px-4 py-3">Seq</th>
                <th scope="col" className="w-52 px-4 py-3">Sampled at (UTC)</th>
                <th scope="col" className="px-4 py-3">Normalized</th>
                <th scope="col" className="px-4 py-3">Raw reading</th>
                <th scope="col" className="px-4 py-3">Measurand &amp; qualifiers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--vg-border)]">
              {model.allSamplesChronological.map(sample => (
                <tr key={sample.id} className="align-top hover:bg-[color:var(--vg-surface-subtle)]/70">
                  <td className="px-4 py-3 font-mono text-[0.8125rem] tabular-nums text-[color:var(--vg-text-primary)]">
                    {sample.sequenceNumber}
                  </td>
                  <td className="px-4 py-3 font-mono text-[0.8125rem] text-[color:var(--vg-text-secondary)]">
                    {sample.sampledAtUtc ?? sample.sampledAt}
                  </td>
                  <td className="px-4 py-3 font-mono text-[0.8125rem] font-medium tabular-nums text-[color:var(--vg-text-primary)]">
                    {sample.normalizedReadingLabel}
                  </td>
                  <td className="break-all px-4 py-3 font-mono text-[0.8125rem] text-[color:var(--vg-text-secondary)]">
                    {sample.rawReadingLabel}
                  </td>
                  <td className="break-words px-4 py-3 font-sans text-[0.8125rem] text-[color:var(--vg-text-secondary)]">
                    <span className="font-mono font-medium text-[color:var(--vg-text-primary)]">
                      {sample.measurand ?? "Unspecified measurand"}
                    </span>
                    <div className="mt-0.5 text-[0.75rem]">
                      {[
                        sample.phase ?? "All phase",
                        sample.location ?? "Unspecified location",
                        sample.context ?? "Unspecified context",
                      ].join(" · ")}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="divide-y divide-[color:var(--vg-border)] md:hidden">
          {model.allSamplesChronological.map(sample => (
            <li key={sample.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[0.75rem] font-semibold text-[color:var(--vg-text-primary)]">
                  Seq {sample.sequenceNumber}
                </span>
                <span className="font-mono text-[0.75rem] text-[color:var(--vg-text-secondary)]">
                  {sample.sampledAtUtc ?? sample.sampledAt}
                </span>
              </div>
              <p className="font-mono text-[0.9375rem] font-semibold text-[color:var(--vg-text-primary)]">
                {sample.normalizedReadingLabel}
              </p>
              <p className="break-all font-mono text-[0.75rem] text-[color:var(--vg-text-secondary)]">
                Raw: {sample.rawReadingLabel}
              </p>
              <p className="break-all font-sans text-[0.75rem] text-[color:var(--vg-text-secondary)]">
                {sample.measurand ?? "Unspecified measurand"} ·{" "}
                {[
                  sample.phase ?? "All phase",
                  sample.location ?? "Unspecified location",
                  sample.context ?? "Unspecified context",
                ].join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
