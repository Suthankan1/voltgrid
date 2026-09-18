import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getTransactionInspector,
  type TransactionDataStatus,
  type TransactionMeterSample,
} from "@/lib/station-api";

export const dynamic = "force-dynamic";

export default async function TransactionPage({
  params,
}: {
  params: Promise<{
    stationId: string;
    transactionId: string;
  }>;
}) {
  const { stationId, transactionId } = await params;

  const decodedStationId = decodeURIComponent(stationId);
  const decodedTransactionId = decodeURIComponent(transactionId);

  const snapshot = await getTransactionInspector(
    decodedStationId,
    decodedTransactionId,
  );

  if (snapshot.state === "not-found") {
    notFound();
  }

  if (snapshot.state === "unavailable") {
    return (
      <main className="min-h-screen bg-[#f2f0ea] px-6 py-10 text-[#17191c]">
        <div className="mx-auto max-w-[1500px]">
          <Link
            href={`/stations/${encodeURIComponent(decodedStationId)}`}
            className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#2457ff]"
          >
            ← Station inspector
          </Link>

          <div className="mt-16 border-y border-[#17191c]/20 py-14">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#ef7d32]">
              Transaction data interrupted
            </p>

            <h1 className="mt-5 max-w-3xl text-5xl font-medium tracking-[-0.055em]">
              Operational record unavailable
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-6 text-[#676a67]">
              {snapshot.message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const {
    transaction,
    completeness,
    meterSamples,
  } = snapshot;

  const sequenceRail = buildSequenceRail(
    completeness.firstSequenceNumber,
    completeness.lastSequenceNumber,
  );

  const missingSequences = new Set(
    completeness.missingSequenceNumbers,
  );

  return (
    <div className="min-h-screen bg-[#f2f0ea] text-[#17191c]">
      <header className="border-b border-[#17191c]/15 bg-[#f7f5ef]">
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between px-6 lg:px-10">
          <Link
            href={`/stations/${encodeURIComponent(
              transaction.stationId,
            )}`}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#5f625f] transition-colors hover:text-[#2457ff]"
          >
            ← {transaction.stationId}
          </Link>

          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#898b88]">
              Transaction inspector
            </span>

            <span
              className={`h-2.5 w-2.5 ${
                transaction.status === "ACTIVE"
                  ? "bg-[#2457ff]"
                  : "bg-[#8f918e]"
              }`}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-10 lg:px-10">
        <section className="grid border-y border-[#17191c]/20 lg:grid-cols-[1.45fr_0.55fr]">
          <div className="py-10 lg:border-r lg:border-[#17191c]/20 lg:pr-12">
            <div className="flex flex-wrap items-center gap-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#2457ff]">
                Transaction
              </p>

              <span
                className={`h-2.5 w-2.5 ${
                  transaction.status === "ACTIVE"
                    ? "bg-[#2457ff]"
                    : "bg-[#92948f]"
                }`}
              />

              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#686b68]">
                {transaction.status}
              </p>
            </div>

            <h1 className="mt-7 break-all font-mono text-[clamp(2.4rem,6vw,5.8rem)] font-medium leading-[0.9] tracking-[-0.07em]">
              {transaction.transactionId}
            </h1>

            <div className="mt-10 flex flex-wrap gap-x-10 gap-y-5 border-t border-[#17191c]/15 pt-5">
              <Metric
                label="EVSE"
                value={String(transaction.evseId).padStart(2, "0")}
              />

              <Metric
                label="Connector"
                value={String(transaction.connectorId).padStart(2, "0")}
              />

              <Metric
                label="Last sequence"
                value={`#${transaction.lastSequenceNumber}`}
              />

              <Metric
                label="Integrity"
                value={formatCompletenessLabel(completeness.status)}
                status={completeness.status}
              />
            </div>
          </div>

          <div className="py-8 lg:pl-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#818480]">
              Session coordinates
            </p>

            <dl className="mt-7 divide-y divide-[#17191c]/15 border-y border-[#17191c]/15">
              <DataRow
                label="Station"
                value={transaction.stationId}
              />

              <DataRow
                label="Started"
                value={formatTimestamp(transaction.startedAt)}
              />

              <DataRow
                label="Ended"
                value={
                  transaction.endedAt
                    ? formatTimestamp(transaction.endedAt)
                    : "Session open"
                }
              />

              <DataRow
                label="Endpoint"
                value={`EVSE ${transaction.evseId} / connector ${transaction.connectorId}`}
              />
            </dl>
          </div>
        </section>

        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#17191c] pb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7c7f7b]">
                Delivery integrity
              </p>

              <h2 className="mt-2 text-3xl font-medium tracking-[-0.045em]">
                Transaction event sequence
              </h2>
            </div>

            <CompletenessStatus status={completeness.status} />
          </div>

          <div className="py-8">
            {completeness.firstSequenceNumber === null ? (
              <div className="border-y border-[#17191c]/15 py-10">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8b8e89]">
                  Sequence origin unknown
                </p>

                <p className="mt-3 max-w-xl text-sm leading-6 text-[#686b68]">
                  VoltGrid has not received enough event-receipt information to
                  determine the complete sequence range for this transaction.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto pb-3">
                  <div className="flex min-w-max items-start">
                    {sequenceRail.map((sequence, index) => {
                      if (sequence === "ellipsis") {
                        return (
                          <div
                            key={`ellipsis-${index}`}
                            className="flex w-16 shrink-0 flex-col items-center"
                          >
                            <div className="flex h-9 items-center text-[#8c8e8a]">
                              ···
                            </div>
                          </div>
                        );
                      }

                      const missing = missingSequences.has(sequence);

                      const nextSequence =
                        sequenceRail[index + 1];

                      const nextMissing =
                        typeof nextSequence === "number" &&
                        missingSequences.has(nextSequence);

                      return (
                        <div
                          key={sequence}
                          className="relative flex w-16 shrink-0 flex-col items-center"
                        >
                          {index < sequenceRail.length - 1 &&
                            sequenceRail[index + 1] !== "ellipsis" && (
                              <span
                                className={`absolute left-1/2 top-[17px] h-px w-full ${
                                  missing || nextMissing
                                    ? "bg-[#df4c35]/40"
                                    : "bg-[#17191c]/25"
                                }`}
                              />
                            )}

                          <div
                            className={`relative z-10 grid h-9 w-9 place-items-center border font-mono text-[10px] ${
                              missing
                                ? "border-[#df4c35] bg-[#f2f0ea] text-[#df4c35]"
                                : "border-[#17191c] bg-[#17191c] text-white"
                            }`}
                          >
                            {missing ? "×" : sequence}
                          </div>

                          <div className="mt-2 text-center">
                            <p
                              className={`font-mono text-[9px] ${
                                missing
                                  ? "text-[#df4c35]"
                                  : "text-[#858783]"
                              }`}
                            >
                              #{sequence}
                            </p>

                            {missing && (
                              <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#df4c35]">
                                missing
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-7 grid gap-6 border-y border-[#17191c]/15 py-5 sm:grid-cols-3">
                  <SequenceMetric
                    label="First event"
                    value={`#${completeness.firstSequenceNumber}`}
                  />

                  <SequenceMetric
                    label="Latest event"
                    value={`#${completeness.lastSequenceNumber}`}
                  />

                  <SequenceMetric
                    label="Sequence gaps"
                    value={String(
                      completeness.missingSequenceNumbers.length,
                    )}
                    alert={
                      completeness.missingSequenceNumbers.length > 0
                    }
                  />
                </div>

                {completeness.missingSequenceNumbers.length > 0 && (
                  <div className="mt-5 flex flex-wrap items-baseline gap-3">
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#a14a39]">
                      Missing event receipts
                    </span>

                    <span className="font-mono text-xs text-[#df4c35]">
                      {completeness.missingSequenceNumbers
                        .map((number) => `#${number}`)
                        .join(" · ")}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#17191c] pb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7c7f7b]">
                Meter trace
              </p>

              <h2 className="mt-2 text-3xl font-medium tracking-[-0.045em]">
                Recorded measurements
              </h2>
            </div>

            <p className="font-mono text-xs text-[#747773]">
              {meterSamples.length} samples
            </p>
          </div>

          {meterSamples.length > 0 ? (
            <div>
              <div className="hidden grid-cols-[190px_110px_1fr_180px_180px] border-b border-[#17191c]/20 px-3 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[#858783] lg:grid">
                <span>Sampled</span>
                <span>Sequence</span>
                <span>Measurement</span>
                <span>Reading</span>
                <span>Context</span>
              </div>

              {meterSamples.map((sample, index) => (
                <MeterSampleRow
                  key={`${sample.sequenceNumber}-${sample.sampledAt}-${index}`}
                  sample={sample}
                />
              ))}
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center border-b border-[#17191c]/15">
              <div className="max-w-md px-6 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8d908c]">
                  No meter samples
                </p>

                <p className="mt-3 text-sm leading-6 text-[#686b68]">
                  No measurement samples have been persisted for this
                  transaction.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: TransactionDataStatus;
}) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#92948f]">
        {label}
      </p>

      <div className="mt-1 flex items-center gap-2">
        {status && (
          <span
            className={`h-2 w-2 ${completenessColor(status)}`}
          />
        )}

        <p className="text-lg font-medium tracking-[-0.03em]">
          {value}
        </p>
      </div>
    </div>
  );
}

function SequenceMetric({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#92948f]">
        {label}
      </p>

      <p
        className={`mt-2 font-mono text-xl ${
          alert ? "text-[#df4c35]" : "text-[#17191c]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function CompletenessStatus({
  status,
}: {
  status: TransactionDataStatus;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 ${completenessColor(status)}`}
      />

      <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
        {formatCompletenessLabel(status)}
      </span>
    </div>
  );
}

function MeterSampleRow({
  sample,
}: {
  sample: TransactionMeterSample;
}) {
  return (
    <article className="grid gap-5 border-b border-[#17191c]/15 px-3 py-5 lg:grid-cols-[190px_110px_1fr_180px_180px] lg:items-center">
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#969894] lg:hidden">
          Sampled
        </p>

        <p className="mt-1 font-mono text-[11px] text-[#5f625f] lg:mt-0">
          {formatTimestamp(sample.sampledAt)}
        </p>
      </div>

      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#969894] lg:hidden">
          Sequence
        </p>

        <p className="mt-1 font-mono text-sm lg:mt-0">
          #{sample.sequenceNumber}
        </p>
      </div>

      <div>
        <p className="font-medium tracking-[-0.02em]">
          {formatMeasurand(sample.measurand)}
        </p>

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[#8b8d89]">
          {sample.measurand && (
            <span>{sample.measurand}</span>
          )}

          {sample.phase && (
            <span>{sample.phase}</span>
          )}

          {sample.location && (
            <span>{sample.location}</span>
          )}
        </div>
      </div>

      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#969894] lg:hidden">
          Reading
        </p>

        <p className="mt-1 font-mono text-sm lg:mt-0">
          {formatMeterReading(sample)}
        </p>
      </div>

      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#969894] lg:hidden">
          Context
        </p>

        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#6f726e] lg:mt-0">
          {sample.context ?? "—"}
        </p>
      </div>
    </article>
  );
}

function DataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-4 py-3">
      <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#969894]">
        {label}
      </dt>

      <dd className="break-all font-mono text-xs">
        {value}
      </dd>
    </div>
  );
}

function completenessColor(status: TransactionDataStatus) {
  switch (status) {
    case "COMPLETE":
      return "bg-[#16a36a]";

    case "IN_PROGRESS":
      return "bg-[#2457ff]";

    case "INCOMPLETE":
      return "bg-[#df4c35]";

    case "UNKNOWN":
      return "bg-[#8f918e]";
  }
}

function formatCompletenessLabel(status: TransactionDataStatus) {
  switch (status) {
    case "COMPLETE":
      return "Complete";

    case "IN_PROGRESS":
      return "In progress";

    case "INCOMPLETE":
      return "Incomplete";

    case "UNKNOWN":
      return "Unknown";
  }
}

function buildSequenceRail(
  first: number | null,
  last: number,
): Array<number | "ellipsis"> {
  if (first === null || last < first) {
    return [];
  }

  const count = last - first + 1;

  if (count <= 24) {
    return Array.from(
      { length: count },
      (_, index) => first + index,
    );
  }

  const start = Array.from(
    { length: 11 },
    (_, index) => first + index,
  );

  const endStart = last - 10;

  const end = Array.from(
    { length: 11 },
    (_, index) => endStart + index,
  );

  return [...start, "ellipsis", ...end];
}

function formatMeasurand(measurand: string | null) {
  switch (measurand) {
    case "Energy.Active.Import.Register":
      return "Imported energy";

    case "Power.Active.Import":
      return "Active power";

    default:
      return measurand ?? "Measurement";
  }
}

function formatMeterReading(sample: TransactionMeterSample) {
  const value = trimDecimal(sample.value);

  const multiplier =
    sample.unitMultiplier === 0
      ? ""
      : ` × 10^${sample.unitMultiplier}`;

  const unit = sample.unit
    ? ` ${sample.unit}`
    : "";

  return `${value}${multiplier}${unit}`;
}

function trimDecimal(value: string) {
  if (!value.includes(".")) {
    return value;
  }

  const [integer, fraction] = value.split(".");
  const trimmedFraction = fraction.replace(/0+$/, "");

  return trimmedFraction
    ? `${integer}.${trimmedFraction}`
    : integer;
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}