export type StationStatus = "ONLINE" | "OFFLINE";

export type Station = {
  id: string;
  name: string;
  status: StationStatus;
};

type StationsQueryResponse = {
  data?: {
    stations: Station[];
  };
  errors?: Array<{
    message: string;
  }>;
};

export type StationSnapshot =
  | {
      state: "live";
      stations: Station[];
    }
  | {
      state: "unavailable";
      stations: [];
      message: string;
    };

const STATIONS_QUERY = `
  query OperatorStations {
    stations {
      id
      name
      status
    }
  }
`;

export async function getStationSnapshot(): Promise<StationSnapshot> {
  const endpoint = process.env.STATION_GRAPHQL_URL;

  if (!endpoint) {
    return {
      state: "unavailable",
      stations: [],
      message: "Station API is not configured.",
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: STATIONS_QUERY,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        state: "unavailable",
        stations: [],
        message: `Station API returned HTTP ${response.status}.`,
      };
    }

    const payload = (await response.json()) as StationsQueryResponse;

    if (payload.errors?.length) {
      return {
        state: "unavailable",
        stations: [],
        message: payload.errors[0].message,
      };
    }

    return {
      state: "live",
      stations: payload.data?.stations ?? [],
    };
  } catch {
    return {
      state: "unavailable",
      stations: [],
      message: "Station API could not be reached.",
    };
  }
}