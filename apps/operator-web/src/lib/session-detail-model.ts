import {
  buildCanonicalSessionHref,
  buildStationHref,
  sanitizeInternalReturnPath,
} from "./routes";
import { sanitizeSessionsDirectoryReturnPath } from "./sessions-directory-model";
import type {
  ChargingTransaction,
  SessionCompletenessSectionResult,
  SessionPageDataSnapshot,
  TransactionCompleteness,
  TransactionDataStatus,
  TransactionMeterSample,
  TransactionStatus,
} from "./station-api";
import {
  formatConnectorCompositeId,
  formatSessionDuration,
  formatUtcDateTime,
} from "./station-detail-model";

export type SessionDetailSection = "overview" | "measurements" | "technical";

export const MAX_SEQUENCE_RAIL_SLOTS = 24;
export const MAX_MISSING_SEQUENCE_BADGES = 24;
export const MAX_CHART_POINTS = 120;

const VALID_SECTIONS = new Set<SessionDetailSection>([
  "overview",
  "measurements",
  "technical",
]);

const NUMERIC_VALUE_PATTERN =
  /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export function normalizeSessionDetailSection(
  raw: string | string[] | undefined,
): SessionDetailSection {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const candidate = typeof first === "string" ? first.trim() : "";
  if (VALID_SECTIONS.has(candidate as SessionDetailSection)) {
    return candidate as SessionDetailSection;
  }
  return "overview";
}

/**
 * Validates internal return paths for canonical session detail pages,
 * permitting `/sessions...` directory URLs or the matching parent station URL.
 */
export function sanitizeSessionDetailReturnPath(
  raw: string | string[] | undefined,
  stationId: string,
): string | null {
  const safeSessionsPath = sanitizeSessionsDirectoryReturnPath(raw);
  if (safeSessionsPath) {
    return safeSessionsPath;
  }

  const candidate = Array.isArray(raw) ? raw[0] : raw;
  const safeInternal = sanitizeInternalReturnPath(candidate);
  if (!safeInternal) {
    return null;
  }

  const parsed = new URL(safeInternal, "http://voltgrid.invalid");
  const expectedStationBase = buildStationHref(stationId);
  if (parsed.pathname === expectedStationBase) {
    return safeInternal;
  }

  return null;
}

/**
 * Builds a canonical `/stations/[stationId]/sessions/[sessionId]` URL preserving
 * non-default section state and validated internal return context.
 */
export function buildCanonicalSessionDetailHref(
  stationId: string,
  sessionId: string,
  options?: {
    section?: SessionDetailSection;
    returnTo?: string | null;
  },
): string {
  const baseHref = buildCanonicalSessionHref(stationId, sessionId);
  const params = new URLSearchParams();

  if (options?.section && options.section !== "overview") {
    params.set("section", options.section);
  }

  const safeReturn = sanitizeSessionDetailReturnPath(
    options?.returnTo ?? undefined,
    stationId,
  );
  if (safeReturn) {
    params.set("returnTo", safeReturn);
  }

  const queryString = params.toString();
  return queryString ? `${baseHref}?${queryString}` : baseHref;
}

/**
 * Resolves the canonical destination when redirecting legacy
 * `/stations/[stationId]/transactions/[transactionId]` links safely.
 */
export function buildLegacyTransactionToSessionRedirectHref(
  stationId: string,
  transactionId: string,
  searchParams: {
    section?: string | string[] | undefined;
    returnTo?: string | string[] | undefined;
  },
): string {
  const section = normalizeSessionDetailSection(searchParams.section);
  const returnTo = sanitizeSessionDetailReturnPath(
    searchParams.returnTo,
    stationId,
  );

  return buildCanonicalSessionDetailHref(stationId, transactionId, {
    section,
    returnTo,
  });
}

export interface SessionNormalizedSample {
  id: string;
  originalIndex: number;
  sequenceNumber: number;
  sampledAt: string;
  sampledAtMs: number | null;
  sampledAtUtc: string | null;
  rawValue: string;
  unit: string | null;
  unitMultiplier: number;
  measurand: string | null;
  context: string | null;
  phase: string | null;
  location: string | null;
  normalizedValue: number | null;
  plottable: boolean;
  invalidReason: "invalid-timestamp" | "non-numeric" | "overflow" | null;
  rawReadingLabel: string;
  normalizedReadingLabel: string;
  streamKey: string;
}

export interface SessionChartPoint {
  id: string;
  sequenceNumber: number;
  sampledAt: string;
  sampledAtUtc: string;
  sampledAtMs: number;
  normalizedValue: number;
  scaledDisplayValue: number;
  formattedDisplayValue: string;
  rawReadingLabel: string;
  x: number;
  y: number;
}

export interface SessionChartAxisTick {
  label: string;
  position: number;
}

export interface SessionMeasurementStream {
  key: string;
  label: string;
  measurandLabel: string;
  unit: string | null;
  displayUnit: string | null;
  displayScaleDivisor: number;
  phaseLabel: string | null;
  locationLabel: string | null;
  contextLabel: string | null;
  isCumulativeRegister: boolean;
  totalSamples: number;
  plottableSamples: number;
  unplottableSamples: number;
  samples: SessionNormalizedSample[];
  minDisplayValue: number | null;
  maxDisplayValue: number | null;
  latestSample: SessionNormalizedSample | null;
  hasDuplicateTimestamps: boolean;
  hasNegativeValues: boolean;
  isConstantSeries: boolean;
  gapBreakCount: number;
  isDownsampled: boolean;
  renderedPointCount: number;
  chartWidth: number;
  chartHeight: number;
  plotSegments: SessionChartPoint[][];
  zeroLineY: number | null;
  yTicks: SessionChartAxisTick[];
  xTicks: SessionChartAxisTick[];
}

export interface SessionSequenceRailItem {
  key: string;
  kind: "sequence" | "ellipsis";
  sequenceNumber: number | null;
  status: "recorded" | "missing" | "ellipsis";
}

export type SessionSequenceCompletenessModel =
  | {
      availability: "unavailable";
      message: string;
    }
  | {
      availability: "live";
      completeness: TransactionCompleteness;
      expectedSpanCount: number | null;
      recordedInRangeCount: number | null;
      missingCount: number;
      missingPreview: number[];
      missingOverflowCount: number;
      hasUnboundedStart: boolean;
      hasRangeInconsistency: boolean;
      inconsistencyReasons: string[];
      railTruncated: boolean;
      railItems: SessionSequenceRailItem[];
    };

export interface SessionDetailPresentationModel {
  transaction: ChargingTransaction;
  stationHref: string;
  sessionsReturnHref: string | null;
  backLinkHref: string;
  backLinkLabel: string;
  activeSection: SessionDetailSection;
  lifecycleStatus: TransactionStatus;
  completenessStatus: TransactionDataStatus | null;
  completenessAvailability: "live" | "unavailable";
  compositeEndpoint: string;
  startedAtUtc: string | null;
  endedAtUtc: string | null;
  durationState: "ended" | "ongoing" | "unavailable";
  durationLabel: string;
  measurementsAvailability: "live" | "unavailable";
  measurementsError: string | null;
  totalSampleCount: number;
  plottableSampleCount: number;
  unplottableSampleCount: number;
  allSamplesChronological: SessionNormalizedSample[];
  streams: SessionMeasurementStream[];
  sequenceModel: SessionSequenceCompletenessModel;
}

function parseStrictNumeric(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || !NUMERIC_VALUE_PATTERN.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRawUnitExpression(
  value: string,
  unit: string | null,
  unitMultiplier: number,
): string {
  const trimmed = value.trim() || value;
  if (!unit) {
    return unitMultiplier !== 0
      ? `${trimmed} × 10^${unitMultiplier}`
      : trimmed;
  }
  if (unitMultiplier === 0) {
    return `${trimmed} ${unit}`;
  }
  return `${trimmed} × 10^${unitMultiplier} ${unit}`;
}

function resolveDisplayUnitScale(
  unit: string | null,
  peakAbsNormalized: number,
): { displayUnit: string | null; divisor: number } {
  if (!unit) {
    return { displayUnit: null, divisor: 1 };
  }
  if (unit === "W" && peakAbsNormalized >= 1000) {
    return { displayUnit: "kW", divisor: 1000 };
  }
  if (unit === "Wh" && peakAbsNormalized >= 1000) {
    return { displayUnit: "kWh", divisor: 1000 };
  }
  return { displayUnit: unit, divisor: 1 };
}

function formatScaledNumber(value: number): string {
  const abs = Math.abs(value);
  const maximumFractionDigits =
    abs >= 100 ? 1 : abs >= 10 ? 2 : abs > 0 && abs < 0.01 ? 4 : 3;
  return value.toLocaleString("en-US", {
    maximumFractionDigits,
  });
}

function formatNormalizedReading(
  normalizedValue: number,
  unit: string | null,
  displayUnit: string | null,
  divisor: number,
): string {
  const scaled = normalizedValue / divisor;
  const formatted = formatScaledNumber(scaled);
  if (displayUnit) {
    return `${formatted} ${displayUnit}`;
  }
  if (unit) {
    return `${formatted} ${unit}`;
  }
  return formatted;
}

function isCumulativeRegisterMeasurand(measurand: string | null): boolean {
  if (!measurand) {
    return false;
  }
  if (measurand.includes("Register")) {
    return true;
  }
  return measurand.startsWith("Energy.") && !measurand.includes("Interval");
}

function formatCompactUtcTick(ms: number): string {
  const iso = new Date(ms).toISOString();
  return `${iso.slice(11, 19)}Z`;
}

function buildStreamKey(sample: TransactionMeterSample): string {
  return JSON.stringify([
    sample.measurand ?? null,
    sample.unit ?? null,
    sample.phase ?? null,
    sample.location ?? null,
    sample.context ?? null,
  ]);
}

function formatStreamLabel(sample: {
  measurand: string | null;
  unit: string | null;
  phase: string | null;
  location: string | null;
  context: string | null;
}): string {
  const base = sample.measurand ?? "Unspecified measurand";
  const qualifiers = [
    sample.phase,
    sample.location,
    sample.context,
    sample.unit ? `unit ${sample.unit}` : null,
  ].filter((part): part is string => Boolean(part));

  return qualifiers.length > 0 ? `${base} (${qualifiers.join(" · ")})` : base;
}

/**
 * Downsamples a single continuous segment deterministically while keeping
 * its exact first/last points and each bucket's min/max extremes.
 */
function downsampleSegment(
  segment: SessionNormalizedSample[],
  maxPoints: number,
): SessionNormalizedSample[] {
  if (segment.length <= maxPoints || maxPoints <= 4) {
    return segment;
  }

  const middle = segment.slice(1, -1);
  const bucketBudget = Math.max(1, Math.floor((maxPoints - 2) / 2));
  const bucketSize = middle.length / bucketBudget;
  const selectedIndices = new Set<number>([0, segment.length - 1]);

  for (let b = 0; b < bucketBudget; b += 1) {
    const start = Math.floor(b * bucketSize);
    const end = Math.min(middle.length, Math.floor((b + 1) * bucketSize));
    if (start >= end) continue;

    let minIdx = start;
    let maxIdx = start;
    for (let i = start; i < end; i += 1) {
      const val = middle[i]!.normalizedValue!;
      if (val < middle[minIdx]!.normalizedValue!) minIdx = i;
      if (val > middle[maxIdx]!.normalizedValue!) maxIdx = i;
    }

    selectedIndices.add(minIdx + 1);
    selectedIndices.add(maxIdx + 1);
  }

  return Array.from(selectedIndices)
    .sort((a, b) => a - b)
    .map(index => segment[index]!);
}

function hasMissingSequenceBetween(
  leftSeq: number,
  rightSeq: number,
  missingSequenceSet: ReadonlySet<number>,
): boolean {
  if (rightSeq - leftSeq <= 1 || missingSequenceSet.size === 0) {
    return false;
  }
  for (const seq of missingSequenceSet) {
    if (seq > leftSeq && seq < rightSeq) {
      return true;
    }
  }
  return false;
}

function buildStreamGeometry(
  rawSamples: SessionNormalizedSample[],
  displayUnit: string | null,
  divisor: number,
  missingSequenceSet: ReadonlySet<number>,
): Pick<
  SessionMeasurementStream,
  | "minDisplayValue"
  | "maxDisplayValue"
  | "hasDuplicateTimestamps"
  | "hasNegativeValues"
  | "isConstantSeries"
  | "gapBreakCount"
  | "isDownsampled"
  | "renderedPointCount"
  | "chartWidth"
  | "chartHeight"
  | "plotSegments"
  | "zeroLineY"
  | "yTicks"
  | "xTicks"
> {
  const chartWidth = 680;
  const chartHeight = 250;
  const padLeft = 64;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 38;
  const plotWidth = chartWidth - padLeft - padRight;
  const plotHeight = chartHeight - padTop - padBottom;

  const plottable = rawSamples.filter(
    sample => sample.plottable && sample.sampledAtMs !== null && sample.normalizedValue !== null,
  );

  if (plottable.length === 0) {
    return {
      minDisplayValue: null,
      maxDisplayValue: null,
      hasDuplicateTimestamps: false,
      hasNegativeValues: false,
      isConstantSeries: false,
      gapBreakCount: 0,
      isDownsampled: false,
      renderedPointCount: 0,
      chartWidth,
      chartHeight,
      plotSegments: [],
      zeroLineY: null,
      yTicks: [],
      xTicks: [],
    };
  }

  let hasDuplicateTimestamps = false;
  for (let i = 1; i < plottable.length; i += 1) {
    if (plottable[i]!.sampledAtMs === plottable[i - 1]!.sampledAtMs) {
      hasDuplicateTimestamps = true;
      break;
    }
  }

  const rawSegments: SessionNormalizedSample[][] = [[]];
  for (let i = 0; i < plottable.length; i += 1) {
    const sample = plottable[i]!;
    if (i > 0) {
      const prev = plottable[i - 1]!;
      if (
        hasMissingSequenceBetween(
          prev.sequenceNumber,
          sample.sequenceNumber,
          missingSequenceSet,
        )
      ) {
        rawSegments.push([]);
      }
    }
    rawSegments[rawSegments.length - 1]!.push(sample);
  }

  const gapBreakCount = Math.max(0, rawSegments.length - 1);
  const isDownsampled = plottable.length > MAX_CHART_POINTS;
  const budgetPerSegment = Math.max(
    4,
    Math.floor(MAX_CHART_POINTS / rawSegments.length),
  );
  const reducedSegments = isDownsampled
    ? rawSegments.map(seg => downsampleSegment(seg, budgetPerSegment))
    : rawSegments;

  const renderedSamples = reducedSegments.flat();
  const displayValues = plottable.map(s => s.normalizedValue! / divisor);
  const minDisplayValue = Math.min(...displayValues);
  const maxDisplayValue = Math.max(...displayValues);
  const hasNegativeValues = minDisplayValue < 0;
  const isConstantSeries = minDisplayValue === maxDisplayValue;

  let domainMin = minDisplayValue;
  let domainMax = maxDisplayValue;
  if (isConstantSeries) {
    const padding =
      minDisplayValue === 0
        ? 1
        : Math.max(Math.abs(minDisplayValue) * 0.1, 1);
    domainMin -= padding;
    domainMax += padding;
  } else {
    const span = domainMax - domainMin;
    domainMin -= span * 0.06;
    domainMax += span * 0.06;
  }

  const valueSpan = domainMax - domainMin || 1;
  const minMs = plottable[0]!.sampledAtMs!;
  const maxMs = plottable[plottable.length - 1]!.sampledAtMs!;
  const timeSpan = maxMs - minMs;

  const totalRendered = renderedSamples.length;
  const computeX = (ms: number, flatIndex: number): number => {
    if (totalRendered === 1) {
      return padLeft + plotWidth / 2;
    }
    if (timeSpan <= 0) {
      return padLeft + (flatIndex / (totalRendered - 1)) * plotWidth;
    }
    return padLeft + ((ms - minMs) / timeSpan) * plotWidth;
  };

  const computeY = (displayVal: number): number =>
    padTop + ((domainMax - displayVal) / valueSpan) * plotHeight;

  let runningIndex = 0;
  const plotSegments: SessionChartPoint[][] = reducedSegments.map(segment =>
    segment.map(sample => {
      const scaledDisplayValue = sample.normalizedValue! / divisor;
      const point: SessionChartPoint = {
        id: sample.id,
        sequenceNumber: sample.sequenceNumber,
        sampledAt: sample.sampledAt,
        sampledAtUtc: sample.sampledAtUtc!,
        sampledAtMs: sample.sampledAtMs!,
        normalizedValue: sample.normalizedValue!,
        scaledDisplayValue,
        formattedDisplayValue: formatNormalizedReading(
          sample.normalizedValue!,
          sample.unit,
          displayUnit,
          divisor,
        ),
        rawReadingLabel: sample.rawReadingLabel,
        x: Number(computeX(sample.sampledAtMs!, runningIndex).toFixed(2)),
        y: Number(computeY(scaledDisplayValue).toFixed(2)),
      };
      runningIndex += 1;
      return point;
    }),
  );

  const zeroLineY =
    domainMin <= 0 && domainMax >= 0 ? Number(computeY(0).toFixed(2)) : null;

  const midDisplay = (domainMin + domainMax) / 2;
  const yTicks: SessionChartAxisTick[] = [
    {
      label: formatScaledNumber(domainMax),
      position: Number(computeY(domainMax).toFixed(2)),
    },
    {
      label: formatScaledNumber(midDisplay),
      position: Number(computeY(midDisplay).toFixed(2)),
    },
    {
      label: formatScaledNumber(domainMin),
      position: Number(computeY(domainMin).toFixed(2)),
    },
  ];

  const xTicks: SessionChartAxisTick[] =
    timeSpan <= 0
      ? [
          {
            label: formatCompactUtcTick(minMs),
            position: padLeft + plotWidth / 2,
          },
        ]
      : [
          {
            label: formatCompactUtcTick(minMs),
            position: padLeft,
          },
          {
            label: formatCompactUtcTick(Math.round((minMs + maxMs) / 2)),
            position: padLeft + plotWidth / 2,
          },
          {
            label: formatCompactUtcTick(maxMs),
            position: padLeft + plotWidth,
          },
        ];

  return {
    minDisplayValue,
    maxDisplayValue,
    hasDuplicateTimestamps,
    hasNegativeValues,
    isConstantSeries,
    gapBreakCount,
    isDownsampled,
    renderedPointCount: totalRendered,
    chartWidth,
    chartHeight,
    plotSegments,
    zeroLineY,
    yTicks,
    xTicks,
  };
}

/**
 * Derives bounded sequence completeness summary and visual rail slots safely
 * for arbitrary span sizes, nullable start sequences, and inconsistent bounds.
 */
export function buildSessionSequenceModel(
  transaction: ChargingTransaction,
  completenessSection: SessionCompletenessSectionResult,
): SessionSequenceCompletenessModel {
  if (completenessSection.state === "unavailable") {
    return {
      availability: "unavailable",
      message: completenessSection.message,
    };
  }

  const { completeness } = completenessSection;
  const { firstSequenceNumber, lastSequenceNumber, missingSequenceNumbers } =
    completeness;

  const missingSet = new Set(missingSequenceNumbers);
  const missingCount = missingSequenceNumbers.length;
  const missingPreview = missingSequenceNumbers.slice(
    0,
    MAX_MISSING_SEQUENCE_BADGES,
  );
  const missingOverflowCount = Math.max(
    0,
    missingCount - missingPreview.length,
  );

  const inconsistencyReasons: string[] = [];
  if (lastSequenceNumber !== transaction.lastSequenceNumber) {
    inconsistencyReasons.push(
      `Session metadata reports last sequence ${transaction.lastSequenceNumber}, while completeness reports ${lastSequenceNumber}.`,
    );
  }

  if (
    firstSequenceNumber !== null &&
    lastSequenceNumber < firstSequenceNumber
  ) {
    inconsistencyReasons.push(
      `Completeness reports first sequence ${firstSequenceNumber} after last sequence ${lastSequenceNumber}.`,
    );
  }

  if (
    firstSequenceNumber !== null &&
    missingSequenceNumbers.some(
      seq => seq < firstSequenceNumber || seq > lastSequenceNumber,
    )
  ) {
    inconsistencyReasons.push(
      "One or more reported missing sequence numbers fall outside the completeness first/last bounds.",
    );
  }

  if (firstSequenceNumber === null) {
    return {
      availability: "live",
      completeness,
      expectedSpanCount: null,
      recordedInRangeCount: null,
      missingCount,
      missingPreview,
      missingOverflowCount,
      hasUnboundedStart: true,
      hasRangeInconsistency: inconsistencyReasons.length > 0,
      inconsistencyReasons,
      railTruncated: false,
      railItems: [],
    };
  }

  if (lastSequenceNumber < firstSequenceNumber) {
    return {
      availability: "live",
      completeness,
      expectedSpanCount: null,
      recordedInRangeCount: null,
      missingCount,
      missingPreview,
      missingOverflowCount,
      hasUnboundedStart: false,
      hasRangeInconsistency: true,
      inconsistencyReasons,
      railTruncated: false,
      railItems: [],
    };
  }

  const expectedSpanCount = lastSequenceNumber - firstSequenceNumber + 1;
  const inRangeMissingCount = missingSequenceNumbers.filter(
    seq => seq >= firstSequenceNumber && seq <= lastSequenceNumber,
  ).length;
  const recordedInRangeCount = Math.max(
    0,
    expectedSpanCount - inRangeMissingCount,
  );

  const makeSeqItem = (seq: number): SessionSequenceRailItem => ({
    key: `seq-${seq}`,
    kind: "sequence",
    sequenceNumber: seq,
    status: missingSet.has(seq) ? "missing" : "recorded",
  });

  if (expectedSpanCount <= MAX_SEQUENCE_RAIL_SLOTS) {
    const railItems: SessionSequenceRailItem[] = [];
    for (let seq = firstSequenceNumber; seq <= lastSequenceNumber; seq += 1) {
      railItems.push(makeSeqItem(seq));
    }
    return {
      availability: "live",
      completeness,
      expectedSpanCount,
      recordedInRangeCount,
      missingCount,
      missingPreview,
      missingOverflowCount,
      hasUnboundedStart: false,
      hasRangeInconsistency: inconsistencyReasons.length > 0,
      inconsistencyReasons,
      railTruncated: false,
      railItems,
    };
  }

  // O(1) bounded window for large sequence spans: head + highlighted gaps + tail.
  const picked = new Set<number>();
  for (
    let seq = firstSequenceNumber;
    seq < firstSequenceNumber + 5 && seq <= lastSequenceNumber;
    seq += 1
  ) {
    picked.add(seq);
  }
  for (
    let seq = Math.max(firstSequenceNumber, lastSequenceNumber - 4);
    seq <= lastSequenceNumber;
    seq += 1
  ) {
    picked.add(seq);
  }
  for (const seq of missingSequenceNumbers) {
    if (picked.size >= MAX_SEQUENCE_RAIL_SLOTS - 2) {
      break;
    }
    if (seq >= firstSequenceNumber && seq <= lastSequenceNumber) {
      picked.add(seq);
    }
  }

  const sortedPicked = Array.from(picked).sort((a, b) => a - b);
  const railItems: SessionSequenceRailItem[] = [];
  for (let i = 0; i < sortedPicked.length; i += 1) {
    const seq = sortedPicked[i]!;
    if (i > 0 && seq > sortedPicked[i - 1]! + 1) {
      railItems.push({
        key: `ellipsis-${sortedPicked[i - 1]!}-${seq}`,
        kind: "ellipsis",
        sequenceNumber: null,
        status: "ellipsis",
      });
    }
    railItems.push(makeSeqItem(seq));
  }

  return {
    availability: "live",
    completeness,
    expectedSpanCount,
    recordedInRangeCount,
    missingCount,
    missingPreview,
    missingOverflowCount,
    hasUnboundedStart: false,
    hasRangeInconsistency: inconsistencyReasons.length > 0,
    inconsistencyReasons,
    railTruncated: true,
    railItems,
  };
}

/**
 * Transforms live GraphQL session detail data into section-safe, scientifically
 * conservative view models with strict stream grouping and explicit partial failures.
 */
export function buildSessionDetailModel(
  snapshot: Extract<SessionPageDataSnapshot, { state: "live" }>,
  options?: {
    section?: string | string[] | undefined;
    returnTo?: string | string[] | undefined;
  },
): SessionDetailPresentationModel {
  const { transaction, completeness, meterSamples } = snapshot;
  const activeSection = normalizeSessionDetailSection(options?.section);
  const stationHref = buildStationHref(transaction.stationId);
  const safeReturn = sanitizeSessionDetailReturnPath(
    options?.returnTo,
    transaction.stationId,
  );
  const backLinkHref = safeReturn ?? stationHref;
  const backLinkLabel =
    safeReturn && safeReturn.startsWith("/sessions")
      ? "Back to Charging sessions"
      : `Back to ${transaction.stationId}`;

  const startedAtUtc = formatUtcDateTime(transaction.startedAt);
  const endedAtUtc = formatUtcDateTime(transaction.endedAt);
  const computedDuration = formatSessionDuration(
    transaction.startedAt,
    transaction.endedAt,
  );
  const durationState: SessionDetailPresentationModel["durationState"] =
    transaction.status === "ACTIVE" || transaction.endedAt === null
      ? "ongoing"
      : computedDuration
        ? "ended"
        : "unavailable";
  const durationLabel =
    durationState === "ongoing"
      ? "Ongoing"
      : computedDuration ?? "Unavailable";

  const sequenceModel = buildSessionSequenceModel(transaction, completeness);
  const missingSequenceSet =
    completeness.state === "live"
      ? new Set(completeness.completeness.missingSequenceNumbers)
      : new Set<number>();

  if (meterSamples.state === "unavailable") {
    return {
      transaction,
      stationHref,
      sessionsReturnHref: safeReturn,
      backLinkHref,
      backLinkLabel,
      activeSection,
      lifecycleStatus: transaction.status,
      completenessStatus:
        sequenceModel.availability === "live"
          ? sequenceModel.completeness.status
          : null,
      completenessAvailability: completeness.state,
      compositeEndpoint: formatConnectorCompositeId(
        transaction.evseId,
        transaction.connectorId,
      ),
      startedAtUtc,
      endedAtUtc,
      durationState,
      durationLabel,
      measurementsAvailability: "unavailable",
      measurementsError: meterSamples.message,
      totalSampleCount: 0,
      plottableSampleCount: 0,
      unplottableSampleCount: 0,
      allSamplesChronological: [],
      streams: [],
      sequenceModel,
    };
  }

  const rawSamples: Array<{
    sample: TransactionMeterSample;
    originalIndex: number;
    sampledAtMs: number | null;
    sampledAtUtc: string | null;
    normalizedValue: number | null;
    invalidReason: SessionNormalizedSample["invalidReason"];
  }> = meterSamples.samples.map((sample, originalIndex) => {
    const sampledAtUtc = formatUtcDateTime(sample.sampledAt);
    const parsedTime = Date.parse(sample.sampledAt);
    const sampledAtMs =
      sampledAtUtc !== null && Number.isFinite(parsedTime) ? parsedTime : null;

    const rawNum = parseStrictNumeric(sample.value);
    if (sampledAtMs === null) {
      return {
        sample,
        originalIndex,
        sampledAtMs: null,
        sampledAtUtc: null,
        normalizedValue: null,
        invalidReason: "invalid-timestamp",
      };
    }

    if (rawNum === null) {
      return {
        sample,
        originalIndex,
        sampledAtMs,
        sampledAtUtc,
        normalizedValue: null,
        invalidReason: "non-numeric",
      };
    }

    const scaled =
      sample.unitMultiplier === 0
        ? rawNum
        : rawNum * Math.pow(10, sample.unitMultiplier);

    if (
      !Number.isSafeInteger(sample.unitMultiplier) ||
      Math.abs(sample.unitMultiplier) > 15 ||
      !Number.isFinite(scaled)
    ) {
      return {
        sample,
        originalIndex,
        sampledAtMs,
        sampledAtUtc,
        normalizedValue: null,
        invalidReason: "overflow",
      };
    }

    return {
      sample,
      originalIndex,
      sampledAtMs,
      sampledAtUtc,
      normalizedValue: scaled,
      invalidReason: null,
    };
  });

  rawSamples.sort((a, b) => {
    if (a.sampledAtMs !== null && b.sampledAtMs !== null) {
      if (a.sampledAtMs !== b.sampledAtMs) {
        return a.sampledAtMs - b.sampledAtMs;
      }
    } else if (a.sampledAtMs !== null) {
      return -1;
    } else if (b.sampledAtMs !== null) {
      return 1;
    }

    if (a.sample.sequenceNumber !== b.sample.sequenceNumber) {
      return a.sample.sequenceNumber - b.sample.sequenceNumber;
    }

    return a.originalIndex - b.originalIndex;
  });

  const groupedRaw = new Map<string, typeof rawSamples>();
  for (const item of rawSamples) {
    const key = buildStreamKey(item.sample);
    const existing = groupedRaw.get(key);
    if (existing) {
      existing.push(item);
    } else {
      groupedRaw.set(key, [item]);
    }
  }

  const allSamplesNormalized = new Map<number, SessionNormalizedSample>();
  const streams: SessionMeasurementStream[] = [];

  for (const [key, items] of groupedRaw.entries()) {
    const first = items[0]!.sample;
    const peakAbsNormalized = items.reduce((maxVal, entry) => {
      if (entry.normalizedValue === null) return maxVal;
      return Math.max(maxVal, Math.abs(entry.normalizedValue));
    }, 0);

    const { displayUnit, divisor } = resolveDisplayUnitScale(
      first.unit,
      peakAbsNormalized,
    );

    const streamSamples: SessionNormalizedSample[] = items.map(entry => {
      const normalizedReadingLabel =
        entry.normalizedValue !== null
          ? formatNormalizedReading(
              entry.normalizedValue,
              entry.sample.unit,
              displayUnit,
              divisor,
            )
          : entry.invalidReason === "overflow"
            ? "Scaled value out of range"
            : entry.invalidReason === "invalid-timestamp"
              ? "Invalid timestamp"
              : "Non-numeric raw value";

      const normalized: SessionNormalizedSample = {
        id: `sample-${entry.originalIndex}-seq-${entry.sample.sequenceNumber}`,
        originalIndex: entry.originalIndex,
        sequenceNumber: entry.sample.sequenceNumber,
        sampledAt: entry.sample.sampledAt,
        sampledAtMs: entry.sampledAtMs,
        sampledAtUtc: entry.sampledAtUtc,
        rawValue: entry.sample.value,
        unit: entry.sample.unit,
        unitMultiplier: entry.sample.unitMultiplier,
        measurand: entry.sample.measurand,
        context: entry.sample.context,
        phase: entry.sample.phase,
        location: entry.sample.location,
        normalizedValue: entry.normalizedValue,
        plottable: entry.normalizedValue !== null && entry.sampledAtMs !== null,
        invalidReason: entry.invalidReason,
        rawReadingLabel: formatRawUnitExpression(
          entry.sample.value,
          entry.sample.unit,
          entry.sample.unitMultiplier,
        ),
        normalizedReadingLabel,
        streamKey: key,
      };

      allSamplesNormalized.set(entry.originalIndex, normalized);
      return normalized;
    });

    const plottableCount = streamSamples.filter(s => s.plottable).length;
    const latestSample = streamSamples[streamSamples.length - 1] ?? null;
    const geometry = buildStreamGeometry(
      streamSamples,
      displayUnit,
      divisor,
      missingSequenceSet,
    );

    streams.push({
      key,
      label: formatStreamLabel(first),
      measurandLabel: first.measurand ?? "Unspecified measurand",
      unit: first.unit,
      displayUnit,
      displayScaleDivisor: divisor,
      phaseLabel: first.phase,
      locationLabel: first.location,
      contextLabel: first.context,
      isCumulativeRegister: isCumulativeRegisterMeasurand(first.measurand),
      totalSamples: streamSamples.length,
      plottableSamples: plottableCount,
      unplottableSamples: streamSamples.length - plottableCount,
      samples: streamSamples,
      latestSample,
      ...geometry,
    });
  }

  // Order streams deterministically: plottable streams first, then largest count, then label.
  streams.sort((a, b) => {
    const aHasPlot = a.plottableSamples > 0 ? 0 : 1;
    const bHasPlot = b.plottableSamples > 0 ? 0 : 1;
    if (aHasPlot !== bHasPlot) return aHasPlot - bHasPlot;
    if (b.plottableSamples !== a.plottableSamples) {
      return b.plottableSamples - a.plottableSamples;
    }
    return a.label.localeCompare(b.label, "en");
  });

  const allSamplesChronological = rawSamples.map(
    entry => allSamplesNormalized.get(entry.originalIndex)!,
  );
  const plottableSampleCount = allSamplesChronological.filter(
    s => s.plottable,
  ).length;

  return {
    transaction,
    stationHref,
    sessionsReturnHref: safeReturn,
    backLinkHref,
    backLinkLabel,
    activeSection,
    lifecycleStatus: transaction.status,
    completenessStatus:
      sequenceModel.availability === "live"
        ? sequenceModel.completeness.status
        : null,
    completenessAvailability: completeness.state,
    compositeEndpoint: formatConnectorCompositeId(
      transaction.evseId,
      transaction.connectorId,
    ),
    startedAtUtc,
    endedAtUtc,
    durationState,
    durationLabel,
    measurementsAvailability: "live",
    measurementsError: null,
    totalSampleCount: allSamplesChronological.length,
    plottableSampleCount,
    unplottableSampleCount:
      allSamplesChronological.length - plottableSampleCount,
    allSamplesChronological,
    streams,
    sequenceModel,
  };
}
