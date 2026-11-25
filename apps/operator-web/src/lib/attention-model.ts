import { buildCanonicalSessionDetailHref } from "./session-detail-model";
import { buildStationHref } from "./routes";
import type {
  ChargingTransaction,
  NetworkTransactionPageSnapshot,
  Station,
  StationSnapshot,
  TransactionCompleteness,
} from "./station-api";
import { formatUtcDateTime } from "./station-detail-model";
import {
  compareStationsDeterministic,
  summarizeStationSnapshot,
} from "./station-snapshot-utils";

export const DEFAULT_ATTENTION_STATION_PREVIEW_LIMIT = 8;
export const DEFAULT_ATTENTION_SESSION_PREVIEW_LIMIT = 8;

export interface AttentionStationPreviewItem {
  station: Station;
  href: string;
}

export interface AttentionSessionPreviewItem {
  transaction: ChargingTransaction;
  completeness: TransactionCompleteness;
  stationDisplayName: string;
  stationHref: string;
  sessionHref: string;
  startedAtUtc: string | null;
  missingCount: number;
  missingPreview: number[];
  missingOverflowCount: number;
}

export type AttentionStationsSectionModel =
  | {
      availability: "unavailable";
      errorMessage: string;
      registeredCount: null;
      offlineCount: null;
      unknownStatusCount: null;
      items: [];
      hasMore: false;
    }
  | {
      availability: "live";
      errorMessage: null;
      registeredCount: number;
      offlineCount: number;
      unknownStatusCount: number;
      items: AttentionStationPreviewItem[];
      hasMore: boolean;
    };

export type AttentionSessionsSectionModel =
  | {
      availability: "unavailable";
      errorMessage: string;
      incompleteCount: null;
      items: [];
      hasMore: false;
    }
  | {
      availability: "live";
      errorMessage: null;
      incompleteCount: number;
      items: AttentionSessionPreviewItem[];
      hasMore: boolean;
    };

export interface AttentionPresentationModel {
  stationSection: AttentionStationsSectionModel;
  sessionSection: AttentionSessionsSectionModel;
  /**
   * True only when both authoritative sources succeeded cleanly and establish
   * zero offline stations (with zero unknown statuses) and zero incomplete sessions.
   */
  isConfirmedClear: boolean;
  /** Non-null only when station snapshot succeeded and has at least one station. */
  verifiedStationNamesAvailable: boolean;
  stationPreviewLimit: number;
  sessionPreviewLimit: number;
}

function buildVerifiedStationNameMap(
  snapshot: StationSnapshot,
): Map<string, string> {
  const names = new Map<string, string>();
  if (snapshot.state === "live") {
    for (const station of snapshot.stations) {
      names.set(station.id, station.name);
    }
  }
  return names;
}

function buildStationDetailHrefForAttention(stationId: string): string {
  const baseHref = buildStationHref(stationId);
  const params = new URLSearchParams({ returnTo: "/attention" });
  return `${baseHref}?${params.toString()}`;
}

/**
 * Derives the `/attention` workspace model strictly from one full Station snapshot
 * and one server-filtered `INCOMPLETE` session page, keeping station connectivity
 * and session completeness completely independent with no synthetic incident totals.
 */
export function buildAttentionModel(
  stationSnapshot: StationSnapshot,
  incompleteSessionsPage: NetworkTransactionPageSnapshot,
  options: {
    stationPreviewLimit?: number;
    sessionPreviewLimit?: number;
  } = {},
): AttentionPresentationModel {
  const stationPreviewLimit =
    options.stationPreviewLimit && options.stationPreviewLimit > 0
      ? options.stationPreviewLimit
      : DEFAULT_ATTENTION_STATION_PREVIEW_LIMIT;

  const sessionPreviewLimit =
    options.sessionPreviewLimit && options.sessionPreviewLimit > 0
      ? options.sessionPreviewLimit
      : DEFAULT_ATTENTION_SESSION_PREVIEW_LIMIT;

  const stationNames = buildVerifiedStationNameMap(stationSnapshot);

  let stationSection: AttentionStationsSectionModel;
  if (stationSnapshot.state === "unavailable") {
    stationSection = {
      availability: "unavailable",
      errorMessage: stationSnapshot.message,
      registeredCount: null,
      offlineCount: null,
      unknownStatusCount: null,
      items: [],
      hasMore: false,
    };
  } else {
    const summary = summarizeStationSnapshot(stationSnapshot.stations);
    const offlineStations = stationSnapshot.stations
      .filter(station => station.status === "OFFLINE")
      .sort(compareStationsDeterministic);

    const previewStations = offlineStations
      .slice(0, stationPreviewLimit)
      .map(station => ({
        station,
        href: buildStationDetailHrefForAttention(station.id),
      }));

    stationSection = {
      availability: "live",
      errorMessage: null,
      registeredCount: summary.totalStations,
      offlineCount: summary.offlineStations,
      unknownStatusCount: summary.unknownStatusStations,
      items: previewStations,
      hasMore: offlineStations.length > previewStations.length,
    };
  }

  let sessionSection: AttentionSessionsSectionModel;
  if (incompleteSessionsPage.state === "unavailable") {
    sessionSection = {
      availability: "unavailable",
      errorMessage: incompleteSessionsPage.message,
      incompleteCount: null,
      items: [],
      hasMore: false,
    };
  } else {
    const totalIncomplete = Math.max(0, incompleteSessionsPage.totalElements);
    const previewSessions = incompleteSessionsPage.transactions
      .slice(0, sessionPreviewLimit)
      .map(({ transaction, completeness }) => {
        const missing = completeness.missingSequenceNumbers;
        const missingPreview = missing.slice(0, 8);
        return {
          transaction,
          completeness,
          stationDisplayName:
            stationNames.get(transaction.stationId) ?? transaction.stationId,
          stationHref: buildStationDetailHrefForAttention(transaction.stationId),
          sessionHref: buildCanonicalSessionDetailHref(
            transaction.stationId,
            transaction.transactionId,
            {
              section: "technical",
              returnTo: "/attention",
            },
          ),
          startedAtUtc: formatUtcDateTime(transaction.startedAt),
          missingCount: missing.length,
          missingPreview,
          missingOverflowCount: Math.max(0, missing.length - missingPreview.length),
        };
      });

    sessionSection = {
      availability: "live",
      errorMessage: null,
      incompleteCount: totalIncomplete,
      items: previewSessions,
      hasMore:
        totalIncomplete > previewSessions.length ||
        incompleteSessionsPage.hasNext,
    };
  }

  const isConfirmedClear =
    stationSection.availability === "live" &&
    sessionSection.availability === "live" &&
    stationSection.offlineCount === 0 &&
    stationSection.unknownStatusCount === 0 &&
    sessionSection.incompleteCount === 0;

  return {
    stationSection,
    sessionSection,
    isConfirmedClear,
    verifiedStationNamesAvailable:
      stationSnapshot.state === "live" && stationSnapshot.stations.length > 0,
    stationPreviewLimit,
    sessionPreviewLimit,
  };
}
