import { getAuthHeaders } from "./auth";

export type OperationalStatus = "ONLINE" | "OFFLINE" | "UNAVAILABLE";
export type ProjectedStation = {
  stationId: string;
  currentStatus: string;
  statusChangedAt: string;
  updatedAt: string;
};
export type ProjectedStationStatusRecord = ProjectedStation & {
  lastEventId: string | null;
};
export type OperationsSnapshot =
  | { state: "live"; stations: ProjectedStation[]; hasNextPage: boolean; endCursor: string | null }
  | { state: "unavailable"; message: string };

export type DiagnosticsPageSnapshot =
  | {
      state: "live";
      stations: ProjectedStationStatusRecord[];
      hasNextPage: boolean;
      endCursor: string | null;
    }
  | {
      state: "unavailable";
      message: string;
      invalidCursor?: boolean;
    };

export type StationOperationalLookupSnapshot =
  | {
      state: "found";
      record: ProjectedStationStatusRecord;
    }
  | {
      state: "not-found";
    }
  | {
      state: "unavailable";
      message: string;
    };

const QUERY = `query OperatorStatuses($after: String, $status: StationOperationalStatus) {
  stationStatuses(first: 20, after: $after, status: $status) {
    edges { node { stationId currentStatus statusChangedAt updatedAt } }
    pageInfo { hasNextPage endCursor }
  }
}`;

const DIAGNOSTICS_PAGE_QUERY = `query OperatorStatuses($after: String, $status: StationOperationalStatus) {
  stationStatuses(first: 20, after: $after, status: $status) {
    edges { node { stationId currentStatus lastEventId statusChangedAt updatedAt } }
    pageInfo { hasNextPage endCursor }
  }
}`;

const STATION_OPERATIONAL_STATUS_QUERY = `query OperatorStationStatus($stationId: ID!) {
  stationStatus(stationId: $stationId) {
    stationId
    currentStatus
    lastEventId
    statusChangedAt
    updatedAt
  }
}`;

function parseProjectedStationRecord(
  value: unknown,
): ProjectedStationStatusRecord | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const node = value as Record<string, unknown>;
  if (
    typeof node.stationId !== "string" ||
    typeof node.currentStatus !== "string" ||
    typeof node.statusChangedAt !== "string" ||
    typeof node.updatedAt !== "string"
  ) {
    return null;
  }
  if (
    node.lastEventId !== undefined &&
    node.lastEventId !== null &&
    typeof node.lastEventId !== "string"
  ) {
    return null;
  }
  return {
    stationId: node.stationId,
    currentStatus: node.currentStatus,
    lastEventId: typeof node.lastEventId === "string" ? node.lastEventId : null,
    statusChangedAt: node.statusChangedAt,
    updatedAt: node.updatedAt,
  };
}

export async function getOperationsSnapshot(after?: string, status?: OperationalStatus): Promise<OperationsSnapshot> {
  const endpoint = process.env.OPERATIONS_GRAPHQL_URL;
  if (!endpoint) return { state: "unavailable", message: "Operations API is not configured." };
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...await getAuthHeaders() },
      body: JSON.stringify({ query: QUERY, variables: { after: after ?? null, status: status ?? null } }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("HTTP failure");
    const payload = await response.json();
    const connection = payload.data?.stationStatuses;
    if (payload.errors?.length || !Array.isArray(connection?.edges) ||
        typeof connection.pageInfo?.hasNextPage !== "boolean" ||
        !(connection.pageInfo.endCursor === null || typeof connection.pageInfo.endCursor === "string") ||
        (connection.pageInfo.hasNextPage && !connection.pageInfo.endCursor) ||
        !connection.edges.every((edge: { node?: ProjectedStation }) => edge.node &&
          [edge.node.stationId, edge.node.currentStatus, edge.node.statusChangedAt, edge.node.updatedAt]
            .every(value => typeof value === "string"))) throw new Error("Invalid response");
    return { state: "live", stations: connection.edges.map((edge: { node: ProjectedStation }) => edge.node),
      hasNextPage: connection.pageInfo.hasNextPage, endCursor: connection.pageInfo.endCursor };
  } catch {
    return { state: "unavailable", message: "Operations data could not be loaded. Try again shortly." };
  }
}

/**
 * Fetches a bounded cursor page from Operations Service (`stationStatuses`)
 * including `lastEventId`, classifying invalid cursors and API failures safely.
 */
export async function getDiagnosticsPage(
  options: { after?: string; status?: OperationalStatus } = {},
): Promise<DiagnosticsPageSnapshot> {
  const endpoint = process.env.OPERATIONS_GRAPHQL_URL;
  if (!endpoint) {
    return { state: "unavailable", message: "Operations API is not configured." };
  }

  const after = options.after ?? null;
  const status = options.status ?? null;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...await getAuthHeaders() },
      body: JSON.stringify({
        query: DIAGNOSTICS_PAGE_QUERY,
        variables: { after, status },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        state: "unavailable",
        invalidCursor: Boolean(after && response.status === 400),
        message: after
          ? "The requested diagnostics page cursor could not be loaded."
          : "Operations data could not be loaded. Try again shortly.",
      };
    }

    const payload = await response.json();
    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
      return {
        state: "unavailable",
        invalidCursor: Boolean(after),
        message: after
          ? "The requested diagnostics page cursor is no longer valid or could not be loaded."
          : "Operations data could not be loaded. Try again shortly.",
      };
    }

    const connection = payload.data?.stationStatuses;
    if (
      !Array.isArray(connection?.edges) ||
      typeof connection.pageInfo?.hasNextPage !== "boolean" ||
      !(
        connection.pageInfo.endCursor === null ||
        typeof connection.pageInfo.endCursor === "string"
      ) ||
      (connection.pageInfo.hasNextPage && !connection.pageInfo.endCursor)
    ) {
      return {
        state: "unavailable",
        message: "Operations data could not be loaded. Try again shortly.",
      };
    }

    const stations: ProjectedStationStatusRecord[] = [];
    for (const edge of connection.edges as Array<{ node?: unknown }>) {
      const parsed = parseProjectedStationRecord(edge?.node);
      if (!parsed) {
        return {
          state: "unavailable",
          message: "Operations data could not be loaded. Try again shortly.",
        };
      }
      stations.push(parsed);
    }

    return {
      state: "live",
      stations,
      hasNextPage: connection.pageInfo.hasNextPage,
      endCursor: connection.pageInfo.endCursor,
    };
  } catch {
    return {
      state: "unavailable",
      message: "Operations data could not be loaded. Try again shortly.",
    };
  }
}

/**
 * Looks up a single station's asynchronous Operations Service projection via
 * `stationStatus(stationId)`, preserving the distinction between absent projection
 * (`not-found`) and API failure (`unavailable`).
 */
export async function getStationOperationalStatus(
  stationId: string,
): Promise<StationOperationalLookupSnapshot> {
  const endpoint = process.env.OPERATIONS_GRAPHQL_URL;
  if (!endpoint) {
    return { state: "unavailable", message: "Operations API is not configured." };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...await getAuthHeaders() },
      body: JSON.stringify({
        query: STATION_OPERATIONAL_STATUS_QUERY,
        variables: { stationId },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        state: "unavailable",
        message: "Operations data could not be loaded. Try again shortly.",
      };
    }

    const payload = await response.json();
    if (
      (Array.isArray(payload.errors) && payload.errors.length > 0) ||
      !payload.data ||
      !("stationStatus" in payload.data)
    ) {
      return {
        state: "unavailable",
        message: "Operations data could not be loaded. Try again shortly.",
      };
    }

    if (payload.data.stationStatus === null) {
      return { state: "not-found" };
    }

    const parsed = parseProjectedStationRecord(payload.data.stationStatus);
    if (!parsed) {
      return {
        state: "unavailable",
        message: "Operations data could not be loaded. Try again shortly.",
      };
    }

    return { state: "found", record: parsed };
  } catch {
    return {
      state: "unavailable",
      message: "Operations data could not be loaded. Try again shortly.",
    };
  }
}
