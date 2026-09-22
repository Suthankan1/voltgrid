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
  const { stationId, transactionId } =
    await params;

  const decodedStationId =
    decodeURIComponent(stationId);

  const decodedTransactionId =
    decodeURIComponent(transactionId);

  const snapshot =
    await getTransactionInspector(
      decodedStationId,
      decodedTransactionId,
    );

  if (
    snapshot.state ===
    "not-found"
  ) {
    notFound();
  }

  if (
    snapshot.state ===
    "unavailable"
  ) {
    return (
      <main className="min-h-screen bg-[#f2f0ea] px-5 py-10 text-[#17191c] sm:px-7 lg:px-10">
        <div className="mx-auto max-w-[1600px]">
          <Link
            href="/transactions"
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#2457ff]"
          >
            ← Transactions
          </Link>

          <div className="mt-14 border-y border-[#17191c]/20 py-14">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#ef7d32]">
              Transaction data
              interrupted
            </p>

            <h1 className="mt-5 max-w-3xl text-4xl font-medium tracking-[-0.055em] sm:text-5xl">
              Operational record
              unavailable
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

  const sequenceRail =
    buildSequenceRail(
      completeness.firstSequenceNumber,
      completeness.lastSequenceNumber,
    );

  const missingSequences =
    new Set(
      completeness.missingSequenceNumbers,
    );

  const latestEnergySample =
    findLatestMeterSample(
      meterSamples,
      "Energy.Active.Import.Register",
    );

  const latestPowerSample =
    findLatestMeterSample(
      meterSamples,
      "Power.Active.Import",
    );

  return (
    <div className="min-h-screen bg-[#f2f0ea] text-[#17191c]">
      <header className="border-b border-[#17191c]/15 bg-[#f7f5ef]">
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-5 px-5 sm:px-7 lg:px-10">
          <Link
            href="/transactions"
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f625f] transition-colors hover:text-[#2457ff]"
          >
            ← Transactions
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-[#898b88] sm:inline">
              Transaction inspector
            </span>

            <span
              className={`h-2.5 w-2.5 ${
                transaction.status ===
                "ACTIVE"
                  ? "bg-[#2457ff]"
                  : "bg-[#8f918e]"
              }`}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-8 sm:px-7 lg:px-10">
        <section className="border-y border-[#17191c]/20">
          <div className="grid gap-10 py-9 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#2457ff]">
                  Charging transaction
                </p>

                <LifecycleBadge
                  status={
                    transaction.status
                  }
                />

                <IntegrityBadge
                  status={
                    completeness.status
                  }
                />
              </div>

              <h1 className="mt-5 break-all font-mono text-[clamp(2rem,5vw,4.8rem)] font-medium leading-[0.95] tracking-[-0.06em]">
                {
                  transaction.transactionId
                }
              </h1>

              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#777a76]">
                <Link
                  href={`/stations/${encodeURIComponent(
                    transaction.stationId,
                  )}`}
                  className="transition-colors hover:text-[#2457ff]"
                >
                  {
                    transaction.stationId
                  }
                </Link>

                <span className="text-[#b2b2ad]">
                  /
                </span>

                <span>
                  EVSE{" "}
                  {
                    transaction.evseId
                  }
                </span>

                <span className="text-[#b2b2ad]">
                  /
                </span>

                <span>
                  Connector{" "}
                  {
                    transaction.connectorId
                  }
                </span>
              </div>
            </div>

            <div className="lg:text-right">
              <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#92948f]">
                Session duration
              </p>

              <p className="mt-2 text-2xl font-medium tracking-[-0.04em]">
                {formatDuration(
                  transaction.startedAt,
                  transaction.endedAt,
                )}
              </p>
            </div>
          </div>

          <div className="grid border-t border-[#17191c]/15 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewMetric
              label="Started"
              value={formatTimestamp(
                transaction.startedAt,
              )}
            />

            <OverviewMetric
              label="Ended"
              value={
                transaction.endedAt
                  ? formatTimestamp(
                      transaction.endedAt,
                    )
                  : "Session open"
              }
            />

            <OverviewMetric
              label="Sequence"
              value={formatSequenceRange(
                completeness.firstSequenceNumber,
                completeness.lastSequenceNumber,
              )}
            />

            <OverviewMetric
              label="Missing events"
              value={String(
                completeness
                  .missingSequenceNumbers
                  .length,
              )}
              attention={
                completeness
                  .missingSequenceNumbers
                  .length > 0
              }
            />
          </div>
        </section>

        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-5 border-b-2 border-[#17191c] pb-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7c7f7b]">
                Delivery integrity
              </p>

              <h2 className="mt-2 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">
                Event sequence
              </h2>
            </div>

            <IntegrityBadge
              status={
                completeness.status
              }
              large
            />
          </div>

          <div className="grid border-b border-[#17191c]/15 lg:grid-cols-[280px_1fr]">
            <div className="py-7 lg:border-r lg:border-[#17191c]/15 lg:pr-8">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#858783]">
                Integrity assessment
              </p>

              <p className="mt-4 text-lg font-medium tracking-[-0.03em]">
                {integrityHeadline(
                  completeness.status,
                )}
              </p>

              <p className="mt-3 text-sm leading-6 text-[#686b68]">
                {integrityDescription(
                  completeness.status,
                  completeness
                    .missingSequenceNumbers,
                )}
              </p>
            </div>

            <div className="min-w-0 py-7 lg:pl-8">
              {completeness.firstSequenceNumber ===
              null ? (
                <div className="py-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8b8e89]">
                    Sequence origin
                    unknown
                  </p>

                  <p className="mt-3 max-w-xl text-sm leading-6 text-[#686b68]">
                    VoltGrid has not
                    received enough
                    event-receipt history
                    to determine the
                    complete expected
                    sequence.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto pb-3">
                    <div className="flex min-w-max items-start">
                      {sequenceRail.map(
                        (
                          sequence,
                          index,
                        ) => {
                          if (
                            sequence ===
                            "ellipsis"
                          ) {
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

                          const missing =
                            missingSequences.has(
                              sequence,
                            );

                          const next =
                            sequenceRail[
                              index + 1
                            ];

                          return (
                            <div
                              key={
                                sequence
                              }
                              className="relative flex w-16 shrink-0 flex-col items-center"
                            >
                              {index <
                                sequenceRail.length -
                                  1 &&
                                next !==
                                  "ellipsis" && (
                                  <span
                                    className={`absolute left-1/2 top-[17px] h-px w-full ${
                                      missing
                                        ? "bg-[#df4c35]/35"
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
                                {missing
                                  ? "×"
                                  : sequence}
                              </div>

                              <p
                                className={`mt-2 font-mono text-[9px] ${
                                  missing
                                    ? "text-[#df4c35]"
                                    : "text-[#858783]"
                                }`}
                              >
                                #
                                {
                                  sequence
                                }
                              </p>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>

                  <div className="mt-7 grid gap-px border border-[#17191c]/15 bg-[#17191c]/15 sm:grid-cols-3">
                    <SequenceMetric
                      label="First received"
                      value={`#${completeness.firstSequenceNumber}`}
                    />

                    <SequenceMetric
                      label="Latest received"
                      value={`#${completeness.lastSequenceNumber}`}
                    />

                    <SequenceMetric
                      label="Missing"
                      value={String(
                        completeness
                          .missingSequenceNumbers
                          .length,
                      )}
                      alert={
                        completeness
                          .missingSequenceNumbers
                          .length >
                        0
                      }
                    />
                  </div>

                  {completeness
                    .missingSequenceNumbers
                    .length > 0 && (
                    <div className="mt-5 border-l-2 border-[#df4c35] pl-4">
                      <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#a14a39]">
                        Missing event
                        receipts
                      </p>

                      <p className="mt-2 font-mono text-sm text-[#df4c35]">
                        {completeness.missingSequenceNumbers
                          .map(
                            (
                              number,
                            ) =>
                              `#${number}`,
                          )
                          .join(
                            " · ",
                          )}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-5 border-b-2 border-[#17191c] pb-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7c7f7b]">
                Meter trace
              </p>

              <h2 className="mt-2 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">
                Energy and power
              </h2>
            </div>

            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#747773]">
              {
                meterSamples.length
              }{" "}
              {meterSamples.length === 1
                ? "sample"
                : "samples"}
            </p>
          </div>

          <div className="grid border-b border-[#17191c]/15 md:grid-cols-2">
            <FeaturedReading
              label="Energy imported"
              sample={
                latestEnergySample
              }
              emptyLabel="No energy reading"
            />

            <FeaturedReading
              label="Active power"
              sample={
                latestPowerSample
              }
              emptyLabel="No power reading"
              right
            />
          </div>

          <div className="mt-9">
            <div className="flex items-end justify-between border-b border-[#17191c]/20 pb-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#858783]">
                  Measurement log
                </p>

                <p className="mt-2 text-sm text-[#686b68]">
                  Persisted OCPP
                  meter samples for
                  this transaction.
                </p>
              </div>
            </div>

            {meterSamples.length >
            0 ? (
              <div>
                <div className="hidden grid-cols-[180px_90px_minmax(240px,1fr)_180px_180px] border-b border-[#17191c]/20 px-3 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[#858783] lg:grid">
                  <span>
                    Sampled
                  </span>

                  <span>
                    Seq
                  </span>

                  <span>
                    Measurement
                  </span>

                  <span>
                    Reading
                  </span>

                  <span>
                    Context
                  </span>
                </div>

                {meterSamples.map(
                  (
                    sample,
                    index,
                  ) => (
                    <MeterSampleRow
                      key={`${sample.sequenceNumber}-${sample.sampledAt}-${index}`}
                      sample={
                        sample
                      }
                    />
                  ),
                )}
              </div>
            ) : (
              <div className="grid min-h-44 place-items-center border-b border-[#17191c]/15">
                <div className="max-w-md px-6 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8d908c]">
                    No meter samples
                  </p>

                  <p className="mt-3 text-sm leading-6 text-[#686b68]">
                    No measurement
                    samples have been
                    persisted for this
                    transaction.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="mt-14 flex flex-wrap items-center justify-between gap-5 border-t border-[#17191c]/20 py-6">
          <Link
            href="/transactions"
            className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#5f625f] transition-colors hover:text-[#2457ff]"
          >
            ← Network transactions
          </Link>

          <Link
            href={`/stations/${encodeURIComponent(
              transaction.stationId,
            )}`}
            className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#5f625f] transition-colors hover:text-[#2457ff]"
          >
            Station inspector →
          </Link>
        </footer>
      </main>
    </div>
  );
}

function OverviewMetric({
  label,
  value,
  attention = false,
}: {
  label: string;
  value: string;
  attention?: boolean;
}) {
  return (
    <div className="border-b border-[#17191c]/15 py-5 sm:border-r sm:px-6 sm:first:pl-0 xl:border-b-0 xl:last:border-r-0">
      <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-[#92948f]">
        {label}
      </p>

      <p
        className={`mt-2 font-mono text-sm ${
          attention
            ? "text-[#df4c35]"
            : "text-[#17191c]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function LifecycleBadge({
  status,
}: {
  status:
    | "ACTIVE"
    | "ENDED";
}) {
  const active =
    status === "ACTIVE";

  return (
    <div className="inline-flex items-center gap-2 border border-[#17191c]/15 px-2.5 py-1.5">
      <span
        className={`h-2 w-2 ${
          active
            ? "bg-[#2457ff]"
            : "bg-[#8f918e]"
        }`}
      />

      <span className="font-mono text-[8px] uppercase tracking-[0.11em]">
        {active
          ? "Active"
          : "Ended"}
      </span>
    </div>
  );
}

function IntegrityBadge({
  status,
  large = false,
}: {
  status: TransactionDataStatus;
  large?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 border border-[#17191c]/15 ${
        large
          ? "px-3 py-2"
          : "px-2.5 py-1.5"
      }`}
    >
      <span
        className={`h-2 w-2 ${completenessColor(
          status,
        )}`}
      />

      <span
        className={`font-mono uppercase tracking-[0.11em] ${
          large
            ? "text-[9px]"
            : "text-[8px]"
        }`}
      >
        {formatCompletenessLabel(
          status,
        )}
      </span>
    </div>
  );
}

function FeaturedReading({
  label,
  sample,
  emptyLabel,
  right = false,
}: {
  label: string;
  sample:
    | TransactionMeterSample
    | undefined;
  emptyLabel: string;
  right?: boolean;
}) {
  return (
    <div
      className={`py-7 ${
        right
          ? "md:border-l md:border-[#17191c]/15 md:pl-8"
          : "md:pr-8"
      }`}
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#858783]">
        {label}
      </p>

      {sample ? (
        <>
          <p className="mt-4 font-mono text-3xl tracking-[-0.045em]">
            {formatFriendlyMeterReading(
              sample,
            )}
          </p>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#92948f]">
            <span>
              seq #
              {
                sample.sequenceNumber
              }
            </span>

            <span>
              {formatTimestamp(
                sample.sampledAt,
              )}
            </span>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-[#92948f]">
          {emptyLabel}
        </p>
      )}
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
    <div className="bg-[#f2f0ea] px-5 py-5">
      <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-[#92948f]">
        {label}
      </p>

      <p
        className={`mt-2 font-mono text-xl ${
          alert
            ? "text-[#df4c35]"
            : "text-[#17191c]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function MeterSampleRow({
  sample,
}: {
  sample: TransactionMeterSample;
}) {
  return (
    <article className="grid gap-5 border-b border-[#17191c]/15 px-3 py-5 lg:grid-cols-[180px_90px_minmax(240px,1fr)_180px_180px] lg:items-center">
      <DataCell label="Sampled">
        <p className="font-mono text-[10px] text-[#5f625f]">
          {formatTimestamp(
            sample.sampledAt,
          )}
        </p>
      </DataCell>

      <DataCell label="Sequence">
        <p className="font-mono text-sm">
          #
          {
            sample.sequenceNumber
          }
        </p>
      </DataCell>

      <DataCell label="Measurement">
        <p className="text-sm font-medium tracking-[-0.02em]">
          {formatMeasurand(
            sample.measurand,
          )}
        </p>

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[8px] uppercase tracking-[0.09em] text-[#8b8d89]">
          {sample.phase && (
            <span>
              {sample.phase}
            </span>
          )}

          {sample.location && (
            <span>
              {
                sample.location
              }
            </span>
          )}
        </div>
      </DataCell>

      <DataCell label="Reading">
        <p className="font-mono text-sm">
          {formatMeterReading(
            sample,
          )}
        </p>
      </DataCell>

      <DataCell label="Context">
        <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#6f726e]">
          {sample.context ??
            "—"}
        </p>
      </DataCell>
    </article>
  );
}

function DataCell({
  label,
  children,
}: {
  label: string;
  children:
    React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[#969894] lg:hidden">
        {label}
      </p>

      {children}
    </div>
  );
}

function completenessColor(
  status: TransactionDataStatus,
) {
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

function formatCompletenessLabel(
  status: TransactionDataStatus,
) {
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

function integrityHeadline(
  status: TransactionDataStatus,
) {
  switch (status) {
    case "COMPLETE":
      return "All expected events received";

    case "IN_PROGRESS":
      return "Transaction still receiving events";

    case "INCOMPLETE":
      return "Event sequence contains gaps";

    case "UNKNOWN":
      return "Integrity cannot yet be verified";
  }
}

function integrityDescription(
  status: TransactionDataStatus,
  missingSequenceNumbers: number[],
) {
  switch (status) {
    case "COMPLETE":
      return "The transaction has ended and every expected sequence receipt is present.";

    case "IN_PROGRESS":
      return "The charging session is still active, so the final sequence cannot yet be evaluated.";

    case "INCOMPLETE":
      if (
        missingSequenceNumbers.length ===
        0
      ) {
        return "The completed transaction has an integrity issue even though no explicit missing sequence number is currently available.";
      }

      return `${missingSequenceNumbers.length} expected ${
        missingSequenceNumbers.length ===
        1
          ? "event is"
          : "events are"
      } missing from the persisted receipt history.`;

    case "UNKNOWN":
      return "There is not enough receipt history to establish a reliable sequence origin.";
  }
}

function buildSequenceRail(
  first: number | null,
  last: number,
): Array<
  number | "ellipsis"
> {
  if (
    first === null ||
    last < first
  ) {
    return [];
  }

  const count =
    last - first + 1;

  if (count <= 24) {
    return Array.from(
      {
        length: count,
      },
      (_, index) =>
        first + index,
    );
  }

  const start =
    Array.from(
      {
        length: 11,
      },
      (_, index) =>
        first + index,
    );

  const endStart =
    last - 10;

  const end =
    Array.from(
      {
        length: 11,
      },
      (_, index) =>
        endStart +
        index,
    );

  return [
    ...start,
    "ellipsis",
    ...end,
  ];
}

function findLatestMeterSample(
  samples:
    TransactionMeterSample[],
  measurand: string,
) {
  return [...samples]
    .filter(
      (sample) =>
        sample.measurand ===
        measurand,
    )
    .sort(
      (left, right) =>
        new Date(
          right.sampledAt,
        ).getTime() -
        new Date(
          left.sampledAt,
        ).getTime(),
    )[0];
}

function formatFriendlyMeterReading(
  sample:
    TransactionMeterSample,
) {
  const numericValue =
    Number(sample.value);

  if (
    Number.isNaN(
      numericValue,
    )
  ) {
    return formatMeterReading(
      sample,
    );
  }

  const scaled =
    numericValue *
    10 **
      sample.unitMultiplier;

  if (
    sample.unit === "Wh"
  ) {
    if (
      Math.abs(scaled) >=
      1000
    ) {
      return `${formatNumber(
        scaled / 1000,
      )} kWh`;
    }

    return `${formatNumber(
      scaled,
    )} Wh`;
  }

  if (
    sample.unit === "W"
  ) {
    if (
      Math.abs(scaled) >=
      1000
    ) {
      return `${formatNumber(
        scaled / 1000,
      )} kW`;
    }

    return `${formatNumber(
      scaled,
    )} W`;
  }

  return formatMeterReading(
    sample,
  );
}

function formatMeterReading(
  sample:
    TransactionMeterSample,
) {
  const multiplier =
    sample.unitMultiplier ===
    0
      ? ""
      : ` ×10^${sample.unitMultiplier}`;

  const unit =
    sample.unit
      ? ` ${sample.unit}`
      : "";

  return `${sample.value}${multiplier}${unit}`;
}

function formatMeasurand(
  measurand: string | null,
) {
  switch (measurand) {
    case "Energy.Active.Import.Register":
      return "Energy imported";

    case "Power.Active.Import":
      return "Active power";

    default:
      return (
        measurand ??
        "Measurement"
      );
  }
}

function formatSequenceRange(
  first: number | null,
  last: number,
) {
  if (first === null) {
    return `— → ${last}`;
  }

  if (
    first === last
  ) {
    return `#${last}`;
  }

  return `${first} → ${last}`;
}

function formatDuration(
  startedAt: string,
  endedAt: string | null,
) {
  if (!endedAt) {
    return "In progress";
  }

  const start =
    new Date(
      startedAt,
    ).getTime();

  const end =
    new Date(
      endedAt,
    ).getTime();

  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    end < start
  ) {
    return "—";
  }

  const totalMinutes =
    Math.floor(
      (end - start) /
        60_000,
    );

  const hours =
    Math.floor(
      totalMinutes / 60,
    );

  const minutes =
    totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}

function formatNumber(
  value: number,
) {
  return new Intl.NumberFormat(
    "en",
    {
      maximumFractionDigits: 3,
    },
  ).format(value);
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