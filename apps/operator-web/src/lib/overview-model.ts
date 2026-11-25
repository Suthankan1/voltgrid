import type { Station, StationSnapshot, StationStatus } from "./station-api";
import {
  compareStationsDeterministic,
  filterAndSortStations,
  formatUtcRetrievalTime,
  normalizeStationFilterParams,
  summarizeStationSnapshot,
} from "./station-snapshot-utils";

export const DEFAULT_OVERVIEW_PREVIEW_LIMIT = 6;

export type OverviewConditionKind =
  | "all-online"
  | "attention"
  | "empty"
  | "unavailable";

export interface OverviewFilters {
  query: string;
  status: "" | StationStatus;
  showAll: boolean;
}

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
  hasActiveFilters: boolean;
  filters: OverviewFilters;
  filteredCount: number;
  visibleStations: Station[];
  isTruncated: boolean;
  previewLimit: number;
}

export const compareStationsForOverview = compareStationsDeterministic;
export { formatUtcRetrievalTime };

export function normalizeOverviewFilters(raw: {
  q?: string | string[];
  status?: string | string[];
  all?: string | string[];
}): OverviewFilters {
  const { query, status } = normalizeStationFilterParams(raw);
  const rawAll = Array.isArray(raw.all) ? raw.all[0] : raw.all;
  const showAll = rawAll === "1" || rawAll === "true";

  return { query, status, showAll };
}

export function buildOverviewHref(
  filters: Partial<OverviewFilters>,
  hash?: string,
): string {
  const params = new URLSearchParams();
  if (filters.query) {
    params.set("q", filters.query);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.showAll) {
    params.set("all", "1");
  }
  const queryString = params.toString();
  const base = queryString ? `/?${queryString}` : "/";
  return hash ? `${base}#${hash}` : base;
}

/**
 * Derives the overview presentation model from an authoritative StationSnapshot.
 * Network metrics always reflect the complete snapshot, never filtered subsets.
 */
export function buildOverviewModel(
  snapshot: StationSnapshot,
  filters: OverviewFilters,
  options: { previewLimit?: number; retrievedAtIso?: string | null } = {},
): OverviewPresentationModel {
  const previewLimit =
    options.previewLimit && options.previewLimit > 0
      ? options.previewLimit
      : DEFAULT_OVERVIEW_PREVIEW_LIMIT;
  const hasActiveFilters = Boolean(filters.query || filters.status);

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
      hasActiveFilters,
      filters,
      filteredCount: 0,
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

  const matchingStations = filterAndSortStations(snapshot.stations, filters);

  const shouldShowAll = filters.showAll || hasActiveFilters;
  const visibleStations = shouldShowAll
    ? matchingStations
    : matchingStations.slice(0, previewLimit);
  const isTruncated =
    !shouldShowAll && matchingStations.length > previewLimit;

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
    hasActiveFilters,
    filters,
    filteredCount: matchingStations.length,
    visibleStations,
    isTruncated,
    previewLimit,
  };
}
