import type { Station, StationStatus } from "./station-api";

export interface StationFilterParams {
  query: string;
  status: "" | StationStatus;
}

export interface StationSnapshotSummary {
  totalStations: number;
  onlineStations: number;
  offlineStations: number;
  unknownStatusStations: number;
  connectivityPercent: number | null;
}

function stationStatusRank(status: string): number {
  if (status === "OFFLINE") return 0;
  if (status === "ONLINE") return 2;
  return 1;
}

/**
 * Sorts charging stations deterministically with offline stations prioritized first,
 * followed by case-insensitive name order and identifier tie-breaking.
 */
export function compareStationsDeterministic(left: Station, right: Station): number {
  const rankDiff = stationStatusRank(left.status) - stationStatusRank(right.status);
  if (rankDiff !== 0) return rankDiff;

  const nameDiff = left.name.localeCompare(right.name, "en", {
    sensitivity: "base",
  });
  if (nameDiff !== 0) return nameDiff;

  return left.id.localeCompare(right.id, "en");
}

/**
 * Normalizes supported search (`q`) and connectivity (`status`) query parameters
 * without mutating unsupported inputs or throwing on array parameters.
 */
export function normalizeStationFilterParams(raw: {
  q?: string | string[];
  status?: string | string[];
}): StationFilterParams {
  const rawQuery = Array.isArray(raw.q) ? raw.q[0] : raw.q;
  const rawStatus = Array.isArray(raw.status) ? raw.status[0] : raw.status;

  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
  const trimmedStatus = typeof rawStatus === "string" ? rawStatus.trim() : "";
  const status: "" | StationStatus =
    trimmedStatus === "ONLINE" || trimmedStatus === "OFFLINE"
      ? trimmedStatus
      : "";

  return { query, status };
}

/**
 * Calculates full-network station counts and connectivity percentage without
 * applying UI filters so summary counts always reflect the authoritative snapshot.
 */
export function summarizeStationSnapshot(
  stations: readonly Station[],
): StationSnapshotSummary {
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

  return {
    totalStations,
    onlineStations,
    offlineStations,
    unknownStatusStations,
    connectivityPercent,
  };
}

/**
 * Returns a new deterministically sorted array filtered by connectivity status
 * and case-insensitive substring matching on station name or identifier.
 */
export function filterAndSortStations(
  stations: readonly Station[],
  filters: StationFilterParams,
): Station[] {
  const normalizedQuery = filters.query.toLowerCase();

  return stations
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
    .sort(compareStationsDeterministic);
}

/**
 * Formats an ISO retrieval timestamp into an explicit UTC label.
 */
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
