import type {
  DiagnosticsPageSnapshot,
  OperationalStatus,
  ProjectedStationStatusRecord,
  StationOperationalLookupSnapshot,
} from "./operations-api";
import { buildStationHref } from "./routes";
import { formatUtcDateTime } from "./station-detail-model";
import { formatUtcRetrievalTime } from "./station-snapshot-utils";

export interface DiagnosticsFilterParams {
  status: "" | OperationalStatus;
  stationId: string;
  after: string | null;
}

export interface RawDiagnosticsSearchParams {
  status?: string | string[];
  stationId?: string | string[];
  station?: string | string[];
  after?: string | string[];
}

export interface DiagnosticsRecordRow {
  stationId: string;
  stationHref: string;
  currentStatus: string;
  lastEventId: string | null;
  statusChangedAt: string;
  statusChangedAtUtc: string | null;
  updatedAt: string;
  updatedAtUtc: string | null;
}

export interface DiagnosticsPresentationModel {
  mode: "cursor-page" | "station-lookup";
  filters: DiagnosticsFilterParams;
  hasActiveFilters: boolean;
  availability: "live" | "found" | "not-found" | "unavailable";
  invalidCursor: boolean;
  errorMessage: string | null;
  records: DiagnosticsRecordRow[];
  hasNextPage: boolean;
  endCursor: string | null;
  nextHref: string | null;
  firstPageHref: string | null;
  clearFiltersHref: string;
  retrievedAtUtc: string | null;
}

const VALID_STATUSES = new Set<OperationalStatus>([
  "ONLINE",
  "OFFLINE",
  "UNAVAILABLE",
]);

function firstParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Normalizes Operations Diagnostics URL parameters safely without coercing
 * case-sensitive station identifiers or retaining stale cursors during exact lookup.
 */
export function normalizeDiagnosticsParams(
  raw: RawDiagnosticsSearchParams,
): DiagnosticsFilterParams {
  const statusCandidate = firstParam(raw.status);
  const status: "" | OperationalStatus = VALID_STATUSES.has(
    statusCandidate as OperationalStatus,
  )
    ? (statusCandidate as OperationalStatus)
    : "";

  const rawStationId = firstParam(raw.stationId) || firstParam(raw.station);
  const stationId =
    rawStationId.length > 0 && rawStationId.length <= 255 && !/[\u0000-\u001F\u007F]/.test(rawStationId)
      ? rawStationId
      : "";

  const rawAfter = firstParam(raw.after);
  const after =
    !stationId &&
    rawAfter.length > 0 &&
    rawAfter.length <= 512 &&
    !/[\u0000-\u001F\u007F]/.test(rawAfter)
      ? rawAfter
      : null;

  return {
    status,
    stationId,
    after,
  };
}

export function buildDiagnosticsHref(
  params: Partial<DiagnosticsFilterParams>,
): string {
  const query = new URLSearchParams();

  if (params.stationId && params.stationId.trim().length > 0) {
    query.set("stationId", params.stationId.trim());
  } else {
    if (params.status && VALID_STATUSES.has(params.status)) {
      query.set("status", params.status);
    }
    if (params.after && params.after.trim().length > 0) {
      query.set("after", params.after.trim());
    }
  }

  const encoded = query.toString();
  return encoded ? `/diagnostics?${encoded}` : "/diagnostics";
}

/**
 * Maps legacy `/operations?...` parameters onto `/diagnostics`, discarding
 * arbitrary/unsafe query parameters and invalid filter values.
 */
export function resolveLegacyOperationsRedirectTarget(
  raw: RawDiagnosticsSearchParams,
): string {
  return buildDiagnosticsHref(normalizeDiagnosticsParams(raw));
}

function toRecordRow(record: ProjectedStationStatusRecord): DiagnosticsRecordRow {
  return {
    stationId: record.stationId,
    stationHref: buildStationHref(record.stationId),
    currentStatus: record.currentStatus,
    lastEventId: record.lastEventId,
    statusChangedAt: record.statusChangedAt,
    statusChangedAtUtc: formatUtcDateTime(record.statusChangedAt),
    updatedAt: record.updatedAt,
    updatedAtUtc: formatUtcDateTime(record.updatedAt),
  };
}

/**
 * Builds the Diagnostics screen model from either a cursor-paginated
 * `stationStatuses` query or an exact single-station `stationStatus` lookup.
 */
export function buildDiagnosticsModel(
  filters: DiagnosticsFilterParams,
  source:
    | { mode: "cursor-page"; snapshot: DiagnosticsPageSnapshot }
    | { mode: "station-lookup"; snapshot: StationOperationalLookupSnapshot },
  options: { retrievedAtIso?: string | null } = {},
): DiagnosticsPresentationModel {
  const hasActiveFilters = Boolean(filters.status || filters.stationId);
  const retrievedAtUtc =
    options.retrievedAtIso ? formatUtcRetrievalTime(options.retrievedAtIso) : null;

  if (source.mode === "station-lookup") {
    const { snapshot } = source;
    if (snapshot.state === "unavailable") {
      return {
        mode: "station-lookup",
        filters,
        hasActiveFilters,
        availability: "unavailable",
        invalidCursor: false,
        errorMessage: snapshot.message,
        records: [],
        hasNextPage: false,
        endCursor: null,
        nextHref: null,
        firstPageHref: null,
        clearFiltersHref: "/diagnostics",
        retrievedAtUtc: null,
      };
    }

    if (snapshot.state === "not-found") {
      return {
        mode: "station-lookup",
        filters,
        hasActiveFilters,
        availability: "not-found",
        invalidCursor: false,
        errorMessage: null,
        records: [],
        hasNextPage: false,
        endCursor: null,
        nextHref: null,
        firstPageHref: null,
        clearFiltersHref: "/diagnostics",
        retrievedAtUtc,
      };
    }

    return {
      mode: "station-lookup",
      filters,
      hasActiveFilters,
      availability: "found",
      invalidCursor: false,
      errorMessage: null,
      records: [toRecordRow(snapshot.record)],
      hasNextPage: false,
      endCursor: null,
      nextHref: null,
      firstPageHref: null,
      clearFiltersHref: "/diagnostics",
      retrievedAtUtc,
    };
  }

  const { snapshot } = source;
  const firstPageHref = filters.after
    ? buildDiagnosticsHref({ status: filters.status })
    : null;

  if (snapshot.state === "unavailable") {
    return {
      mode: "cursor-page",
      filters,
      hasActiveFilters,
      availability: "unavailable",
      invalidCursor: Boolean(snapshot.invalidCursor),
      errorMessage: snapshot.message,
      records: [],
      hasNextPage: false,
      endCursor: null,
      nextHref: null,
      firstPageHref,
      clearFiltersHref: "/diagnostics",
      retrievedAtUtc: null,
    };
  }

  const nextHref =
    snapshot.hasNextPage && snapshot.endCursor
      ? buildDiagnosticsHref({
          status: filters.status,
          after: snapshot.endCursor,
        })
      : null;

  return {
    mode: "cursor-page",
    filters,
    hasActiveFilters,
    availability: "live",
    invalidCursor: false,
    errorMessage: null,
    records: snapshot.stations.map(toRecordRow),
    hasNextPage: snapshot.hasNextPage,
    endCursor: snapshot.endCursor,
    nextHref,
    firstPageHref,
    clearFiltersHref: "/diagnostics",
    retrievedAtUtc,
  };
}
