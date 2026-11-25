import { buildCanonicalSessionHref, buildStationHref } from "./routes";
import type {
  ChargingTransaction,
  NetworkTransaction,
  NetworkTransactionPageSnapshot,
  StationSnapshot,
  TransactionCompleteness,
  TransactionDataStatus,
} from "./station-api";
import {
  formatSessionDuration,
  formatUtcDateTime,
} from "./station-detail-model";
import { formatUtcRetrievalTime } from "./station-snapshot-utils";

export const DEFAULT_SESSION_PAGE_SIZE = 20;
export const MAX_SESSION_PAGE_SIZE = 100;
export const SUPPORTED_SESSION_PAGE_SIZES = [10, 20, 50] as const;

export type RawSessionsSearchParams = Record<string, string | string[] | undefined>;

export interface SessionsDirectoryFilters {
  stationId: string | null;
  transactionId: string | null;
  integrityStatus: TransactionDataStatus | null;
  page: number;
  size: number;
}

export type SessionsDirectoryState =
  | "results"
  | "empty"
  | "no-matches"
  | "unavailable";

export interface SessionCompletenessPresentation {
  status: TransactionDataStatus;
  detailLabel: string;
  firstSequenceNumber: number | null;
  lastSequenceNumber: number;
  missingSequenceNumbers: number[];
}

export interface SessionDirectoryRow {
  compositeKey: string;
  transaction: ChargingTransaction;
  stationName: string | null;
  stationHref: string;
  sessionHref: string;
  compositeEquipment: string;
  completeness: SessionCompletenessPresentation;
  startedAtUtc: string | null;
  endedAtUtc: string | null;
  durationLabel: string | null;
}

export interface SessionsDirectoryPagination {
  page: number;
  size: number;
  displayPage: number;
  totalElements: number | null;
  totalPages: number | null;
  displayTotalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  rangeStart: number;
  rangeEnd: number;
  previousHref: string | null;
  nextHref: string | null;
  isOutOfRange: boolean;
  clampedPage: number;
}

export interface SessionsDirectoryModel {
  availability: "live" | "unavailable";
  directoryState: SessionsDirectoryState;
  errorMessage: string | null;
  retrievedAtIso: string | null;
  retrievedAtUtc: string | null;
  filters: SessionsDirectoryFilters;
  hasActiveFilters: boolean;
  totalMatchingSessions: number | null;
  networkMissingDataCount: number | null;
  rows: SessionDirectoryRow[];
  pagination: SessionsDirectoryPagination;
  selfHref: string;
}

const VALID_INTEGRITY_STATUSES = new Set<TransactionDataStatus>([
  "IN_PROGRESS",
  "COMPLETE",
  "INCOMPLETE",
  "UNKNOWN",
]);

function firstParamValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeOptionalIdentifier(
  primary: string | string[] | undefined,
  fallback?: string | string[] | undefined,
): string | null {
  const candidate = firstParamValue(primary) ?? firstParamValue(fallback);
  if (typeof candidate !== "string") {
    return null;
  }
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeIntegrityStatus(
  primary: string | string[] | undefined,
  fallback?: string | string[] | undefined,
): TransactionDataStatus | null {
  const candidate = firstParamValue(primary) ?? firstParamValue(fallback);
  if (typeof candidate !== "string") {
    return null;
  }
  const trimmed = candidate.trim();
  return VALID_INTEGRITY_STATUSES.has(trimmed as TransactionDataStatus)
    ? (trimmed as TransactionDataStatus)
    : null;
}

function normalizeNonNegativeInt(
  value: string | string[] | undefined,
  fallback: number,
  options: { min?: number; max?: number } = {},
): number {
  const candidate = firstParamValue(value);
  if (typeof candidate !== "string") {
    return fallback;
  }
  const trimmed = candidate.trim();
  if (!/^\d+$/.test(trimmed)) {
    return fallback;
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) {
    return fallback;
  }
  if (options.min !== undefined && parsed < options.min) {
    return fallback;
  }
  if (options.max !== undefined && parsed > options.max) {
    return fallback;
  }
  return parsed;
}

/**
 * Normalizes canonical `/sessions` query parameters while also accepting legacy
 * `/transactions` aliases (`station`, `q`, `integrity`). Preserves exact identifier casing.
 */
export function normalizeSessionsDirectoryFilters(
  raw: RawSessionsSearchParams = {},
): SessionsDirectoryFilters {
  return {
    stationId: normalizeOptionalIdentifier(raw.stationId, raw.station),
    transactionId: normalizeOptionalIdentifier(raw.transactionId, raw.q),
    integrityStatus: normalizeIntegrityStatus(raw.integrityStatus, raw.integrity),
    page: normalizeNonNegativeInt(raw.page, 0, { min: 0 }),
    size: normalizeNonNegativeInt(raw.size, DEFAULT_SESSION_PAGE_SIZE, {
      min: 1,
      max: MAX_SESSION_PAGE_SIZE,
    }),
  };
}

/**
 * Builds a canonical `/sessions` URL preserving only validated supported parameters.
 */
export function buildSessionsDirectoryHref(
  filters: Partial<SessionsDirectoryFilters> = {},
): string {
  const params = new URLSearchParams();
  const stationId = filters.stationId?.trim() ?? "";
  const transactionId = filters.transactionId?.trim() ?? "";
  const integrityStatus = filters.integrityStatus ?? null;
  const page =
    typeof filters.page === "number" && Number.isSafeInteger(filters.page) && filters.page > 0
      ? filters.page
      : 0;
  const size =
    typeof filters.size === "number" &&
    Number.isSafeInteger(filters.size) &&
    filters.size >= 1 &&
    filters.size <= MAX_SESSION_PAGE_SIZE
      ? filters.size
      : DEFAULT_SESSION_PAGE_SIZE;

  if (stationId) {
    params.set("stationId", stationId);
  }
  if (transactionId) {
    params.set("transactionId", transactionId);
  }
  if (integrityStatus && VALID_INTEGRITY_STATUSES.has(integrityStatus)) {
    params.set("integrityStatus", integrityStatus);
  }
  if (page > 0) {
    params.set("page", String(page));
  }
  if (size !== DEFAULT_SESSION_PAGE_SIZE) {
    params.set("size", String(size));
  }

  const query = params.toString();
  return query ? `/sessions?${query}` : "/sessions";
}

/**
 * Maps legacy `/transactions?...` query parameters into a canonical `/sessions?...` path,
 * stripping any unsupported or malformed parameters cleanly.
 */
export function resolveLegacyTransactionsRedirectTarget(
  raw: RawSessionsSearchParams = {},
): string {
  const filters = normalizeSessionsDirectoryFilters(raw);
  return buildSessionsDirectoryHref(filters);
}

/**
 * Validates that a return path targets only the internal `/sessions` directory
 * (never external origins, protocol-relative URLs, or unrelated paths).
 */
export function sanitizeSessionsDirectoryReturnPath(
  candidate: string | string[] | null | undefined,
): string | null {
  const raw = Array.isArray(candidate) ? candidate[0] : candidate;
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (
    !trimmed.startsWith("/sessions") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(trimmed)
  ) {
    return null;
  }
  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost" || parsed.pathname !== "/sessions") {
      return null;
    }
    const rawParams: RawSessionsSearchParams = {};
    for (const key of parsed.searchParams.keys()) {
      const value = parsed.searchParams.get(key);
      if (value !== null) {
        rawParams[key] = value;
      }
    }
    return buildSessionsDirectoryHref(normalizeSessionsDirectoryFilters(rawParams));
  } catch {
    return null;
  }
}

/**
 * Builds the canonical composite `(stationId, sessionId)` session detail route,
 * forwarding an optional validated `/sessions` directory context return path.
 */
export function buildSessionsDirectoryDetailHref(
  stationId: string,
  transactionId: string,
  returnPath?: string | null,
): string {
  const baseHref = buildCanonicalSessionHref(stationId, transactionId);
  const safeReturn = sanitizeSessionsDirectoryReturnPath(returnPath);
  if (!safeReturn || safeReturn === "/sessions") {
    return baseHref;
  }
  const params = new URLSearchParams({ returnTo: safeReturn });
  return `${baseHref}?${params.toString()}`;
}

/**
 * Formats non-invented sequence/completeness context matching Station Completeness statuses.
 */
export function formatCompletenessDetailLabel(
  completeness: TransactionCompleteness,
): string {
  switch (completeness.status) {
    case "IN_PROGRESS":
      return "Receiving events";
    case "COMPLETE":
      return "Sequence verified";
    case "INCOMPLETE": {
      const missing = completeness.missingSequenceNumbers;
      if (missing.length === 0) {
        return "Receipt gap detected";
      }
      if (missing.length <= 4) {
        return `Missing ${missing.map(seq => `#${seq}`).join(", ")}`;
      }
      const preview = missing
        .slice(0, 3)
        .map(seq => `#${seq}`)
        .join(", ");
      return `Missing ${preview} +${missing.length - 3} more`;
    }
    case "UNKNOWN":
      return "Insufficient receipt history";
  }
}

/**
 * Builds a lookup map of verified station names from a live `StationSnapshot` without
 * inventing names when Station Service station list is unavailable or missing a station.
 */
export function buildVerifiedStationNameMap(
  snapshot: StationSnapshot | null | undefined,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  if (!snapshot || snapshot.state !== "live") {
    return map;
  }
  for (const station of snapshot.stations) {
    const trimmedName = station.name.trim();
    if (trimmedName) {
      map.set(station.id, trimmedName);
    }
  }
  return map;
}

function mapTransactionRow(
  record: NetworkTransaction,
  stationNames: ReadonlyMap<string, string>,
  returnPath: string,
): SessionDirectoryRow {
  const { transaction, completeness } = record;
  return {
    compositeKey: `${transaction.stationId}:${transaction.transactionId}`,
    transaction,
    stationName: stationNames.get(transaction.stationId) ?? null,
    stationHref: buildStationHref(transaction.stationId),
    sessionHref: buildSessionsDirectoryDetailHref(
      transaction.stationId,
      transaction.transactionId,
      returnPath,
    ),
    compositeEquipment: `EVSE ${transaction.evseId} · Connector ${transaction.connectorId}`,
    completeness: {
      status: completeness.status,
      detailLabel: formatCompletenessDetailLabel(completeness),
      firstSequenceNumber: completeness.firstSequenceNumber,
      lastSequenceNumber: completeness.lastSequenceNumber,
      missingSequenceNumbers: completeness.missingSequenceNumbers,
    },
    startedAtUtc: formatUtcDateTime(transaction.startedAt),
    endedAtUtc: formatUtcDateTime(transaction.endedAt),
    durationLabel:
      transaction.status === "ENDED"
        ? formatSessionDuration(transaction.startedAt, transaction.endedAt)
        : null,
  };
}

/**
 * Derives the pure presentation model for the canonical `/sessions` directory from a
 * server-paginated GraphQL snapshot, optional verified station name map, and optional
 * unfiltered network-wide missing-data summary response.
 */
export function buildSessionsDirectoryModel(
  pageSnapshot: NetworkTransactionPageSnapshot,
  filters: SessionsDirectoryFilters,
  options: {
    stationNames?: ReadonlyMap<string, string>;
    networkMissingDataSnapshot?: NetworkTransactionPageSnapshot | null;
    retrievedAtIso?: string | null;
  } = {},
): SessionsDirectoryModel {
  const selfHref = buildSessionsDirectoryHref(filters);
  const hasActiveFilters =
    filters.stationId !== null ||
    filters.transactionId !== null ||
    filters.integrityStatus !== null;

  const retrievedAtIso =
    pageSnapshot.state === "live" ? (options.retrievedAtIso ?? null) : null;
  const retrievedAtUtc = retrievedAtIso
    ? formatUtcRetrievalTime(retrievedAtIso)
    : null;

  const stationNames = options.stationNames ?? new Map<string, string>();

  // Determine unfiltered network-wide missing-data total cleanly without per-row requests
  let networkMissingDataCount: number | null = null;
  if (
    pageSnapshot.state === "live" &&
    filters.stationId === null &&
    filters.transactionId === null &&
    filters.integrityStatus === "INCOMPLETE"
  ) {
    networkMissingDataCount = pageSnapshot.totalElements;
  } else if (options.networkMissingDataSnapshot?.state === "live") {
    networkMissingDataCount = options.networkMissingDataSnapshot.totalElements;
  }

  if (pageSnapshot.state === "unavailable") {
    return {
      availability: "unavailable",
      directoryState: "unavailable",
      errorMessage: pageSnapshot.message,
      retrievedAtIso: null,
      retrievedAtUtc: null,
      filters,
      hasActiveFilters,
      totalMatchingSessions: null,
      networkMissingDataCount,
      rows: [],
      pagination: {
        page: filters.page,
        size: filters.size,
        displayPage: 0,
        totalElements: null,
        totalPages: null,
        displayTotalPages: 0,
        hasPrevious: false,
        hasNext: false,
        rangeStart: 0,
        rangeEnd: 0,
        previousHref: null,
        nextHref: null,
        isOutOfRange: false,
        clampedPage: 0,
      },
      selfHref,
    };
  }

  const lastPage = Math.max(pageSnapshot.totalPages - 1, 0);
  const isOutOfRange = filters.page > lastPage;
  const rows = pageSnapshot.transactions.map(record =>
    mapTransactionRow(record, stationNames, selfHref),
  );

  const directoryState: SessionsDirectoryState =
    rows.length > 0
      ? "results"
      : hasActiveFilters
        ? "no-matches"
        : "empty";

  const hasPrevious = pageSnapshot.page > 0;
  const hasNext = pageSnapshot.hasNext;
  const displayPage = pageSnapshot.totalPages === 0 ? 0 : pageSnapshot.page + 1;
  const rangeStart =
    rows.length === 0 ? 0 : pageSnapshot.page * pageSnapshot.size + 1;
  const rangeEnd =
    rows.length === 0 ? 0 : rangeStart + rows.length - 1;

  return {
    availability: "live",
    directoryState,
    errorMessage: null,
    retrievedAtIso,
    retrievedAtUtc,
    filters,
    hasActiveFilters,
    totalMatchingSessions: pageSnapshot.totalElements,
    networkMissingDataCount,
    rows,
    pagination: {
      page: pageSnapshot.page,
      size: pageSnapshot.size,
      displayPage,
      totalElements: pageSnapshot.totalElements,
      totalPages: pageSnapshot.totalPages,
      displayTotalPages: pageSnapshot.totalPages,
      hasPrevious,
      hasNext,
      rangeStart,
      rangeEnd,
      previousHref: hasPrevious
        ? buildSessionsDirectoryHref({
            ...filters,
            page: pageSnapshot.page - 1,
          })
        : null,
      nextHref: hasNext
        ? buildSessionsDirectoryHref({
            ...filters,
            page: pageSnapshot.page + 1,
          })
        : null,
      isOutOfRange,
      clampedPage: lastPage,
    },
    selfHref,
  };
}
