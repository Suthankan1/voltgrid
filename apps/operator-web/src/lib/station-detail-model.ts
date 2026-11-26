import { buildSessionHref, buildStationHref, sanitizeStationsReturnPath } from "./routes";
import type {
  ChargingTransaction,
  ConnectorStatus,
  Station,
  StationConnector,
  StationPageDataSnapshot,
} from "./station-api";
import { formatUtcRetrievalTime } from "./station-snapshot-utils";

export const DEFAULT_OVERVIEW_CONNECTOR_PREVIEW = 6;
export const DEFAULT_OVERVIEW_SESSION_PREVIEW = 5;

export type StationDetailSection =
  | "overview"
  | "connectors"
  | "sessions"
  | "connection";

export interface ConnectorStatusCounts {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  unavailable: number;
  faulted: number;
  attention: number;
}

export interface ConnectorPresentationItem {
  compositeKey: string;
  compositeLabel: string;
  connector: StationConnector;
  activeSession: {
    transactionId: string;
    href: string;
  } | null;
}

export interface SessionPresentationItem {
  transaction: ChargingTransaction;
  compositeEndpoint: string;
  href: string;
  startedAtUtc: string | null;
  endedAtUtc: string | null;
  durationLabel: string | null;
}

export interface StationAttentionSummary {
  kind: "offline" | "equipment-issues" | "unverified" | "normal";
  headline: string;
  detail: string;
}

export interface StationDetailPresentationModel {
  station: Station;
  isOffline: boolean;
  ocppPath: string;
  protocolLabel: string;
  activeSection: StationDetailSection;
  returnPath: string | null;
  retrievedAtIso: string | null;
  retrievedAtUtc: string | null;
  connectorsAvailability: "live" | "unavailable";
  connectorsError: string | null;
  connectorCounts: ConnectorStatusCounts | null;
  allConnectors: ConnectorPresentationItem[];
  overviewConnectors: ConnectorPresentationItem[];
  hasMoreConnectors: boolean;
  transactionsAvailability: "live" | "unavailable";
  transactionsError: string | null;
  totalSessionCount: number | null;
  activeSessionCount: number | null;
  allSessions: SessionPresentationItem[];
  overviewSessions: SessionPresentationItem[];
  hasMoreSessions: boolean;
  attention: StationAttentionSummary;
}

const VALID_SECTIONS = new Set<StationDetailSection>([
  "overview",
  "connectors",
  "sessions",
  "connection",
]);

/**
 * Normalizes the `section` URL search parameter, falling back safely to `"overview"`.
 */
export function normalizeStationDetailSection(
  raw: string | string[] | undefined,
): StationDetailSection {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const candidate = typeof first === "string" ? first.trim() : "";
  if (VALID_SECTIONS.has(candidate as StationDetailSection)) {
    return candidate as StationDetailSection;
  }
  return "overview";
}

/**
 * Builds an internal station-detail link for the requested section while preserving
 * an explicit validated directory return path.
 */
export function buildStationDetailSectionHref(
  stationId: string,
  section: StationDetailSection,
  returnPath?: string | null,
): string {
  const baseHref = buildStationHref(stationId);
  const params = new URLSearchParams();
  if (section !== "overview") {
    params.set("section", section);
  }
  const safeReturn = sanitizeStationsReturnPath(returnPath);
  if (safeReturn) {
    params.set("returnTo", safeReturn);
  }
  const queryString = params.toString();
  return queryString ? `${baseHref}?${queryString}` : baseHref;
}

export function buildStationDetailOcppPath(stationId: string): string {
  return `/ocpp/${stationId}`;
}

export function connectorCompositeKey(evseId: number, connectorId: number): string {
  return `${evseId}:${connectorId}`;
}

export function formatConnectorCompositeId(evseId: number, connectorId: number): string {
  return `EVSE ${evseId} · Connector ${connectorId}`;
}

function connectorPriority(status: ConnectorStatus): number {
  switch (status) {
    case "FAULTED":
      return 0;
    case "UNAVAILABLE":
      return 1;
    case "OCCUPIED":
      return 2;
    case "RESERVED":
      return 3;
    case "AVAILABLE":
      return 4;
  }
}

/**
 * Sorts connectors deterministically with faulted/unavailable equipment prioritized first,
 * followed by ascending EVSE identifier and connector identifier tie-breaking.
 */
export function compareConnectorsDeterministic(
  left: StationConnector,
  right: StationConnector,
): number {
  const rankDiff = connectorPriority(left.status) - connectorPriority(right.status);
  if (rankDiff !== 0) return rankDiff;
  const evseDiff = left.evseId - right.evseId;
  if (evseDiff !== 0) return evseDiff;
  return left.connectorId - right.connectorId;
}

/**
 * Sorts charging sessions deterministically with active sessions first,
 * then reverse chronological start time, then transactionId ascending.
 */
export function compareSessionsDeterministic(
  left: ChargingTransaction,
  right: ChargingTransaction,
): number {
  const leftRank = left.status === "ACTIVE" ? 0 : 1;
  const rightRank = right.status === "ACTIVE" ? 0 : 1;
  if (leftRank !== rightRank) return leftRank - rightRank;

  const leftTime = Date.parse(left.startedAt);
  const rightTime = Date.parse(right.startedAt);
  const leftValid = !Number.isNaN(leftTime);
  const rightValid = !Number.isNaN(rightTime);
  if (leftValid && rightValid && leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return left.transactionId.localeCompare(right.transactionId, "en");
}

export function formatUtcDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return formatUtcRetrievalTime(iso);
}

/**
 * Formats an ended charging session's duration when both timestamps are valid
 * and non-negative; returns null when ongoing or timestamps are invalid.
 */
export function formatSessionDuration(
  startedAt: string,
  endedAt: string | null,
): string | null {
  if (!endedAt) return null;
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endedAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return null;
  }
  const totalMinutes = Math.floor((endMs - startMs) / 60_000);
  if (totalMinutes < 1) {
    return "< 1m";
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function summarizeConnectorCounts(
  connectors: readonly StationConnector[],
): ConnectorStatusCounts {
  let available = 0;
  let occupied = 0;
  let reserved = 0;
  let unavailable = 0;
  let faulted = 0;

  for (const connector of connectors) {
    switch (connector.status) {
      case "AVAILABLE":
        available += 1;
        break;
      case "OCCUPIED":
        occupied += 1;
        break;
      case "RESERVED":
        reserved += 1;
        break;
      case "UNAVAILABLE":
        unavailable += 1;
        break;
      case "FAULTED":
        faulted += 1;
        break;
    }
  }

  return {
    total: connectors.length,
    available,
    occupied,
    reserved,
    unavailable,
    faulted,
    attention: unavailable + faulted,
  };
}

/**
 * Derives the pure station-detail presentation model from a live `StationPageDataSnapshot`.
 * Preserves independent connector/session failures, composite `(evseId, connectorId)` identity,
 * and strict separation between station connectivity, connector status, and session lifecycle.
 */
export function buildStationDetailModel(
  snapshot: Extract<StationPageDataSnapshot, { state: "live" }>,
  options: {
    section?: StationDetailSection;
    returnPath?: string | null;
    retrievedAtIso?: string | null;
    connectorPreviewLimit?: number;
    sessionPreviewLimit?: number;
  } = {},
): StationDetailPresentationModel {
  const { station, connectors, transactions } = snapshot;
  const isOffline = station.status === "OFFLINE";
  const activeSection = options.section ?? "overview";
  const returnPath = sanitizeStationsReturnPath(options.returnPath);
  const retrievedAtIso = options.retrievedAtIso ?? null;
  const retrievedAtUtc = formatUtcDateTime(retrievedAtIso);

  const connectorPreviewLimit =
    options.connectorPreviewLimit && options.connectorPreviewLimit > 0
      ? options.connectorPreviewLimit
      : DEFAULT_OVERVIEW_CONNECTOR_PREVIEW;
  const sessionPreviewLimit =
    options.sessionPreviewLimit && options.sessionPreviewLimit > 0
      ? options.sessionPreviewLimit
      : DEFAULT_OVERVIEW_SESSION_PREVIEW;

  const activeSessionByConnector = new Map<string, ChargingTransaction>();
  let allSessions: SessionPresentationItem[] = [];
  let activeSessionCount: number | null = null;
  let totalSessionCount: number | null = null;

  if (transactions.state === "live") {
    const sortedSessions = transactions.items
      .slice()
      .sort(compareSessionsDeterministic);
    totalSessionCount = sortedSessions.length;
    let activeCount = 0;

    allSessions = sortedSessions.map(transaction => {
      if (transaction.status === "ACTIVE") {
        activeCount += 1;
        const key = connectorCompositeKey(
          transaction.evseId,
          transaction.connectorId,
        );
        if (!activeSessionByConnector.has(key)) {
          activeSessionByConnector.set(key, transaction);
        }
      }
      return {
        transaction,
        compositeEndpoint: formatConnectorCompositeId(
          transaction.evseId,
          transaction.connectorId,
        ),
        href: buildSessionHref(station.id, transaction.transactionId),
        startedAtUtc: formatUtcDateTime(transaction.startedAt),
        endedAtUtc: formatUtcDateTime(transaction.endedAt),
        durationLabel: formatSessionDuration(
          transaction.startedAt,
          transaction.endedAt,
        ),
      };
    });

    activeSessionCount = activeCount;
  }

  let connectorCounts: ConnectorStatusCounts | null = null;
  let allConnectors: ConnectorPresentationItem[] = [];

  if (connectors.state === "live") {
    connectorCounts = summarizeConnectorCounts(connectors.items);
    const sortedConnectors = connectors.items
      .slice()
      .sort(compareConnectorsDeterministic);

    allConnectors = sortedConnectors.map(connector => {
      const key = connectorCompositeKey(
        connector.evseId,
        connector.connectorId,
      );
      const matchedActive =
        transactions.state === "live"
          ? activeSessionByConnector.get(key)
          : undefined;

      return {
        compositeKey: key,
        compositeLabel: formatConnectorCompositeId(
          connector.evseId,
          connector.connectorId,
        ),
        connector,
        activeSession: matchedActive
          ? {
              transactionId: matchedActive.transactionId,
              href: buildSessionHref(station.id, matchedActive.transactionId),
            }
          : null,
      };
    });
  }

  let attention: StationAttentionSummary;
  if (isOffline) {
    attention = {
      kind: "offline",
      headline: "Station is currently reported offline",
      detail:
        connectorCounts && connectorCounts.attention > 0
          ? `${connectorCounts.attention} ${connectorCounts.attention === 1 ? "connector also last reported a fault or unavailability" : "connectors also last reported faults or unavailability"}. Because the station is disconnected, stored connector states reflect last reported observations rather than verified real-time availability.`
          : "Stored connector states reflect the last reported observation while the station is currently offline and do not confirm current usability or physical fault.",
    };
  } else if (connectors.state === "unavailable") {
    attention = {
      kind: "unverified",
      headline: "Connector condition could not be verified",
      detail:
        "Station connectivity is online, but connector data could not be retrieved from Station Service.",
    };
  } else if (connectorCounts && connectorCounts.attention > 0) {
    const parts: string[] = [];
    if (connectorCounts.faulted > 0) {
      parts.push(`${connectorCounts.faulted} faulted`);
    }
    if (connectorCounts.unavailable > 0) {
      parts.push(`${connectorCounts.unavailable} unavailable`);
    }
    attention = {
      kind: "equipment-issues",
      headline: `${connectorCounts.attention} ${connectorCounts.attention === 1 ? "connector requires" : "connectors require"} attention`,
      detail: `Reported connector statuses include ${parts.join(" and ")}. Disconnected or faulted connectors appear first.`,
    };
  } else {
    attention = {
      kind: "normal",
      headline: "No station-local connectivity or connector alerts",
      detail:
        connectorCounts && connectorCounts.total > 0
          ? "The station is connected and no connectors report faulted or unavailable states."
          : "The station is connected, with no connectors reported yet.",
    };
  }

  return {
    station,
    isOffline,
    ocppPath: buildStationDetailOcppPath(station.id),
    protocolLabel: "OCPP 2.0.1",
    activeSection,
    returnPath,
    retrievedAtIso,
    retrievedAtUtc,
    connectorsAvailability: connectors.state,
    connectorsError:
      connectors.state === "unavailable" ? connectors.message : null,
    connectorCounts,
    allConnectors,
    overviewConnectors: allConnectors.slice(0, connectorPreviewLimit),
    hasMoreConnectors: allConnectors.length > connectorPreviewLimit,
    transactionsAvailability: transactions.state,
    transactionsError:
      transactions.state === "unavailable" ? transactions.message : null,
    totalSessionCount,
    activeSessionCount,
    allSessions,
    overviewSessions: allSessions.slice(0, sessionPreviewLimit),
    hasMoreSessions: allSessions.length > sessionPreviewLimit,
    attention,
  };
}
