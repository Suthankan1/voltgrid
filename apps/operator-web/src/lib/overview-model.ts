import type { Station, StationSnapshot } from "./station-api";
import {
  compareStationsDeterministic,
  formatUtcRetrievalTime,
  summarizeStationSnapshot,
} from "./station-snapshot-utils";

export const DEFAULT_OVERVIEW_PREVIEW_LIMIT = 6;

export type OverviewConditionKind =
  | "all-online"
  | "attention"
  | "empty"
  | "unavailable";

export interface OverviewPresentationModel {
  availability: "live" | "unavailable";
  errorMessage: string | null;
  retrievedAtIso: string | null;
  totalStations: number | null;
  onlineStations: number | null;
  offlineStations: number | null;
  unknownStatusStations: number | null;
  connectivityPercent: number | null;
  conditionKind: OverviewConditionKind;
  visibleStations: Station[];
  isTruncated: boolean;
  previewLimit: number;
}

export const compareStationsForOverview = compareStationsDeterministic;
export { formatUtcRetrievalTime };

/**
 * Derives the concise overview presentation model from an authoritative StationSnapshot
 * with offline-first bounded station preview.
 */
export function buildOverviewModel(
  snapshot: StationSnapshot,
  options: { previewLimit?: number; retrievedAtIso?: string | null } = {},
): OverviewPresentationModel {
  const previewLimit =
    options.previewLimit && options.previewLimit > 0
      ? options.previewLimit
      : DEFAULT_OVERVIEW_PREVIEW_LIMIT;

  if (snapshot.state === "unavailable") {
    return {
      availability: "unavailable",
      errorMessage: snapshot.message,
      retrievedAtIso: null,
      totalStations: null,
      onlineStations: null,
      offlineStations: null,
      unknownStatusStations: null,
      connectivityPercent: null,
      conditionKind: "unavailable",
      visibleStations: [],
      isTruncated: false,
      previewLimit,
    };
  }

  const summary = summarizeStationSnapshot(snapshot.stations);

  const conditionKind: OverviewConditionKind =
    summary.totalStations === 0
      ? "empty"
      : summary.offlineStations > 0 || summary.unknownStatusStations > 0
        ? "attention"
        : "all-online";

  const sortedStations = snapshot.stations.slice().sort(compareStationsDeterministic);
  const visibleStations = sortedStations.slice(0, previewLimit);
  const isTruncated = sortedStations.length > previewLimit;

  return {
    availability: "live",
    errorMessage: null,
    retrievedAtIso: options.retrievedAtIso ?? null,
    totalStations: summary.totalStations,
    onlineStations: summary.onlineStations,
    offlineStations: summary.offlineStations,
    unknownStatusStations: summary.unknownStatusStations,
    connectivityPercent: summary.connectivityPercent,
    conditionKind,
    visibleStations,
    isTruncated,
    previewLimit,
  };
}
