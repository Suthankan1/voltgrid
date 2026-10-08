export type ProjectedStation = {
  stationId: string;
  currentStatus: string;
  statusChangedAt: string;
  updatedAt: string;
};
export type OperationsSnapshot =
  | { state: "live"; stations: ProjectedStation[]; hasNextPage: boolean; endCursor: string | null }
  | { state: "unavailable"; message: string };

const QUERY = `query OperatorStatuses($after: String) {
  stationStatuses(first: 20, after: $after) {
    edges { node { stationId currentStatus statusChangedAt updatedAt } }
    pageInfo { hasNextPage endCursor }
  }
}`;

export async function getOperationsSnapshot(after?: string): Promise<OperationsSnapshot> {
  const endpoint = process.env.OPERATIONS_GRAPHQL_URL;
  if (!endpoint) return { state: "unavailable", message: "Operations API is not configured." };
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { after: after ?? null } }),
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
