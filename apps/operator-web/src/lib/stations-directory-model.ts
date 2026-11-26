import { buildStationHref } from "./routes";
import type { Station, StationSnapshot } from "./station-api";
import {
  filterAndSortStations,
  formatUtcRetrievalTime,
  normalizeStationFilterParams,
  summarizeStationSnapshot,
  type StationFilterParams,
} from "./station-snapshot-utils";

export type StationDirectoryFilters = StationFilterParams;

export type StationDirectoryState =
  | "results"
  | "empty"
  | "no-matches"
  | "unavailable";

export interface StationDirectoryModel {
  availability: "live" | "unavailable";
  directoryState: StationDirectoryState;
  errorMessage: string | null;
  retrievedAtIso: string | null;
  totalStations: number | null;
  onlineStations: number | null;
  offlineStations: number | null;
  unknownStatusStations: number | null;
  matchingCount: number;
  hasActiveFilters: boolean;
  filters: StationDirectoryFilters;
  stations: Station[];
}

export const normalizeStationDirectoryFilters = normalizeStationFilterParams;
export { formatUtcRetrievalTime };

/**
 * Builds an internal `/stations` directory href with normalized supported parameters.
 */
export function buildStationsDirectoryHref(
  filters: Partial<StationDirectoryFilters> = {},
): string {
  const params = new URLSearchParams();
  const query = filters.query?.trim() ?? "";
  if (query) {
    params.set("q", query);
  }
  if (filters.status === "ONLINE" || filters.status === "OFFLINE") {
    params.set("status", filters.status);
  }
  const queryString = params.toString();
  return queryString ? `/stations?${queryString}` : "/stations";
}

/**
 * Builds a station-detail link that optionally preserves active directory filter context
 * via an internal validated return path.
 */
export function buildDirectoryStationHref(
  stationId: string,
  filters?: Partial<StationDirectoryFilters>,
): string {
  const baseHref = buildStationHref(stationId);
  const directoryHref = buildStationsDirectoryHref(filters);
  if (directoryHref === "/stations") {
    return baseHref;
  }
  return `${baseHref}?returnTo=${encodeURIComponent(directoryHref)}`;
}

/**
 * Maps supported legacy overview search/filter query parameters (`q`, `status`, `all`)
 * to the canonical `/stations` directory destination without open redirects.
 */
export function resolveLegacyOverviewRedirectTarget(raw: {
  q?: string | string[];
  status?: string | string[];
  all?: string | string[];
}): string | null {
  const filters = normalizeStationDirectoryFilters(raw);
  const rawAll = Array.isArray(raw.all) ? raw.all[0] : raw.all;
  const showAll = rawAll === "1" || rawAll === "true";

  if (!filters.query && !filters.status && !showAll) {
    return null;
  }

  return buildStationsDirectoryHref(filters);
}

/**
 * Derives the full charging-station directory presentation model from the complete
 * authoritative Station Service snapshot without mutating the source array.
 */
export function buildStationsDirectoryModel(
  snapshot: StationSnapshot,
  filters: StationDirectoryFilters,
  options: { retrievedAtIso?: string | null } = {},
): StationDirectoryModel {
  const hasActiveFilters = Boolean(filters.query || filters.status);

  if (snapshot.state === "unavailable") {
    return {
      availability: "unavailable",
      directoryState: "unavailable",
      errorMessage: snapshot.message,
      retrievedAtIso: null,
      totalStations: null,
      onlineStations: null,
      offlineStations: null,
      unknownStatusStations: null,
      matchingCount: 0,
      hasActiveFilters,
      filters,
      stations: [],
    };
  }

  const summary = summarizeStationSnapshot(snapshot.stations);
  const matchingStations = filterAndSortStations(snapshot.stations, filters);

  const directoryState: StationDirectoryState =
    summary.totalStations === 0
      ? "empty"
      : matchingStations.length === 0
        ? "no-matches"
        : "results";

  return {
    availability: "live",
    directoryState,
    errorMessage: null,
    retrievedAtIso: options.retrievedAtIso ?? null,
    totalStations: summary.totalStations,
    onlineStations: summary.onlineStations,
    offlineStations: summary.offlineStations,
    unknownStatusStations: summary.unknownStatusStations,
    matchingCount: matchingStations.length,
    hasActiveFilters,
    filters,
    stations: matchingStations,
  };
}
