import type { Station, StationSnapshot, StationStatus } from "./station-api";

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

function stationSortRank(status: string): number {
  if (status === "OFFLINE") return 0;
  if (status === "ONLINE") return 2;
  return 1;
}

export function compareStationsForOverview(left: Station, right: Station): number {
  const rankDiff = stationSortRank(left.status) - stationSortRank(right.status);
  if (rankDiff !== 0) return rankDiff;

  const nameDiff = left.name.localeCompare(right.name, "en", {
    sensitivity: "base",
  });
  if (nameDiff !== 0) return nameDiff;

  return left.id.localeCompare(right.id, "en");
}

export function normalizeOverviewFilters(raw: {
  q?: string | string[];
  status?: string | string[];
  all?: string | string[];
}): OverviewFilters {
  const rawQuery = Array.isArray(raw.q) ? raw.q[0] : raw.q;
  const rawStatus = Array.isArray(raw.status) ? raw.status[0] : raw.status;
  const rawAll = Array.isArray(raw.all) ? raw.all[0] : raw.all;

  const query = rawQuery?.trim() ?? "";
  const status: "" | StationStatus =
    rawStatus === "ONLINE" || rawStatus === "OFFLINE" ? rawStatus : "";
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

export function formatUtcRetrievalTime(iso: string): string | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(parsed);
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

  const stations = snapshot.stations;
  let onlineStations = 0;
  let offlineStations = 0;
  let unknownStatusStations = 0;

  for (const station of stations) {
    if (station.status === "ONLINE") {
      onlineStations += 1;
    } else if (station.status === "OFFLINE") {
      offlineStations += 1;
    } else {
      unknownStatusStations += 1;
    }
  }

  const totalStations = stations.length;
  const connectivityPercent =
    totalStations === 0
      ? null
      : Math.round((onlineStations / totalStations) * 100);

  const conditionKind: OverviewConditionKind =
    totalStations === 0
      ? "empty"
      : offlineStations > 0 || unknownStatusStations > 0
        ? "attention"
        : "all-online";

  const normalizedQuery = filters.query.toLowerCase();
  const matchingStations = stations
    .filter(station => {
      if (filters.status && station.status !== filters.status) {
        return false;
      }
      if (
        normalizedQuery &&
        !`${station.id} ${station.name}`.toLowerCase().includes(normalizedQuery)
      ) {
        return false;
      }
      return true;
    })
    .slice()
    .sort(compareStationsForOverview);

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
    totalStations,
    onlineStations,
    offlineStations,
    unknownStatusStations,
    connectivityPercent,
    conditionKind,
    hasActiveFilters,
    filters,
    filteredCount: matchingStations.length,
    visibleStations,
    isTruncated,
    previewLimit,
  };
}
